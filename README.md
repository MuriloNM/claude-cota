# cota

Shows whether your weekly Claude usage is on pace, right in the bottom bar of the Claude desktop app (Code tab):

`🟢 Week 49% / 61% → 78%`

- **49%**: how much of your weekly limit you have used.
- **61%**: how much you would have used by now if you spent evenly across the week.
- **→ 78%**: where the week ends if you keep the current pace.
- **Color**: 🟢 room to spare, 🟡 on pace, 🔴 over pace (5-point margin).

The `/cota` command opens a card with the details: usage, a bar marking what is expected today and the projection, time until the reset, and how much you can spend per day. In the desktop app, VS Code and mobile it is a graphic card. In the terminal it is the same bar drawn in characters:

```
Weekly usage 18%  ● Room to spare
███████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░
            ▲ expected today 31%
Week ends at 58% · Resets in 4.8 days · Can spend 17%/day
```

With no usage reading available, `/cota` answers with one line of text.

## Languages

The card and the bottom bar follow Claude's language (the `language` row in `/config`): Portuguese, English, Spanish, French, German, Italian, Japanese, Korean and Chinese. If that row is empty, the plugin uses the system language. A language without a translation falls back to English.

## Days that count

By default, the expected pace moves every day of the week. You can count only some days, per account, and mark days off, like a holiday. Expected then only moves on the days that count, and "can spend per day" is spread over those days.

```
/cota dias seg-sex        only Monday to Friday (mon-fri also works)
/cota dias seg,qua,sex    only these days
/cota dias todos          every day again
/cota folga 10/11         marks or unmarks a day off (day/month)
/cota folga limpar        removes all days off
/cota sono 23-5           sleep hours, from 11 pm to 5 am
/cota sono nao            counts all 24 hours
/cota sono padrao         back to the default, midnight to 6 am
```

By default, 6 hours a day, from midnight to 6 am, are taken out as sleep: expected stands still during them. If something keeps running at night and spending your quota, use `/cota sono nao`.

The settings live in `~/.cota-barra/dias.json`, one entry per profile. The [cota-barra](https://github.com/MuriloNM/cota-barra) pill reads and writes the same file, so a change in either place shows in both.

## Install

In the desktop app: click **+** next to the text field, then **Plugins**, **Add marketplace** with `MuriloNM/claude-cota`, and **Add plugin** `cota`.

From the terminal:

```
claude plugin install cota --marketplace MuriloNM/claude-cota
```

## Requirements

- **Git.** The app downloads the plugin from GitHub with git. On Windows, install it from PowerShell and reopen the app:

  ```
  winget install --id Git.Git -e
  ```

  Once installed, the plugin lives in Claude's internal area and can be removed from the app (**Plugins**). Git can then be uninstalled.
- The Claude desktop app (Code tab), on a plan that shows usage limits on the usage card. Outside the desktop app, usage comes from the session itself and may show as "no data".
- The bottom bar updates at the end of each reply. In the first session it appears after the first reply; later sessions open with the last reading.

## More than one account or app

The plugin keeps the last reading per profile, so two accounts on the same machine (personal and work, for example) do not mix their usage. The profile is, in this order:

1. the `CLAUDE_PERFIL` environment variable, if set;
2. the `CLAUDE_CONFIG_DIR` environment variable, if set;
3. `padrao`.

To open a second Claude Desktop app with its own profile, set `CLAUDE_PERFIL` before opening it (PowerShell):

```
$env:CLAUDE_PERFIL = 'Work'
Start-Process claude.exe -ArgumentList '--user-data-dir="C:\path\to\profile"'
```

A stored reading whose reset differs by more than 30 minutes from the current session's is discarded, because it belongs to another account. `/cota` shows the source it used.

If the plugin detects two accounts writing to the `padrao` profile (no profile set), it shows `⚠ perfil` in the bottom bar and explains it in `/cota`. With no sign of a second account, it stays silent.

## What the plugin does (transparency)

- **Reads:** only your account's usage (its limits and when they reset), through `$.session.usage()` and the app's `get_usage` tool (from the `ccd_session_mgmt` server, read-only).
- **When it calls the tool on its own:** at session start and at the end of each reply, at most once every 5 minutes. If a call goes unanswered, it tries again on the next occasion. It is the only tool it calls, and the model is not involved.
- **Also reads:** the `CLAUDE_PERFIL` and `CLAUDE_CONFIG_DIR` environment variables, only to name the profile, the `language` row in `/config`, only to pick the language of its texts, and `~/.cota-barra/dias.json`, the days that count (located with `USERPROFILE` or `HOME`).
- **Writes files:** only `~/.cota-barra/dias.json`, and only when you run `/cota dias`, `/cota folga` or `/cota sono`.
- **Stores:** only the last reading of each limit (the week, the 5-hour window and per-model weeks, when the plan has them: percentage, reset date and time of reading), per profile, in the plugin's own storage (`$.store`), so a session opens with the right number and the [cota-barra](https://github.com/MuriloNM/cota-barra) pill can read it.
- **Sends nothing out:** it makes no network requests, runs no commands and does not read the conversation. The `turn.complete` event only triggers a refresh of the number; the reply's text is neither read nor passed on.
- **Shows:** one line in the bottom bar (`$.ui.status`) and the `/cota` command with the details card. The card is drawn only from the text of the `/cota` answer itself, loading nothing from outside.

## Em português

O `cota` mostra na barra de baixo do app desktop do Claude (aba Code) se o uso da cota semanal está no ritmo certo, e o comando `/cota` abre um cartão com o detalhe. Os textos seguem o idioma do Claude.

`🟢 Semana 49% / 61% → 78%`: **49%** é o que você já usou, **61%** é o esperado até agora e **78%** é onde a semana fecha se o ritmo continuar.

Para contar só alguns dias, por conta: `/cota dias seg-sex`. Para marcar uma folga, como um feriado: `/cota folga 10/11`. O esperado só anda nos dias que contam. Por padrão, 6 horas por dia, da meia-noite às 6h, saem da conta como sono; para mudar: `/cota sono 23-5`, ou `/cota sono nao` para contar as 24 horas.

Para instalar no app: **+** ao lado do campo de texto, **Plugins**, **Add marketplace** com `MuriloNM/claude-cota` e **Add plugin** `cota`. O plugin não envia nada para fora e só lê a cota, as variáveis de perfil e o idioma configurado; o detalhe está em "What the plugin does".
