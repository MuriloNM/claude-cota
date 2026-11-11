import { expect, test } from 'claude-code/testing'
import { ativoMs, semanaDoTexto, sonoDoTexto } from './register.js'

const TEXTO =
  'Cota semanal 16% (esperado 30%) 🟢 folga · projeção 52% · reseta em 4.9d · pode gastar 17%/dia\nfonte: app (lido há 2 min)'

const linha = (text: string) =>
  ({
    plugin: 'cota',
    component: 'CommandOutput',
    requestId: 'r1',
    props: { command: 'cota', args: '', text, isErrored: false },
  }) as const

test('o /cota vira cartão gráfico onde há Svg', async $ => {
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...linha(TEXTO), surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg).toBeDefined()
    await ui.unmount()
  }
})

test('no terminal, a barra em texto com os mesmos números', async ($, on) => {
  on('config.list', () => ({ value: [{ key: 'language', value: 'Pt-br' }] as never }))
  const ui = await $.ui.mount({ ...linha(TEXTO), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /esperado hoje 30%/ }))?.text).toContain('▲')
  expect((await ui.find({ type: 'Text', text: /Fecha a semana em 52%/ }))?.text).toContain('4,9 dias')
  await ui.unmount()
})

test('app sem conexão: aviso curto, sem erro cru, e tenta de novo na vez seguinte', async ($, on) => {
  const agora = Date.parse('2026-11-04T22:00:00Z')
  const cmd = {
    command: 'cota', args: '', origin: { kind: 'plugin', name: 'teste' },
    presentation: { isFullscreen: false, columns: 80 },
  } as const
  on('command.register', () => ({ value: { command: 'cota' } }))
  on('clock.now', () => ({ value: agora }))
  on('env.get', () => ({ value: 'Trabalho' }))
  on('store.get', () => ({
    value: { percentUsed: 99, resetsAt: '2026-11-05T10:00:00Z', lido: agora - 140 * 60_000 },
  }))
  on('session.usage', () => ({ value: { rateLimits: [] } as never }))
  on('ui.status', () => ({ value: undefined }))

  // Sem hook de mcp.call, nada está conectado: a consulta falha como no app sem o servidor.
  const primeira = await $.command.run(cmd)
  const segunda = await $.command.run(cmd)

  expect(primeira.text).toContain('lido há 2 h 20 min')
  expect(primeira.text).toContain('app sem resposta agora')
  expect(primeira.text).not.toContain('HooksError')
  expect(segunda.text).toContain('app sem resposta agora')
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const idiomaDoClaude = (on: any, valor: string) =>
  on('config.list', () => ({ value: [{ key: 'language', value: valor }] }))

test('o terminal segue o idioma do /config', async ($, on) => {
  idiomaDoClaude(on, 'english')
  const ui = await $.ui.mount({ ...linha(TEXTO), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /expected today 30%/ }))?.text).toContain('▲')
  expect((await ui.find({ type: 'Text', text: /Week ends at 52%/ }))?.text).toContain('4.9 days')
  await ui.unmount()
})

test('idioma sem tradução cai no inglês', async ($, on) => {
  idiomaDoClaude(on, 'Klingon')
  const ui = await $.ui.mount({ ...linha(TEXTO), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /expected today/ }))).toBeDefined()
  await ui.unmount()
})

test('a linha de outro idioma também vira cartão', async ($, on) => {
  idiomaDoClaude(on, 'japanese')
  const texto = '週間クォータ 16% (目安 30%) 🟢 余裕あり · 見込み 52% · リセットまで 4.9d · 使用可能 17%/日\nソース: アプリ（2 min前に取得）'
  const ui = await $.ui.mount({ ...linha(texto), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /週末の見込み 52%/ }))?.text).toContain('4.9日')
  expect((await ui.find({ type: 'Text', text: /ソース/ }))).toBeDefined()
  await ui.unmount()
})

