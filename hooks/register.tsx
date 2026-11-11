import type { EngineInterface, Register } from 'claude-code'


const SEMANA_MS = 7 * 24 * 3600 * 1000
const MIN_MS = 60_000

type Janela = { kind: string; percentUsed: number; resetsAt?: string }
type Sinal = 'folga' | 'ritmo' | 'acima'

// Os textos seguem o idioma do Claude (linha `language` do /config, texto livre como "Pt-br" ou "japanese").
// Sem essa linha, vale o idioma do sistema; idioma sem tradução aqui cai no inglês.
type Textos = {
  cota: string; usada: string; folga: string; ritmo: string; acima: string
  esperadoHoje: string; esperado: string; fecha: string; reseta: string; gastar: string; projecao: string
  semana: string; fonte: string; app: (idade: string) => string; sessao: string; nenhuma: string
  semResposta: string; outraConta: string; semDado: string; aviso: string
  dia: string; dias: string; porDia: string; virgula?: boolean; colado?: boolean
}
const TEXTOS: Record<'pt' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'ja' | 'ko' | 'zh', Textos> = {
  pt: {
    cota: 'Cota semanal', usada: 'da cota usada', folga: 'Folga', ritmo: 'No ritmo', acima: 'Acima do ritmo',
    esperadoHoje: 'esperado hoje', esperado: 'esperado', fecha: 'Fecha a semana em', reseta: 'Reseta em', gastar: 'Pode gastar', projecao: 'projeção',
    semana: 'Semana', fonte: 'fonte', app: i => `app (lido há ${i})`, sessao: 'sessão', nenhuma: 'nenhuma',
    semResposta: 'app sem resposta agora', outraConta: 'leitura de outra conta descartada', semDado: 'sem dado ainda',
    aviso: 'Duas contas usando o mesmo perfil: defina CLAUDE_PERFIL em cada app (veja o README do plugin).',
    dia: 'dia', dias: 'dias', porDia: 'dia', virgula: true,
  },
  en: {
    cota: 'Weekly usage', usada: 'of limit used', folga: 'Room to spare', ritmo: 'On pace', acima: 'Over pace',
    esperadoHoje: 'expected today', esperado: 'expected', fecha: 'Week ends at', reseta: 'Resets in', gastar: 'Can spend', projecao: 'projected',
    semana: 'Week', fonte: 'source', app: i => `app (read ${i} ago)`, sessao: 'session', nenhuma: 'none',
    semResposta: 'app not responding right now', outraConta: 'reading from another account discarded', semDado: 'no data yet',
    aviso: 'Two accounts share one profile: set CLAUDE_PERFIL in each app (see the plugin README).',
    dia: 'day', dias: 'days', porDia: 'day',
  },
  es: {
    cota: 'Cuota semanal', usada: 'de la cuota usada', folga: 'Holgura', ritmo: 'Al ritmo', acima: 'Por encima del ritmo',
    esperadoHoje: 'esperado hoy', esperado: 'esperado', fecha: 'Cierra la semana en', reseta: 'Se reinicia en', gastar: 'Puedes gastar', projecao: 'proyección',
    semana: 'Semana', fonte: 'fuente', app: i => `app (leído hace ${i})`, sessao: 'sesión', nenhuma: 'ninguna',
    semResposta: 'la app no responde ahora', outraConta: 'lectura de otra cuenta descartada', semDado: 'aún sin datos',
    aviso: 'Dos cuentas comparten un perfil: define CLAUDE_PERFIL en cada app (ver el README del plugin).',
    dia: 'día', dias: 'días', porDia: 'día', virgula: true,
  },
  fr: {
    cota: 'Quota hebdomadaire', usada: 'du quota utilisé', folga: 'Marge', ritmo: 'Dans le rythme', acima: 'Au-dessus du rythme',
    esperadoHoje: 'attendu aujourd’hui', esperado: 'attendu', fecha: 'Fin de semaine à', reseta: 'Réinitialisé dans', gastar: 'Disponible', projecao: 'projection',
    semana: 'Semaine', fonte: 'source', app: i => `app (lu il y a ${i})`, sessao: 'session', nenhuma: 'aucune',
    semResposta: 'l’app ne répond pas', outraConta: 'lecture d’un autre compte ignorée', semDado: 'pas encore de données',
    aviso: 'Deux comptes partagent un profil : définissez CLAUDE_PERFIL dans chaque app (voir le README).',
    dia: 'jour', dias: 'jours', porDia: 'jour', virgula: true,
  },
  de: {
    cota: 'Wochenkontingent', usada: 'des Kontingents genutzt', folga: 'Spielraum', ritmo: 'Im Plan', acima: 'Über dem Plan',
    esperadoHoje: 'heute erwartet', esperado: 'erwartet', fecha: 'Woche endet bei', reseta: 'Zurückgesetzt in', gastar: 'Verfügbar', projecao: 'Prognose',
    semana: 'Woche', fonte: 'Quelle', app: i => `App (vor ${i} gelesen)`, sessao: 'Sitzung', nenhuma: 'keine',
    semResposta: 'App antwortet gerade nicht', outraConta: 'Messwert eines anderen Kontos verworfen', semDado: 'noch keine Daten',
    aviso: 'Zwei Konten teilen ein Profil: CLAUDE_PERFIL in jeder App setzen (siehe Plugin-README).',
    dia: 'Tag', dias: 'Tage', porDia: 'Tag', virgula: true,
  },
  it: {
    cota: 'Quota settimanale', usada: 'della quota usata', folga: 'Margine', ritmo: 'In linea', acima: 'Sopra il ritmo',
    esperadoHoje: 'previsto oggi', esperado: 'previsto', fecha: 'Fine settimana a', reseta: 'Si azzera tra', gastar: 'Puoi usare', projecao: 'proiezione',
    semana: 'Settimana', fonte: 'fonte', app: i => `app (letto ${i} fa)`, sessao: 'sessione', nenhuma: 'nessuna',
    semResposta: 'l’app non risponde ora', outraConta: 'lettura di un altro account scartata', semDado: 'ancora nessun dato',
    aviso: 'Due account condividono un profilo: imposta CLAUDE_PERFIL in ogni app (vedi il README).',
    dia: 'giorno', dias: 'giorni', porDia: 'giorno', virgula: true,
  },
  ja: {
    cota: '週間クォータ', usada: '使用済み', folga: '余裕あり', ritmo: '順調', acima: 'ペース超過',
    esperadoHoje: '今日の目安', esperado: '目安', fecha: '週末の見込み', reseta: 'リセットまで', gastar: '使用可能', projecao: '見込み',
    semana: '週', fonte: 'ソース', app: i => `アプリ（${i}前に取得）`, sessao: 'セッション', nenhuma: 'なし',
    semResposta: 'アプリの応答なし', outraConta: '別アカウントの値を破棄', semDado: 'データなし',
    aviso: '2つのアカウントが同じプロファイルを使用中：各アプリで CLAUDE_PERFIL を設定してください（README 参照）。',
    dia: '日', dias: '日', porDia: '日', colado: true,
  },
  ko: {
    cota: '주간 할당량', usada: '사용됨', folga: '여유', ritmo: '적정', acima: '초과',
    esperadoHoje: '오늘 예상', esperado: '예상', fecha: '주말 예상', reseta: '초기화까지', gastar: '사용 가능', projecao: '예상치',
    semana: '주간', fonte: '출처', app: i => `앱 (${i} 전 읽음)`, sessao: '세션', nenhuma: '없음',
    semResposta: '앱 응답 없음', outraConta: '다른 계정 값 무시', semDado: '데이터 없음',
    aviso: '두 계정이 같은 프로필을 사용 중: 각 앱에서 CLAUDE_PERFIL을 설정하세요 (README 참고).',
    dia: '일', dias: '일', porDia: '일', colado: true,
  },
  zh: {
    cota: '每周配额', usada: '已使用', folga: '宽裕', ritmo: '正常', acima: '超速',
    esperadoHoje: '今日预期', esperado: '预期', fecha: '周末预计', reseta: '重置还有', gastar: '可用', projecao: '预计',
    semana: '本周', fonte: '来源', app: i => `应用（${i}前读取）`, sessao: '会话', nenhuma: '无',
    semResposta: '应用暂无响应', outraConta: '已丢弃其他账户的读数', semDado: '暂无数据',
    aviso: '两个账户共用一个配置：请在每个应用中设置 CLAUDE_PERFIL（见 README）。',
    dia: '天', dias: '天', porDia: '天', colado: true,
  },
}

