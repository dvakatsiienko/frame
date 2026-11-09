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

**start a seat that outlives its starter and the window**

```sh
hc run --bg --no-parent --no-notify --name <name> --cwd <dir> --label seat=<seat> -- claude "<its first task>"
```

- the first task rides in `run`: a send to a booting agent can be dropped (`hc --skill`, «Delegate a task»)
- `--no-parent`: by default a terminal started from inside another dies with its parent's program
- `--no-notify`: by default hc types notes about the child into the parent's prompt
- `--keep` is not a restart: it puts a shell where a lost program was and never re-runs `claude`

**hand another agent seat a message, then read it** — `hc send <t> '<text>' --if idle --wait --timeout 300`, then `hc read <t> --lines 80`. an agent seat takes the text as its next prompt; a plain shell reports no status, so `--if idle` refuses it — there it is a bare `hc send <t>`, then `hc read`

**prefill a command for dima's hand** — the enter is his

- `hc keys <t> g i t space s t a t u s` types without Enter; `hc keys <t> enter` submits (proven 2026-11-09, a scratch shell)
- it takes letters, digits, `space`, `- / . ' =`, and `shift+<letter>` for a capital; it types `4` for `shift+4` and refuses `~ " | $`
- a command with a pipe, a quote, `$` or `~` goes to a Rex tab instead (`x:rex`)
- aim it only at a terminal you started for this; his own seats are his

**report a script's status into herdr's agents list** (rex reads the same sequence): from a script whose output goes to the terminal, never from a tool call, and always with an `id`, or it overwrites the pane's own Claude Code record:

```sh
printf '\e]7501;id=%s:state=%s:msg=%s\e\\' build working "$(printf %s 'building' | base64)"
```

## traps

- 📌 `hc send` always presses Enter; `hc keys` is the only prefill, with the limits above
- 📌 `hc send --force` types into a blocked program and may answer its permission dialog: never into a seat waiting on dima
- `hc get` changes nothing and shows no screen; the screen is `hc read`
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

- `~/.config/herdr-app/AGENTS.md` is 62 KB, about 15k tokens (inference: 4 bytes a token); our loader hook names it only when a session touches `~/.config/herdr-app` and never inlines it, so a seat that only drives herdr pays nothing
- the herdr window ran about 270 MB against the desktop app's 2.3 GB (one snapshot, 2026-11-09)
