import type { EngineInterface, Register } from 'claude-code'


const SEMANA_MS = 7 * 24 * 3600 * 1000
const MIN_MS = 60_000

type Janela = { kind: string; percentUsed: number; resetsAt?: string }

function linha(janelas: readonly Janela[], agora: number, curta = false): string | undefined {
  const j = janelas.find(x => x.kind === 'seven_day')
  if (!j || !j.resetsAt) {
    return `Cota semanal: sem dado (janelas: ${janelas.map(x => x.kind).join(', ') || 'nenhuma'}${erroDoApp ? '; ' + erroDoApp : ''})`
  }
  const resta = Date.parse(j.resetsAt) - agora
  if (Number.isNaN(resta)) return undefined
  const decorrido = Math.min(Math.max(1 - resta / SEMANA_MS, 0), 1)
  const ideal = decorrido * 100
  const usado = j.percentUsed
  const dif = usado - ideal
  const projecao = decorrido > 0.02 ? usado / decorrido : usado
  const dias = Math.max(resta, 0) / 86_400_000

  const sinal = dif > 5 ? '🔴 acima do ritmo' : dif < -5 ? '🟢 folga' : '🟡 no ritmo'
  const sobra = Math.max(100 - usado, 0)
  const porDia = dias > 0.05 ? ` · pode gastar ${(sobra / dias).toFixed(0)}%/dia` : ''

  if (curta) {
    const cor = sinal.split(' ')[0]
    return `${cor} Semana ${usado.toFixed(0)}% / ${ideal.toFixed(0)}% → ${projecao.toFixed(0)}%`
  }
  return (
    `Cota semanal ${usado.toFixed(0)}% (esperado ${ideal.toFixed(0)}%) ${sinal} ` +
    `· projeção ${projecao.toFixed(0)}% · reseta em ${dias.toFixed(1)}d${porDia}`
  )
}

// No desktop a sessão não repassa rateLimits; o app tem a cota em ccd_session_mgmt.get_usage.
let erroDoApp = ''
// Última leitura boa do app: o get_usage às vezes responde "indisponível" e a sessão traz outro arredondamento.
let ultimaDoApp: Janela[] = []
type JanelaDoApp = { label: string; percentUsed: number; resetsAt?: string }

async function janelasDoApp($: EngineInterface): Promise<Janela[]> {
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'get_usage', {})
    if (r.isError) { erroDoApp = 'get_usage falhou'; return ultimaDoApp }
    const bloco = r.content.find(c => c.type === 'text') as { text: string } | undefined
    const dados = r.structuredContent ?? (bloco ? JSON.parse(bloco.text) : undefined)
    const janelas: JanelaDoApp[] = dados?.plan?.windows ?? []
    const semana = janelas.find(j => /weekly/i.test(j.label) && /all models/i.test(j.label))
    if (semana) ultimaDoApp = [{ kind: 'seven_day', percentUsed: semana.percentUsed, resetsAt: semana.resetsAt }]
    return ultimaDoApp
  } catch (err) {
    erroDoApp = String(err).slice(0, 120)
    return ultimaDoApp
  }
}

// O card do app (get_usage) vem primeiro; o cabeçalho da API (rateLimits) atrasa e arredonda diferente.
async function atualiza($: EngineInterface): Promise<string | undefined> {
  const doApp = await janelasDoApp($)
  const janelas = doApp.length ? doApp : (await $.session.usage()).rateLimits
  const agora = await $.clock.now()
  $.ui.status(linha(janelas, agora, true))
  return janelas.some(x => x.kind === 'seven_day') ? linha(janelas, agora) : undefined
}

export const register: Register = on => {
  on('prompt.submit', ($, e, next) => {
    void atualiza($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await atualiza($)
    return next(e)
  })

  on('command.run', { command: 'cota' }, async $ => {
    const t = await atualiza($)
    return { text: t ?? 'Cota semanal: sem dado ainda.' }
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cota', description: 'Mostra o ritmo da cota semanal' })
    // No começo da sessão o app pode ainda não responder: tenta a cada 10 s até ter dado.
    let tentativas = 0
    const inicio = $.clock.every(10_000, async () => {
      tentativas += 1
      if ((await atualiza($)) || tentativas >= 30) inicio.cancel()
    })
    void atualiza($)
    $.clock.every(MIN_MS, () => void atualiza($))
    return next(e)
  })
}