function traducao(nome: string): Textos | undefined {
  const n = nome.trim().toLowerCase()
  if (/^(pt|port)/.test(n)) return TEXTOS.pt
  if (/^(en\b|en[-_]|eng|ingl)/.test(n)) return TEXTOS.en
  if (/^(es\b|es[-_]|span|espa)/.test(n)) return TEXTOS.es
  if (/^(fr\b|fr[-_]|fren|fran)/.test(n)) return TEXTOS.fr
  if (/^(de\b|de[-_]|germ|deut|alem)/.test(n)) return TEXTOS.de
  if (/^(it\b|it[-_]|ital)/.test(n)) return TEXTOS.it
  if (/^(ja\b|ja[-_]|jap|日本)/.test(n)) return TEXTOS.ja
  if (/^(ko\b|ko[-_]|kor|한국)/.test(n)) return TEXTOS.ko
  if (/^(zh\b|zh[-_]|chin|中文|简体|繁體)/.test(n)) return TEXTOS.zh
  return undefined
}

export function textosDe(language: string | undefined, sistema: string): Textos {
  if (language) return traducao(language) ?? TEXTOS.en
  return traducao(sistema) ?? TEXTOS.en
}

async function idioma($: EngineInterface): Promise<Textos> {
  let language: string | undefined
  try {
    const v = (await $.config.list()).find(l => l.key === 'language')?.value
    if (typeof v === 'string' && v.trim()) language = v
  } catch { /* sem /config: fica o idioma do sistema */ }
  return textosDe(language, Intl.DateTimeFormat().resolvedOptions().locale)
}

