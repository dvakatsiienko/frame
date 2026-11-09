# rex — Lua power use, and his open rex questions

read from `x:rex` when a job touches `init.lua`, a `rex do` script, a watcher or one of the questions below.

## Lua

one language for the config, for scripts and for live watchers; the guide is `https://www.superlogical.com/rex/docs/llms-full.txt` (§ Custom Actions, Lua Scripts, Lua Events, Lua API), read there, never copied here.

- **an action on a key** — `~/.config/rex/init.lua`, then `rex config reload`; it shows in the palette and runs as `rex do <name>`:

  ```lua
  rex.action{ name = "scratch", title = "Open Scratch Window", run = function(ctx, args)
    rex.session.new_window{ layout = rex.layout.block{ flavor = "com.superlogical.terminal.shell" } }
  end }
  rex.bind("shift+cmd+n", "scratch")
  ```

- **a script from your shell** — `rex do <file>.lua`, `rex do -e '<lua>'`, or `rex do - <<'LUA'`; it calls the same api as `init.lua`, and `rex do <file>.lua --action <name>` tries an action before the config holds it
- **a live watcher** — `rex.on(<event>, fn)` keeps the script running (`--all` for every session, `--for 10m` for a deadline). events worth a watcher here: `terminal.program_status_changed` (a Claude Code in a pane turns `blocked`), `terminal.child_exited` (with `exit_code`), `terminal.bell`, `terminal.pwd_changed`, `window_closed`
- **timers** — `rex.every(5, fn)` and `rex.after(n, fn)` never pause the script; `t:cancel()` stops one
- **a notification** — `rex.exec{ "osascript", "-e", 'display notification "…" with title "Rex"' }` inside a handler
- a failed api call returns `nil` and a message, never an error: check the second value
- an `init.lua` change is his file: name the lines, he says go; themes and fonts stay his

## his rex questions, answered

- **reopen a closed tab** (PK-358:W8, Warp's cmd+shift+t): no built-in action does it (`rex actions`, 2026-11-09). inference, unbuilt: a `rex do --all` watcher maps each block to its last `pwd` from `terminal.pwd_changed` (a `file://` url) and each window to its blocks from `block_created`; `window_closed` carries only `window_id`, so the map names the folder, and an action bound to cmd+shift+t opens a window there
- **rex or herdr**: `x:herdr`, «herdr or rex»
