---
dies-when: the rex test drive closes and these facts live in its verdict or in the skill that uses rex
---

# rex terminal — what it is, its doors, its limits

Ticket: none

wish: PK-335:W13, PK-335:W14. read 2026-11-06, build 0.1.0 (1829). three lanes: exa, parallel, a source lane over the [docs](https://www.superlogical.com/rex/docs.md) and the app bundle. «binary» marks a string read from the app: an inference, not documented behaviour.

## verdict

- a Ghostty-rendered terminal joined to a persistent session server, from Mitchell Hashimoto's company [Superlogical](https://www.superlogical.com/)
- free, no account, no telemetry ([post](https://www.superlogical.com/updates/public-testing-beginning), [privacy](https://www.superlogical.com/rex/docs/reference/privacy.md)); closed source so far, 0 public repos in the org
- **not a harness**: agents run inside it as terminal programs. the word only appears in the binary, as a package that installs into Claude Code and Codex

## install doors

- mac: the DMG only; Sparkle updates, about one build every 2 days, a check at launch and daily that cannot be turned off
- `brew install rex` is an unrelated perl tool from rexify.org; no cask
- a copy by script keeps `com.apple.quarantine` and macOS runs the app translocated; drag it in Finder instead
- the cli lives inside the server bundle and reaches `PATH` only in terminals Rex opens (`REX_BIN_DIR`); a startup file that resets `PATH` drops it
- linux and freebsd: [server packages](https://www.superlogical.com/rex/docs/linux/installation.md)

## on disk, observed

- `~/.config/rex/init.lua`: the config, written only when you make it
- `~/Library/Application Support/com.superlogical.rex/RexServer/`: the server, one version per build
- `~/Library/Application Support/rex/server.sock`: mode 0600, no network listener by default
- macOS defaults `com.superlogical.rex`: looks and settings, keys like `Workspace.darkThemeID`, `Workspace.lightThemeID`
- skill setup wrote `~/.claude/skills/rex/SKILL.md`, a stub that runs `rex __internal skill`, and one `SessionStart` hook in `~/.claude/settings.json`, a no-op wherever `rex` is off `PATH`

## config

- [`init.lua`](https://www.superlogical.com/rex/docs/customize/config.md), Lua 5.1: keys, sequences, modes, actions, hosts. **no looks**: theme, font and cursor live in Settings
- `rex config check`, `rex config reload`; no file watching; a misspelled action name passes the check
- tmux habits port: `rex.bind("ctrl+b>c", "client.tab.new")`
- default keys: `shift+cmd+p` palette, `cmd+k` session picker (it clears the screen in most terminals), `cmd+.` Activity, `cmd+d` split right, `shift+cmd+s` tab style
- not found: opacity or blur beyond the Glass material, a quake-style quick terminal (nearest: `client.visibility.toggle`, no default key), a scrollback setting (about 64 MiB per terminal), copy mode

## theming

- 41 built-ins, 27 dark and 14 light, no gruvbox; nearest warm pair: `sunlit-parchment`, `roasted-umber` (the source lane's pick)
- separate light and dark slots, `Color scheme` Auto follows macOS, `client.appearance.switch_mode` flips
- [`client.theme.import`](https://www.superlogical.com/rex/docs/reference/mac-actions.md#action-client-theme-import) or Settings > Themes > Import Theme takes a Ghostty or iTerm file; imports live in app settings, so a new Mac imports again
- ours: `home/.config/rex/themes/`, Gruvbox Dark and Light copied from [iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes/tree/92f4770acb207f6274e6f97a87a6e2f801dd083b/ghostty); warp's `gruvbox-violet` shares the dark file's ANSI colors, background and foreground, and adds an accent with no Ghostty key
- themes tint the app's interface as well as the terminal

## from warp

- `RexMigrate` covers alacritty, ghostty, herdr, iterm2, kitty, tmux, wezterm, zellij; **no warp**. it is a prompt an agent runs, keys only
- lost: the input editor, completions, command blocks; a Rex «block» means a pane. nearest: `cmd+up` and `cmd+down` prompt jumps, `rex capture`, find
- warp's built-in AI has no replacement; Claude Code runs in a pane

## agent doors

- `rex` cli: sessions, tabs, splits, `send`, `capture`, `wait`, `events`, `--json`
- `rex do` Lua scripts and `rex.on` handlers; `rex api list|describe|call` with JSON schemas
- client actions, theme and font included: `rex -C mac do client.font.increase`. they need **Remote Control**, off by default, one click of his; the skill tells an agent never to flip it
- [App Intents](https://www.superlogical.com/rex/docs/automate/agent-skill.md) six for Shortcuts (binary); no AppleScript, no MCP control server
- [Community MCP](https://www.superlogical.com/rex/docs/beta/community-mcp.md): read-only docs and Discord history, sign-in through Discord

## the fleet door

- for: sessions outlive the app, scriptable with stable ids, [Program Status](https://www.superlogical.com/rex/docs/build/program-status.md) (OSC 7501) with `blocked kind=permission`, an Activity sidebar, remote servers
- Claude Code 2.1.319 speaks it: `PROGRAM_STATUS:7501` and a runtime probe in its binary, checked by `rg`; a [tester](https://dev.classmethod.jp/en/articles/reona-superlogical-rex-beta-try/) saw it work on 2.1.312. the source lane's «no hit» came from a wrong search pattern
- limits: all sessions die if the server stops, caps of 64 sessions and 64 panes as launched, no worktrees, no supervisor, no permission control plane, any local connection has full control
- not read: Rex against cmux or the Claude desktop app

## where the lanes split

- gruvbox: exa found none, parallel found [rex-themes](https://github.com/AlbertoBarrago/rex-themes) (4 stars, a dark entry); neither ships inside Rex
- theme storage: settings, per parallel and the binary; no documented file path in any lane
- not verified anywhere: what `--restore` brings back, whether Mac sessions survive a server restart on update; both are stress-list items