const EMOJI: Record<Sinal, string> = { folga: '🟢', ritmo: '🟡', acima: '🔴' }

// Dias que contam no ritmo, por perfil: só alguns dias da semana (0 = domingo) e folgas por data, como um feriado.
// Ficam em ~/.cota-barra/dias.json, que o /cota dias e o /cota folga gravam e a pílula do cota-barra também lê e grava.
// As horas de sono ("0-6", início e fim) saem do esperado em todo dia que conta. Início igual ao fim: nada sai.
export type DiasConta = { semana?: string; folgas?: string[]; sono?: string }
const SONO_PADRAO = '0-6'
async function arquivoDias($: EngineInterface): Promise<string | undefined> {
  const casa = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME'))
  return casa ? `${casa.replace(/[\\/]+$/, '')}/.cota-barra/dias.json` : undefined
}
async function lerDias($: EngineInterface): Promise<Record<string, DiasConta>> {
  const arq = await arquivoDias($)
  if (!arq) return {}
  try {
    const j = JSON.parse(String(await $.fs.read(arq)))
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {}
  } catch { return {} }
}
export function dataLocal(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function semanaDe(d: DiasConta): string { return d.semana && /[0-6]/.test(d.semana) ? d.semana : '0123456' }
function contaNoDia(d: DiasConta, ms: number): boolean {
  return semanaDe(d).includes(String(new Date(ms).getDay())) && !(d.folgas ?? []).includes(dataLocal(ms))
}
function sonoDe(d: DiasConta): [number, number] {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(d.sono ?? SONO_PADRAO)
  const ini = Number(m?.[1]), fim = Number(m?.[2])
  return m && ini <= 23 && fim <= 23 ? [ini, fim] : [0, 6]
}
function horasAcordado(d: DiasConta): number {
  const [ini, fim] = sonoDe(d)
  return 24 - (fim - ini + 24) % 24
}
// Tempo, em ms, dos dias que contam entre dois instantes, sem as horas de sono.
export function ativoMs(a: number, b: number, d: DiasConta): number {
  let total = 0
  const [sonoIni, sonoFim] = sonoDe(d)
  const dia = new Date(a); dia.setHours(0, 0, 0, 0)
  while (dia.getTime() < b) {
    const ini = dia.getTime()
    const hora = (h: number) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h).getTime()
    const cruza = (i: number, f: number) => Math.max(0, Math.min(b, f) - Math.max(a, i))
    const sono = sonoIni === sonoFim ? 0
      : sonoIni < sonoFim ? cruza(hora(sonoIni), hora(sonoFim))
      : cruza(hora(0), hora(sonoFim)) + cruza(hora(sonoIni), hora(24))
    const fimDia = hora(24)
    if (contaNoDia(d, ini)) total += cruza(ini, fimDia) - sono
    dia.setDate(dia.getDate() + 1)
  }
  return total
}

