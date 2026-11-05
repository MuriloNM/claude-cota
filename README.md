# cota

Mostra na barra de baixo do app desktop do Claude (aba Code) se o uso da cota semanal está no ritmo certo:

`🟢 Semana 49% / 61% → 78%`

- **49%**: quanto da cota semanal você já usou.
- **61%**: quanto deveria ter usado até agora, se gastasse por igual ao longo da semana.
- **→ 78%**: onde você fecha a semana se mantiver o ritmo atual.
- **Cor**: 🟢 folga, 🟡 no ritmo, 🔴 acima do ritmo (limite de 5 pontos).

O comando `/cota` abre um cartão com o detalhe: uso, barra com o esperado para hoje e a projeção, dias até o reset e quanto dá para gastar por dia. No app desktop, no VS Code e no celular é um cartão gráfico; no terminal, a mesma barra em caracteres:

```
Cota semanal 18%  ● Folga
███████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░
            ▲ esperado hoje 31%
fecha em 58% · reseta em 4,8 dias · pode gastar 17%/dia
```

Sem leitura da cota, o `/cota` responde com uma linha de texto.

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
- A linha atualiza ao fim de cada resposta. Na primeira sessão ela aparece depois da primeira resposta; nas seguintes já abre com a última leitura.

## Mais de uma conta ou app aberto

O plugin guarda a última leitura por perfil, para duas contas na mesma máquina (pessoal e trabalho, por exemplo) não misturarem a cota. O perfil é, nesta ordem:

1. a variável `CLAUDE_PERFIL`, se existir;
2. a variável `CLAUDE_CONFIG_DIR`, se existir;
3. `padrao`.

Para abrir um segundo app do Claude Desktop com perfil próprio, defina `CLAUDE_PERFIL` antes de abri-lo (PowerShell):

```
$env:CLAUDE_PERFIL = 'Trabalho'
Start-Process claude.exe -ArgumentList '--user-data-dir="C:\caminho\do\perfil"'
```

Além disso, uma leitura guardada cujo reset difere em mais de 30 minutos do da sessão atual é descartada (é de outra conta). O `/cota` mostra a `fonte:` usada.

Se o plugin perceber duas contas gravando no perfil `padrao` (nenhum perfil definido), ele mostra `⚠ perfil` na barra e a explicação no `/cota`. Sem sinal de segunda conta, não avisa.

## O que o plugin faz (transparência)

- **Lê:** só a cota de uso da conta (limites e quando reiniciam), pelo `$.session.usage()` e pela ferramenta do app `get_usage` (do servidor `ccd_session_mgmt`, somente leitura).
- **Quando chama a ferramenta por conta própria:** ao iniciar a sessão e ao fim de cada resposta, no máximo uma vez a cada 5 minutos. É a única ferramenta que ele chama; o modelo não participa.
- **Lê também** as variáveis de ambiente `CLAUDE_PERFIL` e `CLAUDE_CONFIG_DIR`, só para nomear o perfil.
- **Guarda:** só a última leitura de cada limite (semana, janela de 5 h e semana por modelo, quando o plano tem: porcentagem, data do reset e hora da leitura), por perfil, no armazenamento do próprio plugin (`$.store`), para já abrir a sessão com o número certo e para a pílula do [cota-barra](https://github.com/MuriloNM/cota-barra) ler.
- **Não envia nada para fora:** não faz requisições de rede, não executa comandos nem lê o conteúdo da conversa. O evento `turn.complete` só serve de gatilho para atualizar o número; o texto da resposta não é lido nem repassado.
- **Mostra:** uma linha na barra de baixo (`$.ui.status`) e o comando `/cota` com o cartão do detalhe. O cartão é desenhado só com o texto da própria resposta do `/cota`, sem carregar nada de fora.
