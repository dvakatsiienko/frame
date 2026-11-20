---
name: herdr
description: Load BEFORE any `hc` or `herdr-app` command, and whenever a thread runs in herdr or reaches into one — «herdr», «hc», «a herdr pane», «the herdr window», «another thread's screen in herdr», «start a thread in herdr», «a shot of the herdr window», «a herdr thread is blocked».
---

# herdr — the fleet's doors into dima's herdr

herdr is two programs: `herdr-app`, the window dima looks at, and `hc` (herdr-core), the daemon that runs every terminal and keeps it alive when the window closes. a thread in a herdr pane is a plain Claude Code cli: herdr injects no tool, MCP, hook or memory, so our hooks, mods, `x` and every MCP work as anywhere. changing herdr itself (a mod, a layout, keys) is `x:herdr-customize`.

## 0 · read herdr's own manuals first

```sh
hc --skill          # terminals and agents: run, read, send, wait, labels, recovery
herdr-app --skill   # the window: ls, status, do, commands, shot, and its safety rules
```

they ship with each herdr update and are the truth for the installed version: syntax, safety and the window's rules live there and are never repeated here. this skill holds what they lack: the fleet's recipes, the traps we paid for, and where herdr meets rex. a flag here that disagrees with `--help` loses.

📌 `<t>` below is a terminal address from `hc ls --json`, never one copied from here: an address like `t7` may be dima's own live thread.

## the doors a thread uses daily

1. `hc ls --json` — every live terminal: `address`, `agent`, `cwd`, and `status`, its one word (`idle`, `working`, `done`, `blocked`, `error`); `state` only says `live`
2. `hc get <t> --json` — one terminal whole: `.status.state`, `.status.msg`, and on a block `.status.kind` (`permission`, `question`, `auth`)
3. `hc read <t> --lines 50` — its screen plus 50 lines above; the twin of `rex capture`
4. `hc wait <t> --timeout 600` — until it stops working, never a `sleep`; a return with `reason: timeout` is a check-in, so wait again
5. `herdr-app shot /tmp/herdr.png` — the window as dima sees it, no screen-recording grant; then read the png
6. `herdr-app ls` and `herdr-app status` — spaces, tabs, pane ids, focus, mod errors

## recipes

**start a member in a pane** — a wing, the mods codie, a thread that outlives the window (`~/frame/.scratch/herdr-summon-probe/findings.md`)

```sh
hc run --bg --no-parent --no-notify --name <short> --cwd <dir> -- claude -n '<registry name>' --model <model> --effort medium "<its first task>" --remote-control
```

- this is every member's summon door; a wing starts by `~/frame/_clio/script/clio-start.sh wing <N> '<first prompt>'`, the prompt before `--remote-control`; a lane member's line carries its brief, `"$(cat <brief file>)"`, its argv per role and its preflight (`x brief summon '<the line>'`) in `x:crew-lead`
- 📌 then its tab, the same turn (a `--no-parent` thread has none, so herdr's agents list skips it): `node scripts/thread-tab.ts <t> '<registry name>'` prints the tab id (it runs `terminal.keep`, then `tab.rename`; exit 1 and one line when no tab came back); done when `herdr-app ls` shows the tab by its registry name
- 📌 the cc `-n` is its name for `ListAgents` and `threadOf` (`🦉🪽 clio: wing <N>` makes a wing; `SendMessage` by it); herdr's `--name` and `--label` only tag the pane; `hc ls --json` lists the live threads
- a plain `hc run` probe stays out of `x thread list`, known by its `-n` alone
- its session id: `~/.claude/sessions/<pid>.json`, the pid from `hc get <t> --json`; its idle notice lands when your own turn ends
- stop it with `hc kill <t>`; a `claude --bg` member runs unchanged from a herdr thread, `claude attach <id>` opens it in a pane, `claude stop <id>` ends it
- `--no-parent` keeps it alive past its parent's program; `--no-notify` keeps hc's notes out of the parent's prompt; `--keep` only puts a shell where a lost program was

**a dead clio thread** — `~/frame/_clio/script/clio-revive.sh main|wing <N>` (dima's alias `clio-revive`) resumes it in its own tab, cache hot; never a hand `claude --resume` line

**hand another agent thread a message, then read it** — `hc send <t> '<text>'` once `hc get <t> --json` reads `done` or `idle`, then `hc read <t> --lines 80`. an agent thread takes the text as its next prompt; `--if idle` refuses any thread done with a turn, its status staying `done`; a plain shell reports no status, so it gets a bare `hc send` too

**prefill a command for dima's hand** — the enter is his

- `hc keys <t> g i t space s t a t u s` types without Enter; `hc keys <t> enter` submits
- it takes letters, digits, `space`, `- / . ' =`, and `shift+<letter>` for a capital; it types `4` for `shift+4` and refuses `~ " | $`
- a command with a pipe, a double quote, `$` or `~` goes to a Rex tab instead (`x:rex`)
- aim it only at a terminal you started for this; his own threads are his

**report a script's status into herdr's agents list** (rex reads the same sequence): from a script whose output goes to the terminal, never from a tool call, and always with an `id`, or it overwrites the pane's own Claude Code record:

```sh
printf '\e]7501;id=%s:state=%s:msg=%s\e\\' build working "$(printf %s 'building' | base64)"
```

**map his window** — `uv run -q --with pillow python -I scripts/window-map.py <out.png>`: shoots it, boxes from its layout (`window-map.json`), a hidden panel listed, never drawn; open nothing for it

**move a part between the sidebar and the deck** — `node scripts/layout-part-move.ts antenna deck --before orbit --size px:279`, then `glide deck --before orbit`; back: `antenna sidebar --size weight:1`, then `glide sidebar`. one part a call, the shown layout unless `--layout <name>`

**change a key** — only `node scripts/keys-change.ts set|remove <global|terminal> <key> [command|json]`, or `reload` after a save elsewhere: a bare `keys.json` save kills x-herdr mods' keys

## traps

- 📌 a bare `overlay.close`, `tab.close` or `pane.close` kills dima's focused thread; a probe closes itself, `closeOverlay(props().overlay)`; a second `mod.open` of a dialog opens a copy
- a layout switch is safe since the 11-10 fix and stays dima's hand (`herdr/PRODUCT.md`)
- 📌 `hc send` always presses Enter; `hc keys` is the only prefill, with the limits above
- 📌 `hc send --force` types into a blocked program and may answer its permission dialog: never into a thread waiting on dima
- `hc get` changes nothing and shows no screen; the screen is `hc read`
- 📌 `SendUserFile` from a herdr thread says «delivered», reaches dima nowhere: a shot goes as its absolute path
- `herdr-app do '<json>'` alone is refused: the command name comes first, `herdr-app do pane.split '<json>'`
- a `herdr-app do` that makes or splits a pane names its `pane` from `ls`, on dima's ask; without one it acts on his focused pane
- `mcp__ide` tools in a thread are Cursor's

## shortcuts a thread names to dima

- cmd-] and cmd-[ — next and previous agent
- cmd-d — split right
- cmd-shift-enter — zoom a pane
- cmd-p — the tab picker
- cmd-shift-p — the palette
- ctrl-alt-shift-escape — resets a broken layout

the rest: `~/.config/herdr-app/keys.json`.

## herdr or rex

- dima's daily terminal, a prefill with any character, Lua automation → rex (`x:rex`)
- threads side by side with their status read by a script, a custom panel or board → herdr

## what herdr costs a session

- nothing resident: our loader hook names `~/.config/herdr-app/AGENTS.md` (62 KB, ~15k tokens) only when a session touches `~/.config/herdr-app`, never inlined