// Histórico de leituras que a pílula do cota-barra grava. O plugin só lê; sem pílula o arquivo não existe, e a projeção fica pela média.
export type Ponto = { lido: number; usado: number; reset: number }
const GUARDAR_DIAS = 56, DIAS_PARA_CONFIAR = 7
export function pontosDoHistorico(texto: string, conta: string, agora: number): Ponto[] {
  const pontos: Ponto[] = []
  for (const l of texto.split(/\r?\n/)) {
    const p = l.split('\t')
    if (p.length !== 4 || p[0] !== conta) continue
    const lido = Number(p[1]), usado = Number(p[2]), reset = Date.parse(p[3])
    if (Number.isFinite(lido) && Number.isFinite(usado) && Number.isFinite(reset) && lido >= agora - GUARDAR_DIAS * 86_400_000) pontos.push({ lido, usado, reset })
  }
  return pontos
}
async function lerHistorico($: EngineInterface, conta: string, agora: number): Promise<Ponto[]> {
  try {
    const arq = await arquivoDias($)
    return arq ? pontosDoHistorico(String(await $.fs.read(arq.replace(/dias\.json$/, 'historico.tsv'))), conta, agora) : []
  } catch { return [] }
}
const inicioDoDia = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }
const somaDias = (ms: number, n: number) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime() }
// Quanto se gasta num dia comum. A mesma conta da pílula: dias sem uso entram; a partir de 3 dias, o maior fica de fora;
// sem leitura por dias seguidos, o que subiu se divide entre eles; hoje e o primeiro dia, pela metade, não entram.
export function diaTipico(historico: readonly Ponto[], agora: number, d: DiasConta): { porDia: number; dias: number } {
  if (!historico.length) return { porDia: 0, dias: 0 }
  const pts = [...historico].sort((a, b) => a.lido - b.lido)
  const porDia = new Map<number, number>(), semDado = new Set<number>()
  for (let i = 1; i < pts.length; i++) {
    const mesmaSemana = Math.abs(pts[i].reset - pts[i - 1].reset) <= 5 * MIN_MS
    const delta = mesmaSemana ? Math.max(pts[i].usado - pts[i - 1].usado, 0) : pts[i].usado
    const dia = inicioDoDia(pts[i].lido)
    let de = somaDias(inicioDoDia(pts[i - 1].lido), 1)
    if (!mesmaSemana) {
      const inicio = inicioDoDia(pts[i].reset - SEMANA_MS)
      for (let x = de; x < inicio && x < dia; x = somaDias(x, 1)) semDado.add(x)
      if (inicio > de) de = inicio
    }
    const vao: number[] = []
    for (let x = de; x <= dia; x = somaDias(x, 1)) if (contaNoDia(d, x)) vao.push(x)
    if (!vao.length) vao.push(dia)
    for (const x of vao) porDia.set(x, (porDia.get(x) ?? 0) + delta / vao.length)
  }
  const primeiro = inicioDoDia(pts[0].lido), valores: number[] = []
  for (let x = somaDias(inicioDoDia(agora), -1); x > primeiro && valores.length < 28; x = somaDias(x, -1)) {
    if (semDado.has(x) || !contaNoDia(d, x)) continue
    valores.push(porDia.get(x) ?? 0)
  }
  if (!valores.length) return { porDia: 0, dias: 0 }
  valores.sort((a, b) => a - b)
  const usar = valores.length >= 3 ? valores.length - 1 : valores.length
  return { porDia: valores.slice(0, usar).reduce((a, b) => a + b, 0) / usar, dias: valores.length }
}

function linha(janelas: readonly Janela[], agora: number, t: Textos, curta = false, contam?: DiasConta, historico: readonly Ponto[] = []): string | undefined {
  const j = janelas.find(x => x.kind === 'seven_day')
  if (!j || !j.resetsAt) {
    return `${t.cota}: ${t.semDado}${appSemResposta ? ` (${t.semResposta})` : ''}`
  }
  const fim = Date.parse(j.resetsAt)
  const resta = fim - agora
  if (Number.isNaN(resta)) return undefined
  let decorrido = Math.min(Math.max(1 - resta / SEMANA_MS, 0), 1)
  let diasQueContam = Math.max(resta, 0) / 86_400_000
  // O esperado só anda nos dias que contam; nos outros, fica parado.
  if (contam) {
    const total = ativoMs(fim - SEMANA_MS, fim, contam)
    if (total > 0) {
      decorrido = Math.min(Math.max(ativoMs(fim - SEMANA_MS, agora, contam) / total, 0), 1)
      diasQueContam = ativoMs(agora, fim, contam) / (horasAcordado(contam) * 3_600_000)   // em dias inteiros, para o "por dia"
    }
  }
  const ideal = decorrido * 100
  const usado = j.percentUsed
  const dif = usado - ideal
  let projecao = decorrido > 0.02 ? usado / decorrido : usado
  if (historico.length) {
    // A leitura de agora entra como a pílula faria, para os dois darem o mesmo número antes de ela registrar.
    const tipico = diaTipico([...historico, { lido: agora, usado, reset: fim }], agora, contam ?? {})
    if (tipico.dias > 0) {
      const peso = Math.min(tipico.dias / DIAS_PARA_CONFIAR, 1)
      projecao = Math.max(usado, peso * (usado + tipico.porDia * diasQueContam) + (1 - peso) * projecao)
    }
  }
  const dias = Math.max(resta, 0) / 86_400_000

  const sinal: Sinal = dif > 5 ? 'acima' : dif < -5 ? 'folga' : 'ritmo'
  const sobra = Math.max(100 - usado, 0)
  const porDia = diasQueContam > 0.05 ? ` · ${t.gastar} ${(sobra / diasQueContam).toFixed(0)}%/${t.porDia}` : ''

  if (curta) {
    return `${EMOJI[sinal]} ${t.semana} ${usado.toFixed(0)}% / ${ideal.toFixed(0)}% → ${projecao.toFixed(0)}%`
  }
  return (
    `${t.cota} ${usado.toFixed(0)}% (${t.esperado} ${ideal.toFixed(0)}%) ${EMOJI[sinal]} ${t[sinal]} ` +
    `· ${t.projecao} ${projecao.toFixed(0)}% · ${t.reseta} ${dias.toFixed(1)}d${porDia}`
  )
}

