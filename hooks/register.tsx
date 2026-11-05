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

// O cartão do /cota se desenha do texto da própria linha: cada /cota antigo da conversa continua mostrando a sua leitura,
// e o modelo e as superfícies sem desenho seguem lendo o mesmo texto.
type Sinal = 'folga' | 'ritmo' | 'acima'
export type Cartao = {
  usado: number; ideal: number; sinal: Sinal; projecao: number; dias: number
  porDia?: number; fonte?: string; aviso?: string
}
const SINAIS: Record<Sinal, { nome: string; cor: string; tema: 'success' | 'warning' | 'error' }> = {
  folga: { nome: 'Folga', cor: '#0ca30c', tema: 'success' },
  ritmo: { nome: 'No ritmo', cor: '#fab219', tema: 'warning' },
  acima: { nome: 'Acima do ritmo', cor: '#d03b3b', tema: 'error' },
}

export function leCartao(texto: string): Cartao | undefined {
  const m = /Cota semanal (\d+)% \(esperado (\d+)%\) (🔴|🟢|🟡)[^·]*· projeção (\d+)% · reseta em ([\d.]+)d(?: · pode gastar (\d+)%\/dia)?/u.exec(texto)
  if (!m) return undefined
  const sinal: Sinal = m[3] === '🟢' ? 'folga' : m[3] === '🔴' ? 'acima' : 'ritmo'
  return {
    usado: Number(m[1]), ideal: Number(m[2]), sinal, projecao: Number(m[4]), dias: Number(m[5]),
    porDia: m[6] === undefined ? undefined : Number(m[6]),
    fonte: /^fonte: (.*)$/mu.exec(texto)?.[1],
    aviso: /^⚠ (.*)$/mu.exec(texto)?.[1],
  }
}

function prazo(dias: number): string {
  return dias < 1 ? `${Math.round(dias * 24)} h` : `${dias.toFixed(1).replace('.', ',')} ${dias < 2 ? 'dia' : 'dias'}`
}

