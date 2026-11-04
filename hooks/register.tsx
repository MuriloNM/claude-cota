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
// O get_usage responde "indisponível" se consultado demais: no máximo uma consulta a cada 5 min,
// e a última leitura boa fica no $.store, valendo entre sessões.
const INTERVALO_APP_MS = 5 * MIN_MS
type Leitura = { percentUsed: number; resetsAt: string; lido: number }
type JanelaDoApp = { label: string; percentUsed: number; resetsAt?: string }
let erroDoApp = ''
// Só avisa quando há prova de duas contas na mesma chave e nenhum perfil definido (chave "padrao").
let semPerfil = false
let conflito = false
const AVISO = 'Duas contas usando o mesmo perfil: defina CLAUDE_PERFIL em cada app (veja o README do plugin).'
let fonte = ''
let ultimaConsulta = 0

// Cada perfil/conta tem a sua leitura guardada. Quem abre mais de um app (conta pessoal e do trabalho) marca o perfil
// com CLAUDE_PERFIL no atalho; sem isso vale o CLAUDE_CONFIG_DIR; sem nenhum dos dois, o perfil é "padrao".
async function chavePerfil($: EngineInterface): Promise<string> {
  const bruto = (await $.env.get('CLAUDE_PERFIL')) || (await $.env.get('CLAUDE_CONFIG_DIR')) || 'padrao'
  return 'ultima:' + bruto.replace(/[^\w.-]+/g, '_').slice(-60)
}

async function leituraDoApp($: EngineInterface, agora: number): Promise<Leitura | undefined> {
  const chave = await chavePerfil($)
  semPerfil = chave === 'ultima:padrao'
  const guardada = (await $.store.get(chave)) as Leitura | undefined
  if (agora - ultimaConsulta < INTERVALO_APP_MS) return guardada
  ultimaConsulta = agora
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'get_usage', {})
    if (r.isError) { erroDoApp = 'get_usage falhou'; return guardada }
    const bloco = r.content.find(c => c.type === 'text') as { text: string } | undefined
    const dados = r.structuredContent ?? (bloco ? JSON.parse(bloco.text) : undefined)
    const janelas: JanelaDoApp[] = dados?.plan?.windows ?? []
    const semana = janelas.find(j => /weekly/i.test(j.label) && /all models/i.test(j.label))
    if (!semana?.resetsAt) { erroDoApp = dados?.plan?.status ?? 'sem janela semanal'; return guardada }
    erroDoApp = ''
    const nova: Leitura = { percentUsed: semana.percentUsed, resetsAt: semana.resetsAt, lido: agora }
    // Leitura ainda válida, de outro reset: outra conta gravou nesta mesma chave.
    if (semPerfil && guardada && Date.parse(guardada.resetsAt) > agora &&
        Math.abs(Date.parse(guardada.resetsAt) - Date.parse(nova.resetsAt)) >= TOLERANCIA_RESET_MS) conflito = true
    await $.store.set(chave, nova)
    return nova
  } catch (err) {
    erroDoApp = String(err).slice(0, 120)
    return guardada
  }
}

// O card do app é a referência. A sessão (rateLimits) mede o mesmo uso por outro caminho e pode divergir alguns
// pontos para mais ou para menos, então só entra quando não há leitura do card da última hora (no terminal, por
// exemplo, que não tem o card, mas reaproveita a leitura que o desktop guardou).
const VALIDADE_APP_MS = 60 * MIN_MS
const TOLERANCIA_RESET_MS = 30 * MIN_MS
async function atualiza($: EngineInterface): Promise<string | undefined> {
  const agora = await $.clock.now()
  const app = await leituraDoApp($, agora)
  const sessao = (await $.session.usage()).rateLimits.find(x => x.kind === 'seven_day')
  // O store é da máquina inteira: outra conta ou projeto pode ter gravado ali. A sessão sabe a que conta pertence;
  // se o resetsAt guardado não bate com o dela, a leitura é de outra conta e não vale.
  const mesmaConta = !app || !sessao?.resetsAt ||
    Math.abs(Date.parse(app.resetsAt) - Date.parse(sessao.resetsAt)) < TOLERANCIA_RESET_MS
  const daSemana = app && mesmaConta && Date.parse(app.resetsAt) > agora ? app : undefined
  if (app && !mesmaConta && semPerfil) conflito = true
  if (app && !mesmaConta) erroDoApp = (erroDoApp ? erroDoApp + '; ' : '') + 'leitura guardada de outra conta descartada'
  const recente = daSemana && agora - daSemana.lido < VALIDADE_APP_MS ? daSemana : undefined
  let janela: Janela | undefined
  if (recente) {
    janela = { kind: 'seven_day', percentUsed: recente.percentUsed, resetsAt: recente.resetsAt }
  } else if (sessao) {
    janela = { ...sessao, percentUsed: Math.ceil(sessao.percentUsed) }
  } else if (daSemana) {
    janela = { kind: 'seven_day', percentUsed: daSemana.percentUsed, resetsAt: daSemana.resetsAt }
  }
  const minutos = daSemana ? Math.round((agora - daSemana.lido) / MIN_MS) : 0
  fonte = (recente || (!sessao && daSemana)) ? `app (lido há ${minutos} min)${erroDoApp ? `; última consulta: ${erroDoApp}` : ''}` : sessao ? 'sessão' : 'nenhuma'
  const janelas = janela ? [janela] : []
  const curta = linha(janelas, agora, true)
  $.ui.status(curta && conflito ? curta + ' ⚠ perfil' : curta)
  return janela ? linha(janelas, agora) : undefined
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    await atualiza($)
    return next(e)
  })

  on('command.run', { command: 'cota' }, async $ => {
    const t = await atualiza($)
    return { text: `${t ?? 'Cota semanal: sem dado ainda.'}
fonte: ${fonte}${conflito ? '\n⚠ ' + AVISO : ''}` }
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cota', description: 'Mostra o ritmo da cota semanal' })
    // Mostra já a última leitura guardada; depois atualiza a cada resposta.
    void atualiza($)
    return next(e)
  })
}