// O cartão do /cota se desenha do texto da própria linha: cada /cota antigo da conversa continua mostrando a sua leitura,
// e o modelo e as superfícies sem desenho seguem lendo o mesmo texto. A leitura vale para qualquer idioma: só olha os
// números, os emojis e os separadores, nunca as palavras.
export type Cartao = {
  usado: number; ideal: number; sinal: Sinal; projecao: number; dias: number
  porDia?: number; fonte?: string; aviso?: string
}
const COR: Record<Sinal, { cor: string; tema: 'success' | 'warning' | 'error' }> = {
  folga: { cor: '#0ca30c', tema: 'success' },
  ritmo: { cor: '#fab219', tema: 'warning' },
  acima: { cor: '#d03b3b', tema: 'error' },
}

export function leCartao(texto: string): Cartao | undefined {
  const [primeira = '', ...resto] = texto.split('\n')
  const m = /(\d+)% \([^)]*?(\d+)%\) (🔴|🟢|🟡)[^·]*·[^·]*?(\d+)%[^·]*·[^·\d]*([\d.]+)[^·]*(?:·[^·\d]*(\d+)%)?/u.exec(primeira)
  if (!m) return undefined
  const sinal: Sinal = m[3] === '🟢' ? 'folga' : m[3] === '🔴' ? 'acima' : 'ritmo'
  return {
    usado: Number(m[1]), ideal: Number(m[2]), sinal, projecao: Number(m[4]), dias: Number(m[5]),
    porDia: m[6] === undefined ? undefined : Number(m[6]),
    fonte: resto.find(l => l.trim() && !l.startsWith('⚠')),
    aviso: resto.find(l => l.startsWith('⚠'))?.replace(/^⚠\s*/u, ''),
  }
}

function prazo(dias: number, t: Textos): string {
  if (dias < 1) return `${Math.round(dias * 24)} h`
  const n = dias.toFixed(1)
  return `${t.virgula ? n.replace('.', ',') : n}${t.colado ? '' : ' '}${dias < 2 ? t.dia : t.dias}`
}

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Largura aproximada: letras de japonês, coreano e chinês ocupam quase o dobro.
function largura(s: string): number {
  return [...s].reduce((soma, c) => soma + (c.charCodeAt(0) > 0x2e7f ? 12.5 : 7), 0)
}