function xml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Vira imagem isolada: sem acesso ao tema do app. As cores claras vão nos atributos e o CSS só escurece,
// e o cartão tem fundo próprio, então continua legível mesmo se o tema do app e o do sistema divergirem.
export function cartaoSvg(c: Cartao): string {
  const { nome, cor } = SINAIS[c.sinal]
  const L = 520, X0 = 24, BARRA = L - 2 * X0, Y = 102, H = 12
  const px = (p: number) => X0 + (Math.min(Math.max(p, 0), 100) / 100) * BARRA
  const pxUso = px(c.usado), pxProj = px(c.projecao), pxIdeal = px(c.ideal)
  const ancora = pxIdeal < 80 ? 'start' : pxIdeal > L - 80 ? 'end' : 'middle'
  const largPill = nome.length * 7 + 32
  const xPill = L - X0 - largPill
  const altura = c.aviso ? 222 : 204
  const tiles = [
    { x: X0, rot: 'Fecha a semana em', val: `${c.projecao}%`, amostra: true },
    { x: X0 + 180, rot: 'Reseta em', val: prazo(c.dias), amostra: false },
    { x: X0 + 310, rot: 'Pode gastar', val: c.porDia === undefined ? '—' : `${c.porDia}% / dia`, amostra: false },
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${altura}" viewBox="0 0 ${L} ${altura}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif">
<style>@media (prefers-color-scheme:dark){.bg{fill:#1a1a19;stroke:#33332f}.ink{fill:#f0efea}.mut{fill:#a3a29c}.trk{fill:#33332f}.tick{stroke:#f0efea}}</style>
<rect class="bg" x="0.5" y="0.5" width="${L - 1}" height="${altura - 1}" rx="12" fill="#fcfcfb" stroke="#e7e6e2"/>
<text class="mut" x="${X0}" y="32" font-size="13" fill="#6b6a65">Cota semanal</text>
<rect x="${xPill}" y="16" width="${largPill}" height="24" rx="12" fill="${cor}" fill-opacity="0.16"/>
<circle cx="${xPill + 13}" cy="28" r="4" fill="${cor}"/>
<text class="ink" x="${xPill + 23}" y="32" font-size="12" font-weight="600" fill="#1f1f1d">${nome}</text>
<text class="ink" x="${X0}" y="74" fill="#1f1f1d"><tspan font-size="38" font-weight="600">${c.usado}%</tspan><tspan class="mut" dx="8" font-size="13" fill="#6b6a65">da cota usada</tspan></text>
<text class="mut" x="${pxIdeal}" y="94" text-anchor="${ancora}" font-size="11" fill="#6b6a65">esperado hoje ${c.ideal}%</text>
<rect class="trk" x="${X0}" y="${Y}" width="${BARRA}" height="${H}" rx="6" fill="#e7e6e2"/>
${pxProj > pxUso ? `<rect x="${X0}" y="${Y}" width="${pxProj - X0}" height="${H}" rx="6" fill="${cor}" fill-opacity="0.3"/>` : ''}
${c.usado > 0 ? `<rect x="${X0}" y="${Y}" width="${Math.max(pxUso - X0, H)}" height="${H}" rx="6" fill="${cor}"/>` : ''}
<line class="tick" x1="${pxIdeal}" x2="${pxIdeal}" y1="${Y - 3}" y2="${Y + H + 3}" stroke="#1f1f1d" stroke-width="2"/>
${tiles.map(t => `<g>${t.amostra ? `<rect x="${t.x}" y="134" width="10" height="10" rx="3" fill="${cor}" fill-opacity="0.3"/>` : ''}<text class="mut" x="${t.x + (t.amostra ? 15 : 0)}" y="143" font-size="11" fill="#6b6a65">${t.rot}</text><text class="ink" x="${t.x}" y="167" font-size="18" font-weight="600" fill="#1f1f1d">${t.val}</text></g>`).join('')}
${c.fonte ? `<text class="mut" x="${X0}" y="191" font-size="10" fill="#6b6a65">fonte: ${xml(c.fonte.slice(0, 90))}</text>` : ''}
${c.aviso ? `<text x="${X0}" y="209" font-size="10" fill="#d03b3b">⚠ ${xml(c.aviso.slice(0, 95))}</text>` : ''}
</svg>`
}

// A mesma barra em células, para o terminal (que não desenha Svg): █ usado, ▒ até a projeção, ░ o resto.
export function barraTexto(c: Cartao, largura: number): { usado: string; projetado: string; resto: string; marca: string } {
  const cel = (p: number) => Math.round((Math.min(Math.max(p, 0), 100) / 100) * largura)
  const u = cel(c.usado), p = Math.max(cel(c.projecao), u)
  return {
    usado: '█'.repeat(u), projetado: '▒'.repeat(p - u), resto: '░'.repeat(largura - p),
    marca: ' '.repeat(Math.max(Math.min(cel(c.ideal), largura - 1), 0)) + '▲',
  }
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

// Para a pílula (cota-barra): a janela de 5 h, em planos que têm, e a semana de cada modelo, como a do Fable.
async function guardarOutrasJanelas($: EngineInterface, perfil: string, janelas: JanelaDoApp[], agora: number) {
  const cinco = janelas.find(j => /\b(5|five)[\s-]*h/i.test(j.label))
  if (cinco?.resetsAt) await $.store.set('cinco_horas:' + perfil, { percentUsed: cinco.percentUsed, resetsAt: cinco.resetsAt, lido: agora })
  const modelos = janelas
    .filter(j => j.resetsAt && /weekly/i.test(j.label) && !/all models/i.test(j.label))
    .map(j => ({ nome: j.label.split('·').pop()!.trim(), percentUsed: j.percentUsed, resetsAt: j.resetsAt }))
  await $.store.set('modelos:' + perfil, { lido: agora, janelas: modelos })
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
    await guardarOutrasJanelas($, chave.slice('ultima:'.length), janelas, agora)
    const semana = janelas.find(j => /weekly/i.test(j.label) && /all models/i.test(j.label))
    if (!semana?.resetsAt) { erroDoApp = dados?.plan?.status ?? 'sem janela semanal'; return guardada }
    erroDoApp = ''
    const nova: Leitura = { percentUsed: semana.percentUsed, resetsAt: semana.resetsAt, lido: agora }
    // Leitura ainda válida, de outro reset: outra conta gravou nesta mesma chave.
    if (semPerfil && guardada && Date.parse(guardada.resetsAt) > agora &&
        Math.abs(Date.parse(guardada.resetsAt) - Date.parse(nova.resetsAt)) >= TOLERANCIA_RESET_MS) conflito = true
    await $.store.set(chave, nova)
    return nova
  } catch {
    // A consulta nem foi respondida (servidor do app desconectado): não gasta o intervalo de 5 min e tenta de novo
    // na próxima vez. O limite do get_usage volta como dado, não como exceção, e segue respeitando o intervalo.
    ultimaConsulta = 0
    erroDoApp = 'app sem resposta agora'
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
  const idade = minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h${minutos % 60 ? ` ${minutos % 60} min` : ''}`
  fonte = (recente || (!sessao && daSemana)) ? `app (lido há ${idade})${erroDoApp ? `; ${erroDoApp}` : ''}` : sessao ? 'sessão' : 'nenhuma'
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

  on('ui.render', { component: 'CommandOutput', props: { command: 'cota' } }, ($, e, next) => {
    const c = leCartao(e.props.text)
    if (!c) return next(e)
    const alt = e.props.text
    if (e.surface !== 'terminal') {
      const { Svg } = $.ui.resolve(e)
      return <Svg source={cartaoSvg(c)} alt={alt} />
    }
    const { Box, Text } = $.ui.resolve(e)
    const { nome, tema } = SINAIS[c.sinal]
    const b = barraTexto(c, Math.min(40, Math.max(10, (e.viewport?.columns ?? 80) - 4)))
    return (
      <Box flexDirection="column">
        <Text>
          <Text bold>Cota semanal {c.usado}%</Text>  <Text color={tema}>● {nome}</Text>
        </Text>
        <Text>
          <Text color={tema}>{b.usado}{b.projetado}</Text>
          <Text dimColor>{b.resto}</Text>
        </Text>
        <Text dimColor>{b.marca} esperado hoje {c.ideal}%</Text>
        <Text>
          fecha em {c.projecao}% · reseta em {prazo(c.dias)}{c.porDia === undefined ? '' : ` · pode gastar ${c.porDia}%/dia`}
        </Text>
        {c.fonte !== undefined && <Text dimColor>fonte: {c.fonte}</Text>}
        {c.aviso !== undefined && <Text color="warning">⚠ {c.aviso}</Text>}
      </Box>
    )
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cota', description: 'Mostra o ritmo da cota semanal' })
    // Mostra já a última leitura guardada; depois atualiza a cada resposta.
    void atualiza($)
    return next(e)
  })
}