test('o /cota escreve no idioma do Claude', async ($, on) => {
  const agora = Date.parse('2026-11-04T22:00:00Z')
  idiomaDoClaude(on, 'Español')
  on('clock.now', () => ({ value: agora }))
  on('env.get', () => ({ value: 'Trabalho' }))
  on('store.get', () => ({
    value: { percentUsed: 99, resetsAt: '2026-11-05T10:00:00Z', lido: agora - 140 * 60_000 },
  }))
  on('session.usage', () => ({ value: { rateLimits: [] } as never }))
  on('ui.status', () => ({ value: undefined }))
  const r = await $.command.run({
    command: 'cota', args: '', origin: { kind: 'plugin', name: 'teste' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(r.text).toContain('Cuota semanal 99%')
  expect(r.text).toContain('fuente: app (leído hace 2 h 20 min)')
})

test('guarda a janela de 5 h e a semana por modelo no perfil da conta', async ($, on) => {
  const agora = Date.parse('2026-11-05T12:00:00Z')
  const guardado: Record<string, unknown> = {}
  on('command.register', () => ({ value: { command: 'cota' } }))
  on('clock.now', () => ({ value: agora }))
  on('env.get', () => ({ value: 'Trabalho' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', (_, e) => {
    guardado[e.key] = e.value
    return { value: undefined }
  })
  on('session.usage', () => ({ value: { rateLimits: [] } as never }))
  on('ui.status', () => ({ value: undefined }))
  on('mcp.call', () => ({
    value: {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          plan: {
            windows: [
              { label: '5-hour', percentUsed: 40, resetsAt: '2026-11-05T14:00:00Z' },
              { label: 'Weekly · all models', percentUsed: 15, resetsAt: '2026-11-12T10:00:00Z' },
              { label: 'Weekly · Fable', percentUsed: 2, resetsAt: '2026-11-12T10:00:00Z' },
            ],
          },
        }),
      }],
    } as never,
  }))

  await $.command.run({
    command: 'cota', args: '', origin: { kind: 'plugin', name: 'teste' },
    presentation: { isFullscreen: false, columns: 80 },
  })

  expect(guardado['cinco_horas:Trabalho']).toEqual({ percentUsed: 40, resetsAt: '2026-11-05T14:00:00Z', lido: agora })
  expect(guardado['modelos:Trabalho']).toEqual({
    lido: agora,
    janelas: [{ nome: 'Fable', percentUsed: 2, resetsAt: '2026-11-12T10:00:00Z' }],
  })
  expect(guardado['ultima:Trabalho']).toEqual({ percentUsed: 15, resetsAt: '2026-11-12T10:00:00Z', lido: agora })
})

test('dias que contam: entende os jeitos de escrever', async () => {
  expect(semanaDoTexto('seg-sex')).toBe('12345')
  expect(semanaDoTexto('seg,qua,sex')).toBe('135')
  expect(semanaDoTexto('sex-seg')).toBe('0156')
  expect(semanaDoTexto('mon-fri')).toBe('12345')
  expect(semanaDoTexto('todos')).toBe('0123456')
  expect(semanaDoTexto('xyz')).toBeUndefined()
  const seg = new Date(2026, 10, 9).getTime()
  expect(ativoMs(seg, new Date(2026, 10, 16).getTime(), { semana: '12345', sono: '0-0' })).toBe(5 * 86_400_000)
  expect(ativoMs(seg, new Date(2026, 10, 16).getTime(), { semana: '12345', folgas: ['2026-11-10'], sono: '0-0' })).toBe(4 * 86_400_000)
})

test('horas de sono: saem da conta, mesmo virando a meia-noite', async () => {
  const H = 3_600_000
  const seg = new Date(2026, 10, 9).getTime(), fim = new Date(2026, 10, 16).getTime()
  expect(ativoMs(seg, fim, {})).toBe(126 * H)
  expect(ativoMs(seg, fim, { sono: '23-5' })).toBe(126 * H)
  expect(ativoMs(seg, fim, { semana: '12345' })).toBe(90 * H)
  expect(ativoMs(new Date(2026, 10, 9, 23).getTime(), new Date(2026, 10, 10, 5).getTime(), { sono: '23-5' })).toBe(0)
  expect(ativoMs(new Date(2026, 10, 9, 3).getTime(), new Date(2026, 10, 9, 8).getTime(), {})).toBe(2 * H)
  expect(sonoDoTexto('23-5')).toBe('23-5')
  expect(sonoDoTexto('23h a 5h')).toBe('23-5')
  expect(sonoDoTexto('24-6')).toBe('0-6')
  expect(sonoDoTexto('não')).toBe('0-0')
  expect(sonoDoTexto('padrao')).toBe('0-6')
  expect(sonoDoTexto('tarde')).toBeUndefined()
})

