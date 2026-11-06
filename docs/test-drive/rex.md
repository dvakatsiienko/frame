---
status: live
until: 2026-11-20
dies-when: the verdict line below is written
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
- persistence — quit the app mid-run, reopen — program alive yes or no; again across a Rex update
- `rex` cli — an agent opens a tab, splits, runs, reads the screen — calls needed, errors
- client actions — an agent imports a theme and bumps the font with Remote Control on — works yes or no
- `init.lua` — keys from scratch, `rex config check`, `rex config reload` — reload seconds, silent failures
- skill and hook — fresh Claude Code in Rex and outside it — what the hook prints, startup ms added
- Claude Code in Rex — shift+enter, statusline, truecolor, images, `sline` — each renders right yes or no
- `client.visibility.toggle` — global hotkey, against his current quick door — works yes or no
- floating pane — a scratch shell for a minute — used again unprompted yes or no
- lost from warp — input editor, command blocks, completions — how often he misses each, a count over the week

## rounds

- 2026-11-06 · install from the DMG, first launch, activation, skill setup · build 1829, 175 MB, app ran translocated because the agent's `ditto` copy kept quarantine · first run good, the copy door needs Finder

- 2026-11-06 · gruvbox from the Ghostty files through `client.theme.import`, Remote Control on · 2 imports, 2 exit 0, each filled its slot, stored cursor colors match the files · better than warp: the theme tints the whole window
- 2026-11-06 · persistence, an idle session across an app quit · session id unchanged · one pass, no real program in it yet
- 2026-11-06 · from scratch · `init.lua` absent, Rex defaults kept on his word, themes and fonts now his · nothing to write so far
- 2026-11-06 · `rex terminfo setup` · entry and guard written, it refused the symlinked `~/.ssh/config` and printed the `Include` to add by hand · the right call for a dotfile mirror
- 2026-11-06 · dima: «i like rex, let's make it my default terminal» · macOS has no one default: the door is his Raycast hyper+t, then login items; warp stays installed until the verdict
- 2026-11-06 · agent door: a session, 2 splits, 2 captures and a session.select, from a shell outside Rex by the server binary's full path · 35–78 ms a call, all exit 0, `TERM=xterm-rex COLORTERM=truecolor TERM_PROGRAM=rex`; `rex` is off `PATH` outside Rex terminals, so a desktop-app session finds no `rex` · clean, the `PATH` gap is the one snag
- 2026-11-06 · `hyper+t` moved to Rex Beta by dima in Raycast, login item swapped · warp no longer starts by itself

## verdict
