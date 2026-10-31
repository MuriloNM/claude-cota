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
