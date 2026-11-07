---
status: live
until: 2026-11-20
dies-when: the verdict line below is written
fits: clio codie
---

# rex — Superlogical's terminal and session server, on trial to replace warp

Ticket: none

the findings behind this file: [rex-terminal](../research/rex-terminal.md). wish: PK-335.

**test card:** we believe Rex is prettier, leaner and easier for agents to drive than warp · we test it by running dima's daily terminal work and real Claude Code sessions in it · we measure what he still opens warp for, whether status dots match real Claude Code state, what an agent could set up without his hands, and session survival across an app quit and an update · we're right if a full week passes with warp unopened and no session lost
**kill rule:** a lost session with real work in it, twice; or a daily habit from warp with no acceptable replacement

## the guide, one stop at a time

set up from scratch, migration selective: gruvbox is the one thing carried over from warp; tailscale is out of scope, he does not use it (dima, 2026-11-06).

1. install and first open: the DMG, activation, the agent skill
2. native themes: a look through the 41 built-ins, light and dark slots
3. gruvbox light and dark: import both from `~/.config/rex/themes/`, slot them, Auto follows macOS
4. config from scratch: Rex defaults kept, `cmd+k` stays the session picker, `~/.config/rex/init.lua` only once he misses a key
5. agent doors: Remote Control on, an agent drives tabs, panes and themes through `rex`
6. the fleet door: Claude Code status dots, the Activity sidebar, session survival, what stays with the desktop app
7. verdict setup: the week of real use, then the warp call

## stress list

- theme import — gruvbox dark and light from Ghostty files — cursor colors kept yes or no, tabs tinted well yes or no
- Auto appearance — macOS light and dark flip — seconds to follow, every pane flips yes or no
- program status (OSC 7501) — a real Claude Code session: working, permission prompt, done — dot right on each state, count
- Activity sidebar (`cmd+.`) — three Claude Code sessions at once — time to find the blocked one, against warp
- persistence — quit the app mid-run, reopen — program alive yes or no; again across a Rex update, which also proves `~/.local/bin/rex` still resolves (`rex version` against `rex server status`), since its target is the server's `Versions/Current`
- `rex` cli — an agent opens a tab, splits, runs, reads the screen — calls needed, errors
- client actions — an agent imports a theme and bumps the font with Remote Control on — works yes or no
- `init.lua` — keys from scratch, `rex config check`, `rex config reload` — reload seconds, silent failures
- skill and hook — fresh Claude Code in Rex and outside it — what the hook prints, startup ms added
- Claude Code in Rex — shift+enter, statusline, truecolor, images, `sline` — each renders right yes or no
- `client.visibility.toggle` — global hotkey, against his current quick door — works yes or no
- floating pane — a scratch shell for a minute — used again unprompted yes or no
- lost from warp — input editor, command blocks, completions — how often he misses each, a count over the week
- the mods in Rex — orbit, phases and glide under a Claude Code in a Rex pane, against the desktop app — what renders, what is lost; later, on his word (PK-335:W34), the input to any move of the threads

## rounds

- 2026-11-06 · install from the DMG, first launch, activation, skill setup · build 1829, 175 MB, app ran translocated because the agent's `ditto` copy kept quarantine · first run good, the copy door needs Finder

- 2026-11-06 · gruvbox from the Ghostty files through `client.theme.import`, Remote Control on · 2 imports, 2 exit 0, each filled its slot, stored cursor colors match the files · better than warp: the theme tints the whole window
- 2026-11-06 · persistence, an idle session across an app quit · session id unchanged · one pass, no real program in it yet
- 2026-11-06 · from scratch · `init.lua` absent, Rex defaults kept on his word, themes and fonts now his · nothing to write so far
- 2026-11-06 · `rex terminfo setup` · entry and guard written, it refused the symlinked `~/.ssh/config` and printed the `Include` to add by hand · the right call for a dotfile mirror
- 2026-11-06 · dima: «i like rex, let's make it my default terminal» · macOS has no one default: the door is his Raycast hyper+t, then login items; warp stays installed until the verdict
- 2026-11-06 · agent door: a session, 2 splits, 2 captures and a session.select, from a shell outside Rex by the server binary's full path · 35–78 ms a call, all exit 0, `TERM=xterm-rex COLORTERM=truecolor TERM_PROGRAM=rex`; `rex` is off `PATH` outside Rex terminals, so a desktop-app session finds no `rex` · clean, the `PATH` gap is the one snag
- 2026-11-06 · `hyper+t` moved to Rex Beta by dima in Raycast, login item swapped · warp no longer starts by itself
- 2026-11-06 · a live Claude Code 2.1.319 on Haiku 5.5, `program_status` read per state · `working` in 1 s, `blocked kind=permission` naming the file in 4 s, `done` with a summary line; 3 of 3 states right, no hook of ours · nothing like it in warp
- 2026-11-06 · `shift+enter` sent to Claude Code by `send-key` · a new line in the prompt · works, his physical key not yet tried
- 2026-11-06 · `rex` on `PATH` through `home/.local/bin/rex` · the hook stays silent outside Rex, 10 ms a run · Run buttons in the desktop app stay in its own panel, no setting for it; `rex run` is the door to a Rex tab
- 2026-11-06 · persistence with a live agent: `cmd+Q`, reopen · Claude Code pid 28550 alive across the app restart at 20:22, server pid unchanged since 18:54, no restart gap he noticed · a pass, an update still untried
- 2026-11-06 · a Claude Code started in Rex also showed in the desktop app, where dima answered its permission prompt by accident and typed to it; the Rex pane followed · both surfaces drive one session (Remote Control on at startup is the likely cause, an inference)
- 2026-11-06 · the blocked marker, a staged permission prompt in a `dot-check` tab · dima's two shots: a blue dot on the tab's icon, an orange Claude icon, a blue dot on the eye (Activity) button · seen by his eye, nothing like it in warp
- 2026-11-07 · one thread live in Rex and in the desktop app, Haiku 5.5 born in a Rex tab with Remote Control, about $0.02 · Rex: terminal view, the mods drawn terminal-style, board and glide included; desktop: a row in the thread list, seen by dima, with none of the app's native mods UI; `list_sessions` printed no row for it, so its null says nothing about the sidebar. A desktop-born thread has no door into a terminal: `claude attach` takes background sessions, its Remote Control reaches claude.ai and the phone · 📌 the migration's blocker: dima prefers the native mods UI, and the mods are sharpened against it; that UI draws only for a thread the app hosts (inference)

## for the verdict

- a nudge when a reply prints a copy fence, if a session skips the Rex door
- Rex's own `rex` skill beside `x:rex`: keep both or one
- fold these habits into their final home

## verdict
