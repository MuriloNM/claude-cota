# cota

Mostra na barra de baixo do app desktop do Claude (aba Code) se o uso da cota semanal está no ritmo certo:

`🟢 Semana 49% / 61% → 78%`

- **49%**: quanto da cota semanal você já usou.
- **61%**: quanto deveria ter usado até agora, se gastasse por igual ao longo da semana.
- **→ 78%**: onde você fecha a semana se mantiver o ritmo atual.
- **Cor**: 🟢 folga, 🟡 no ritmo, 🔴 acima do ritmo (limite de 5 pontos).

O comando `/cota` mostra o detalhe: projeção, dias até o reset e quanto dá para gastar por dia.

## Instalar

No app desktop: clique em **+** ao lado do campo de texto, depois **Plugins**, **Add marketplace** com `MuriloNM/claude-cota`, e **Add plugin** `cota`.

Pelo terminal:

```
claude plugin install cota --marketplace MuriloNM/claude-cota
```

## Requisitos

- **Git instalado.** O app baixa o plugin do GitHub com o git. No Windows, instale pelo PowerShell e reabra o app:

  ```
  winget install --id Git.Git -e
  ```

  Depois de instalado o plugin fica na área interna do Claude e dá para remover pelo app (**Plugins**). O git pode ser desinstalado.
- App desktop do Claude (aba Code) com plano que mostre os limites de uso no card de uso. Fora do desktop a cota vem da própria sessão e pode aparecer como "sem dado".
- A linha aparece depois da primeira mensagem de cada sessão.

## O que o plugin faz (transparência)

- **Lê:** só a cota de uso da conta (limite semanal e quando reinicia), pelo `$.session.usage()` e pela ferramenta do app `get_usage` (do servidor `ccd_session_mgmt`, somente leitura).
- **Quando chama a ferramenta por conta própria:** ao iniciar a sessão, a cada 1 minuto, a cada mensagem enviada e ao fim de cada resposta. É a única ferramenta que ele chama; o modelo não participa.
- **Não envia nada para fora:** não faz requisições de rede, não grava arquivos, não executa comandos nem lê o conteúdo da conversa. Os eventos `prompt.submit` e `turn.complete` só servem de gatilho para atualizar o número; o texto da mensagem não é lido nem repassado.
- **Mostra:** uma linha na barra de baixo (`$.ui.status`) e o comando `/cota` com o detalhe.
