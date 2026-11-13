# herdr — glossary

the words `herdr/FTR.md` and our herdr mods use, each defined once (dima settled the words for a mod, a layout and a block at 18:45).

- **herdr mod** — one folder with a `main.js` that draws one panel in herdr; ours are named `x-herdr-*`; always said with «herdr», never a bare «mod»
- **cc native mod** — a Claude Code mod of plugin `x`; ours are named `x-mod-*`; always said in full
- **herdr layout** — the file that places herdr mods in the window and sets the look (`layouts/*.json`)
- **herdr layout block** — one spot in a herdr layout where a herdr mod sits
- **x-herdr** — our setup inside herdr: its layout and our mods, each mod under its own name; `x-herdr-*` names a mod alone, a part inside a mod is a plain word with its mod named
- **block** — short for herdr layout block; one block holds one mod, and where a part sits is the layout's alone (HRD-0001)
- **thread** — one Claude Code session running in a herdr terminal
- **Chat view** — a thread drawn as a conversation by x-herdr-chatter; the view dima lives in
- **Terminal view** — the same thread as its raw terminal, where cc's own band and board draw
- **dock** — the stack under the Chat view's log, inside x-herdr-chatter: the band on top, the quill, the ledge under it
- **band** — the dock's top card: the thread's meters (context, weekly use); not cc's own band, the row cc draws in the Terminal view
- **quill** — the dock's text box, where dima writes to a thread
- **ledge** — the dock's bottom card: the thread's status line with its clock and Stop, the buttons, the agent's progress
- **x-herdr key** — a key of ours in herdr's `keys.json`, its action naming an x-herdr mod (`x-herdr-chatter.focus`); listed in `hotkeys.js`, shown on the settings window's Keys page
- **settings window** — the one dialog for x-herdr's choices, a page per mod, drawn by x-herdr-chatter from its rows; its values live in `~/.claude/shelf/herdr-settings/settings.json`
- **settings row** — one choice in the settings window: a key, a title, a one-line why, one control (toggle, checks or stepper) and a default
- **x-herdr-chatter** — our chat mod, the Chat view itself; copied from zoo's `claude-chat` (FRM-556)
- **x-herdr-chatter-header** — the whole top row of a thread's pane, in the Chat view and the Terminal view alike: the thread's name and the switch; one row to the eye, drawn by x-herdr-chatter in the Chat view and by the x-herdr-chatter-header mod in the Terminal view, both from one `chatter-header.js`
- **x-herdr-chatter-header-tabs** — the Chat | Terminal switch inside that row
- **x-herdr-terminal-header** — the head row of the tray (the bottom quick terminal), part of x-herdr-terminal
- **x-herdr-status** — the status bar along the bottom of the middle column, under the tray: branch, folder, the open-in commands (VS Code), the command palette
- **sidebar** — the window's left column: today the agents list over the spaces; settled to hold antenna on top and glide at its bottom
- **deck** — the window's right column, drawn by x-herdr-deck: today every thread's row, then orbit, then glide; settled to hold orbit on top and phases at its bottom
- **antenna** — planned: one list of every thread (clio, wings, crew), each with its lane and state, at the sidebar's top; it replaces the agents list and the deck's thread rows
- **orbit** — the asks threads put to dima, in the deck; one ask is **ticked** or **replayed**
- **phases** — planned in the deck: each thread's next moves, the lines it keeps with orbit's plan op
- **glide** — one card per running lane, its steps and «we are here»; drawn in the deck today, settled at the sidebar's bottom, stuck there and growing upward
- **x-herdr-deck** — our deck mod: the deck column today (thread rows, orbit, glide)
- **x-herdr-agents** — our agents list in the sidebar, each agent by its session name; antenna replaces it
- **x-herdr-tabs** — our tab bar above a space's panes, each agent tab by its session name; copied from zoo's `my-tabs` (FRM-567)
- **draft** — what dima has typed in the quill and not yet sent; kept per thread across a reload
- **ask** — an orbit ask a thread put on his deck (and on cc's own board); a **tick** (🛎️) accepts it, a **replay** (🔁) sends it back with his steer
- **code block** — a fenced block in a reply, drawn with a ⧉ copy button that copies its text
- **chip** — inline code in the quill drawn as one monospace token; the caret skips it, one delete removes it
- **land** — copy a mod from frame into herdr's real mods folder (`pnpm herdr-mods:land`); the **watcher** lands each save that passes `herdr-app check`
- **zoo** — the third-party setup our chat, layout and clones began from; taken over on 2026-11-12, its mods set aside
