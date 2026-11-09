---
name: herdr
description: Load BEFORE any `hc` or `herdr-app` command, and whenever a seat runs in herdr or reaches into one — «herdr», «hc», «a herdr pane», «the herdr window», «another seat's screen in herdr», «start a seat in herdr», «a shot of the herdr window», «a herdr seat is blocked».
---

# herdr — the fleet's doors into dima's herdr

herdr is two programs: `herdr-app`, the window dima looks at, and `hc` (herdr-core), the daemon that runs every terminal and keeps it alive when the window closes. a seat in a herdr pane is a plain Claude Code cli: herdr injects no tool, MCP, hook or memory, so our hooks, mods, `x` and every MCP work as anywhere. changing herdr itself (a mod, a layout, keys) is `x:herdr-customize`.

## 0 · read herdr's own manuals first

```sh
hc --skill          # terminals and agents: run, read, send, wait, labels, recovery
herdr-app --skill   # the window: ls, status, do, commands, shot, and its safety rules
```

they ship with each herdr update and are the truth for the installed version: syntax, safety and the window's rules live there and are never repeated here. this skill holds what they lack: the fleet's recipes, the traps we paid for, and where herdr meets rex. a flag here that disagrees with `--help` loses.

📌 `<t>` below is a terminal address from `hc ls --json`, never one copied from here: an address like `t7` may be dima's own live seat.

## the doors a seat uses daily

1. `hc ls --json` — every live terminal: `address`, `agent`, `cwd`, and `status`, its one word (`idle`, `working`, `done`, `blocked`, `error`); `state` only says `live`
2. `hc get <t> --json` — one terminal whole: `.status.state`, `.status.msg`, and on a block `.status.kind` (`permission`, `question`, `auth`)
3. `hc read <t> --lines 50` — its screen plus 50 lines above; the twin of `rex capture`
4. `hc wait <t> --timeout 600` — until it stops working, never a `sleep`; a return with `reason: timeout` is a check-in, so wait again
5. `herdr-app shot /tmp/herdr.png` — the window as dima sees it, no screen-recording grant; then read the png
6. `herdr-app ls` and `herdr-app status` — spaces, tabs, pane ids, focus, mod errors

## recipes

**start a member in a pane** — a wing, the mods codie, a seat that outlives the window (summon probe, 2026-11-09, `~/frame/.scratch/herdr-summon-probe/findings.md`; `-n` with `--remote-control` together, unrun)

```sh
hc run --bg --no-parent --no-notify --name <short> --cwd <dir> -- claude -n '<registry name>' "<its first task>" --remote-control
```

- 📌 the cc `-n` is its name for `ListAgents` and `seatOf` (`🦉🪽 clio: wing <N>` makes a wing; `SendMessage` by it, inference); herdr's `--name` and `--label` only tag the pane; `hc ls --json` lists the live seats
- its session id: the `~/.claude/sessions/<pid>.json` of the pid `hc get <t> --json` reports; its idle notice lands when your own turn ends
- stop it with `hc kill <t>`; a `claude --bg` member runs unchanged from a herdr seat, `claude attach <id>` opens it in a pane, `claude stop <id>` ends it
- the first task rides in `run`: a send to a booting agent can be dropped (`hc --skill`, «Delegate a task»)
- `--no-parent`: by default a terminal started from inside another dies with its parent's program
- `--no-notify`: by default hc types notes about the child into the parent's prompt
- `--keep` is not a restart: it puts a shell where a lost program was and never re-runs `claude`

**hand another agent seat a message, then read it** — `hc send <t> '<text>'` once `hc get <t> --json` reads `done` or `idle`, then `hc read <t> --lines 80`. an agent seat takes the text as its next prompt; `--if idle` refuses every seat that has finished a turn, its status staying `done` (probe, 2026-11-09); a plain shell reports no status, so it gets a bare `hc send` too

**prefill a command for dima's hand** — the enter is his

- `hc keys <t> g i t space s t a t u s` types without Enter; `hc keys <t> enter` submits (proven in a scratch shell)
- it takes letters, digits, `space`, `- / . ' =`, and `shift+<letter>` for a capital; it types `4` for `shift+4` and refuses `~ " | $`
- a command with a pipe, a double quote, `$` or `~` goes to a Rex tab instead (`x:rex`)
- aim it only at a terminal you started for this; his own seats are his

**report a script's status into herdr's agents list** (rex reads the same sequence): from a script whose output goes to the terminal, never from a tool call, and always with an `id`, or it overwrites the pane's own Claude Code record:

```sh
printf '\e]7501;id=%s:state=%s:msg=%s\e\\' build working "$(printf %s 'building' | base64)"
```

## traps

- 📌 `hc send` always presses Enter; `hc keys` is the only prefill, with the limits above
- 📌 `hc send --force` types into a blocked program and may answer its permission dialog: never into a seat waiting on dima
- `hc get` changes nothing and shows no screen; the screen is `hc read`
- 📌 `SendUserFile` from a herdr seat says «delivered» and reaches dima nowhere (summon probe door 5, 2026-11-09): a look card's shot goes out as its absolute path in the reply, and `open <png>` shows it on his mac
- `herdr-app do '<json>'` alone is refused: the command name comes first, `herdr-app do pane.split '<json>'`
- a `herdr-app do` that makes or splits a pane names its target `pane` from `ls` and runs only when dima asked for it; without one it acts on his focused pane
- `mcp__ide` tools in a herdr seat are Cursor's (open on the same folder), never herdr's

## shortcuts a seat names to dima

- cmd-] and cmd-[ — next and previous agent
- cmd-d — split right
- cmd-shift-enter — zoom a pane
- cmd-p — the tab picker
- cmd-shift-p — the palette
- ctrl-alt-shift-escape — resets a broken layout

the rest: `~/.config/herdr-app/keys.json`.

## herdr or rex

- dima's daily terminal, a prefill with any character, Lua automation → rex (`x:rex`)
- seats side by side with their status read by a script, a custom panel or board → herdr
- both speak OSC 7501 and both render through ghostty's terminal core

## what herdr costs a session

- nothing resident: our loader hook names `~/.config/herdr-app/AGENTS.md` (62 KB, ~15k tokens) only when a session touches `~/.config/herdr-app`, never inlined
