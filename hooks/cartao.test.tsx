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

test('no terminal, a barra em texto com os mesmos números', async $ => {
  const ui = await $.ui.mount({ ...linha(TEXTO), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /esperado hoje 30%/ }))?.text).toContain('▲')
  expect((await ui.find({ type: 'Text', text: /fecha em 52%/ }))?.text).toContain('4,9 dias')
  await ui.unmount()
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