test('sem ajuste, o esperado já tira as horas de sono e o "por dia" segue em dias inteiros', async ($, on) => {
  const agora = new Date(2026, 10, 14, 0).getTime()   // sábado, 0h: faltam 2 dias inteiros
  const reset = new Date(2026, 10, 16).toISOString()
  idiomaDoClaude(on, 'Pt-br')
  on('clock.now', () => ({ value: agora }))
  on('env.get', () => ({ value: 'Trabalho' }))
  on('store.get', () => ({ value: { percentUsed: 50, resetsAt: reset, lido: agora - 60_000 } }))
  on('fs.read', () => ({ value: '{}' }))
  on('session.usage', () => ({ value: { rateLimits: [] } as never }))
  on('ui.status', () => ({ value: undefined }))
  const r = await $.command.run({
    command: 'cota', args: '', origin: { kind: 'plugin', name: 'teste' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(r.text).toContain('(esperado 71%)')
  expect(r.text).toContain('25%/dia')
})

test('o esperado só anda nos dias que contam', async ($, on) => {
  const agora = new Date(2026, 10, 11).getTime()   // quarta, 0h: passaram seg e ter
  const reset = new Date(2026, 10, 16).toISOString()
  idiomaDoClaude(on, 'Pt-br')
  on('clock.now', () => ({ value: agora }))
  on('env.get', () => ({ value: 'Trabalho' }))
  on('store.get', () => ({ value: { percentUsed: 20, resetsAt: reset, lido: agora - 60_000 } }))
  on('fs.read', () => ({ value: JSON.stringify({ Trabalho: { semana: '12345' } }) }))
  on('session.usage', () => ({ value: { rateLimits: [] } as never }))
  on('ui.status', () => ({ value: undefined }))
  const r = await $.command.run({
    command: 'cota', args: '', origin: { kind: 'plugin', name: 'teste' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(r.text).toContain('(esperado 40%)')
  expect(r.text).toContain('projeção 50%')
})

test('/cota dias e /cota folga gravam o arquivo da conta', async ($, on) => {
  let gravado = '{}'
  on('clock.now', () => ({ value: new Date(2026, 10, 5).getTime() }))
  on('env.get', () => ({ value: 'Trabalho' }))
  on('fs.read', () => ({ value: gravado }))
  on('fs.write', (_, e) => {
    gravado = e.text
    return { value: undefined }
  })
  const run = (args: string) => $.command.run({
    command: 'cota', args, origin: { kind: 'plugin', name: 'teste' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect((await run('dias seg-sex')).text).toContain('Dias que contam: seg ter qua qui sex')
  expect((await run('folga 10/11')).text).toContain('folgas: 10/11')
  expect(JSON.parse(gravado)).toEqual({ Trabalho: { semana: '12345', folgas: ['2026-11-10'] } })
  await run('folga 10/11')
  await run('dias todos')
  expect(JSON.parse(gravado)).toEqual({})
  expect((await run('dias quinta-feira-santa')).text).toContain('Não entendi os dias')
  expect((await run('sono 23-5')).text).toContain('sono: 23h-5h')
  expect(JSON.parse(gravado)).toEqual({ Trabalho: { sono: '23-5' } })
  expect((await run('sono nao')).text).toContain('não tira horas de sono')
  await run('sono padrao')
  expect(JSON.parse(gravado)).toEqual({})
  expect((await run('sono tarde')).text).toContain('Não entendi o horário')
})

test('sem dado, fica a linha normal do engine', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...linha('Cota semanal: sem dado ainda.'), surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})