// Vira imagem isolada: sem acesso ao tema do app. As cores claras vão nos atributos e o CSS só escurece,
// e o cartão tem fundo próprio, então continua legível mesmo se o tema do app e o do sistema divergirem.
export function cartaoSvg(c: Cartao, t: Textos): string {
  const { cor } = COR[c.sinal]
  const nome = t[c.sinal]
  const L = 520, X0 = 24, BARRA = L - 2 * X0, Y = 102, H = 12
  const px = (p: number) => X0 + (Math.min(Math.max(p, 0), 100) / 100) * BARRA
  const pxUso = px(c.usado), pxProj = px(c.projecao), pxIdeal = px(c.ideal)
  const ancora = pxIdeal < 80 ? 'start' : pxIdeal > L - 80 ? 'end' : 'middle'
  const largPill = Math.ceil(largura(nome)) + 32
  const xPill = L - X0 - largPill
  const altura = c.aviso ? 222 : 204
  const tiles = [
    { x: X0, rot: t.fecha, val: `${c.projecao}%`, amostra: true },
    { x: X0 + 180, rot: t.reseta, val: prazo(c.dias, t), amostra: false },
    { x: X0 + 310, rot: t.gastar, val: c.porDia === undefined ? '—' : `${c.porDia}% / ${t.porDia}`, amostra: false },
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${altura}" viewBox="0 0 ${L} ${altura}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif">
<style>@media (prefers-color-scheme:dark){.bg{fill:#1a1a19;stroke:#33332f}.ink{fill:#f0efea}.mut{fill:#a3a29c}.trk{fill:#33332f}.tick{stroke:#f0efea}}</style>
<rect class="bg" x="0.5" y="0.5" width="${L - 1}" height="${altura - 1}" rx="12" fill="#fcfcfb" stroke="#e7e6e2"/>
<text class="mut" x="${X0}" y="32" font-size="13" fill="#6b6a65">${xml(t.cota)}</text>
<rect x="${xPill}" y="16" width="${largPill}" height="24" rx="12" fill="${cor}" fill-opacity="0.16"/>
<circle cx="${xPill + 13}" cy="28" r="4" fill="${cor}"/>
<text class="ink" x="${xPill + 23}" y="32" font-size="12" font-weight="600" fill="#1f1f1d">${xml(nome)}</text>
<text class="ink" x="${X0}" y="74" fill="#1f1f1d"><tspan font-size="38" font-weight="600">${c.usado}%</tspan><tspan class="mut" dx="8" font-size="13" fill="#6b6a65">${xml(t.usada)}</tspan></text>
<text class="mut" x="${pxIdeal}" y="94" text-anchor="${ancora}" font-size="11" fill="#6b6a65">${xml(t.esperadoHoje)} ${c.ideal}%</text>
<rect class="trk" x="${X0}" y="${Y}" width="${BARRA}" height="${H}" rx="6" fill="#e7e6e2"/>
${pxProj > pxUso ? `<rect x="${X0}" y="${Y}" width="${pxProj - X0}" height="${H}" rx="6" fill="${cor}" fill-opacity="0.3"/>` : ''}
${c.usado > 0 ? `<rect x="${X0}" y="${Y}" width="${Math.max(pxUso - X0, H)}" height="${H}" rx="6" fill="${cor}"/>` : ''}
<line class="tick" x1="${pxIdeal}" x2="${pxIdeal}" y1="${Y - 3}" y2="${Y + H + 3}" stroke="#1f1f1d" stroke-width="2"/>
${tiles.map(l => `<g>${l.amostra ? `<rect x="${l.x}" y="134" width="10" height="10" rx="3" fill="${cor}" fill-opacity="0.3"/>` : ''}<text class="mut" x="${l.x + (l.amostra ? 15 : 0)}" y="143" font-size="11" fill="#6b6a65">${xml(l.rot)}</text><text class="ink" x="${l.x}" y="167" font-size="18" font-weight="600" fill="#1f1f1d">${xml(l.val)}</text></g>`).join('')}
${c.fonte ? `<text class="mut" x="${X0}" y="191" font-size="10" fill="#6b6a65">${xml(c.fonte.slice(0, 90))}</text>` : ''}
${c.aviso ? `<text x="${X0}" y="209" font-size="10" fill="#d03b3b">⚠ ${xml(c.aviso.slice(0, 95))}</text>` : ''}
</svg>`
}

// A mesma barra em células, para o terminal (que não desenha Svg): █ usado, ▒ até a projeção, ░ o resto.
export function barraTexto(c: Cartao, celulas: number): { usado: string; projetado: string; resto: string; marca: string } {
  const cel = (p: number) => Math.round((Math.min(Math.max(p, 0), 100) / 100) * celulas)
  const u = cel(c.usado), p = Math.max(cel(c.projecao), u)
  return {
    usado: '█'.repeat(u), projetado: '▒'.repeat(p - u), resto: '░'.repeat(celulas - p),
    marca: ' '.repeat(Math.max(Math.min(cel(c.ideal), celulas - 1), 0)) + '▲',
  }
}

// No desktop a sessão não repassa rateLimits; o app tem a cota em ccd_session_mgmt.get_usage.
// O get_usage responde "indisponível" se consultado demais: no máximo uma consulta a cada 5 min,
// e a última leitura boa fica no $.store, valendo entre sessões.
const INTERVALO_APP_MS = 5 * MIN_MS
type Leitura = { percentUsed: number; resetsAt: string; lido: number }
type JanelaDoApp = { label: string; percentUsed: number; resetsAt?: string }
let appSemResposta = false
let outraConta = false
// Só avisa quando há prova de duas contas na mesma chave e nenhum perfil definido (chave "padrao").
let semPerfil = false
let conflito = false
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
    if (r.isError) { appSemResposta = true; return guardada }
    const bloco = r.content.find(c => c.type === 'text') as { text: string } | undefined
    const dados = r.structuredContent ?? (bloco ? JSON.parse(bloco.text) : undefined)
    const janelas: JanelaDoApp[] = dados?.plan?.windows ?? []
    await guardarOutrasJanelas($, chave.slice('ultima:'.length), janelas, agora)
    const semana = janelas.find(j => /weekly/i.test(j.label) && /all models/i.test(j.label))
    if (!semana?.resetsAt) { appSemResposta = true; return guardada }
    appSemResposta = false
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
    appSemResposta = true
    return guardada
  }
}

// O card do app é a referência. A sessão (rateLimits) mede o mesmo uso por outro caminho e pode divergir alguns
// pontos para mais ou para menos, então só entra quando não há leitura do card da última hora (no terminal, por
// exemplo, que não tem o card, mas reaproveita a leitura que o desktop guardou).
const VALIDADE_APP_MS = 60 * MIN_MS
const TOLERANCIA_RESET_MS = 30 * MIN_MS
async function atualiza($: EngineInterface, t: Textos): Promise<string | undefined> {
  const agora = await $.clock.now()
  const app = await leituraDoApp($, agora)
  const sessao = (await $.session.usage()).rateLimits.find(x => x.kind === 'seven_day')
  // O store é da máquina inteira: outra conta ou projeto pode ter gravado ali. A sessão sabe a que conta pertence;
  // se o resetsAt guardado não bate com o dela, a leitura é de outra conta e não vale.
  const mesmaConta = !app || !sessao?.resetsAt ||
    Math.abs(Date.parse(app.resetsAt) - Date.parse(sessao.resetsAt)) < TOLERANCIA_RESET_MS
  const daSemana = app && mesmaConta && Date.parse(app.resetsAt) > agora ? app : undefined
  if (app && !mesmaConta && semPerfil) conflito = true
  outraConta = !!app && !mesmaConta
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
  const notas = [appSemResposta && t.semResposta, outraConta && t.outraConta].filter(Boolean).join('; ')
  fonte = (recente || (!sessao && daSemana)) ? `${t.app(idade)}${notas ? `; ${notas}` : ''}` : sessao ? t.sessao : t.nenhuma
  const janelas = janela ? [janela] : []
  const perfil = (await chavePerfil($)).slice('ultima:'.length)
  const contam = (await lerDias($))[perfil] ?? {}   // sem ajuste, vale o padrão: todos os dias, sem as horas de sono
  const historico = await lerHistorico($, perfil, agora)
  const curta = linha(janelas, agora, t, true, contam, historico)
  $.ui.status(curta && conflito ? curta + ' ⚠ perfil' : curta)
  return janela ? linha(janelas, agora, t, false, contam, historico) : undefined
}

// /cota dias seg-sex | seg,qua,sex | todos   ·   /cota folga 10/11 (marca ou desmarca) | limpar
const NOMES_DIA: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, 'sáb': 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}
const ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export function semanaDoTexto(s: string): string | undefined {
  const txt = s.trim().toLowerCase()
  if (/^(todos|all|every)/.test(txt)) return '0123456'
  const dias = new Set<number>()
  for (const parte of txt.split(/[\s,]+/).filter(Boolean)) {
    const [a, b] = parte.split('-')
    const ia = NOMES_DIA[a?.slice(0, 3) ?? ''], ib = b === undefined ? ia : NOMES_DIA[b.slice(0, 3)]
    if (ia === undefined || ib === undefined) return undefined
    for (let i = ia; ; i = (i + 1) % 7) { dias.add(i); if (i === ib) break }
  }
  return dias.size ? [...dias].sort().join('') : undefined
}
// /cota sono 23-5 | 23h-5h | nao | padrao
export function sonoDoTexto(s: string): string | undefined {
  const txt = s.trim().toLowerCase()
  if (/^(n[aã]o|nenhum|off|none)$/.test(txt)) return '0-0'
  if (/^(padr[aã]o|default)$/.test(txt)) return SONO_PADRAO
  const m = /^(\d{1,2})(?:h|:00)?\s*(?:-|a|às|as|to)\s*(\d{1,2})(?:h|:00)?$/.exec(txt)
  if (!m || Number(m[1]) > 24 || Number(m[2]) > 24) return undefined
  return `${Number(m[1]) % 24}-${Number(m[2]) % 24}`
}
function resumoDias(d: DiasConta | undefined): string {
  const semana = d ? semanaDe(d) : '0123456'
  const nomes = semana === '0123456' ? 'todos os dias' : [...semana].map(i => ABREV[Number(i)]).join(' ')
  const folgas = (d?.folgas ?? []).map(f => f.slice(8, 10) + '/' + f.slice(5, 7))
  const [ini, fim] = sonoDe(d ?? {})
  const sono = ini === fim ? 'não tira horas de sono' : `sono: ${ini}h-${fim}h`
  return `Dias que contam: ${nomes}${folgas.length ? ` · folgas: ${folgas.join(' ')}` : ''} · ${sono}`
}
async function ajustarDias($: EngineInterface, args: string): Promise<string | undefined> {
  const [cmd = '', ...resto] = args.trim().split(/\s+/)
  if (cmd !== 'dias' && cmd !== 'folga' && cmd !== 'sono') return undefined
  const perfil = (await chavePerfil($)).slice('ultima:'.length)
  const arq = await arquivoDias($)
  if (!arq) return 'Não achei a pasta do usuário para guardar os dias.'
  const todos = await lerDias($)
  const d: DiasConta = { ...todos[perfil] }
  const valor = resto.join(' ')
  if (cmd === 'dias') {
    if (!valor) return `${resumoDias(d)}\nUse, por exemplo: /cota dias seg-sex`
    const semana = semanaDoTexto(valor)
    if (!semana) return 'Não entendi os dias. Exemplos: /cota dias seg-sex, /cota dias seg,qua,sex, /cota dias todos'
    d.semana = semana
  } else if (cmd === 'sono') {
    if (!valor) return `${resumoDias(d)}\nUse, por exemplo: /cota sono 23-5, /cota sono nao ou /cota sono padrao`
    const sono = sonoDoTexto(valor)
    if (!sono) return 'Não entendi o horário. Exemplos: /cota sono 23-5, /cota sono nao, /cota sono padrao'
    d.sono = sono
  } else {
    if (/^(limpar|clear)$/i.test(valor)) d.folgas = []
    else {
      const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(valor)
      if (!m) return `${resumoDias(d)}\nUse, por exemplo: /cota folga 10/11, ou /cota folga limpar`
      const hoje = new Date(await $.clock.now())
      const data = `${m[3] ?? hoje.getFullYear()}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
      const lista = new Set(d.folgas ?? [])
      if (lista.has(data)) lista.delete(data); else lista.add(data)
      d.folgas = [...lista].sort()
    }
  }
  if (semanaDe(d) === '0123456') delete d.semana
  if (!d.folgas?.length) delete d.folgas
  if (d.sono === SONO_PADRAO) delete d.sono
  if (Object.keys(d).length) todos[perfil] = d; else delete todos[perfil]
  await $.fs.write(arq, JSON.stringify(todos, null, 2))
  return `${resumoDias(d)} (conta ${perfil})`
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    await atualiza($, await idioma($))
    return next(e)
  })

  on('command.run', { command: 'cota' }, async ($, e) => {
    const ajuste = await ajustarDias($, e.args ?? '')
    if (ajuste !== undefined) return { text: ajuste }
    const t = await idioma($)
    const texto = await atualiza($, t)
    return { text: `${texto ?? `${t.cota}: ${t.semDado}.`}
${t.fonte}: ${fonte}${conflito ? '\n⚠ ' + t.aviso : ''}` }
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'cota' } }, async ($, e, next) => {
    const c = leCartao(e.props.text)
    if (!c) return next(e)
    const t = await idioma($)
    if (e.surface !== 'terminal') {
      const { Svg } = $.ui.resolve(e)
      return <Svg source={cartaoSvg(c, t)} alt={e.props.text} />
    }
    const { Box, Text } = $.ui.resolve(e)
    const { tema } = COR[c.sinal]
    const b = barraTexto(c, Math.min(40, Math.max(10, (e.viewport?.columns ?? 80) - 4)))
    return (
      <Box flexDirection="column">
        <Text>
          <Text bold>{t.cota} {c.usado}%</Text>  <Text color={tema}>● {t[c.sinal]}</Text>
        </Text>
        <Text>
          <Text color={tema}>{b.usado}{b.projetado}</Text>
          <Text dimColor>{b.resto}</Text>
        </Text>
        <Text dimColor>{b.marca} {t.esperadoHoje} {c.ideal}%</Text>
        <Text>
          {t.fecha} {c.projecao}% · {t.reseta} {prazo(c.dias, t)}{c.porDia === undefined ? '' : ` · ${t.gastar} ${c.porDia}%/${t.porDia}`}
        </Text>
        {c.fonte !== undefined && <Text dimColor>{c.fonte}</Text>}
        {c.aviso !== undefined && <Text color="warning">⚠ {c.aviso}</Text>}
      </Box>
    )
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cota', description: 'Mostra o ritmo da cota semanal' })
    // Mostra já a última leitura guardada; depois atualiza a cada resposta.
    void idioma($).then(t => atualiza($, t))
    return next(e)
  })
}
