import { expect, test } from 'claude-code/testing'

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

test('sem dado, fica a linha normal do engine', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...linha('Cota semanal: sem dado ainda.'), surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})
