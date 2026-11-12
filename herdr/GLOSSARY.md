# herdr — glossary

the words `herdr/FTR.md` and our herdr mods use, each defined once (dima settled the words for a mod, a layout and a block at 18:45).

- **herdr mod** — one folder with a `main.js` that draws one panel in herdr; ours are named `x-herdr-*`; always said with «herdr», never a bare «mod»
- **cc native mod** — a Claude Code mod of plugin `x`; ours are named `x-mod-*`; always said in full
- **herdr layout** — the file that places herdr mods in the window and sets the look (`layouts/*.json`)
- **herdr layout block** — one spot in a herdr layout where a herdr mod sits
- **x-herdr** — our setup inside herdr: its layout and our mods, each mod under its own name
- **thread** — one Claude Code session running in a herdr terminal
- **Chat view** — a thread drawn as a conversation by x-herdr-chatter; the view dima lives in
- **Terminal view** — the same thread as its raw terminal, where cc's own band and board draw
- **x-herdr-chatter** — our chat mod, the Chat view itself; copied from zoo's `claude-chat` (FRM-556)
- **x-herdr-chatter-header** — the whole top row of a thread's pane, in the Chat view and the Terminal view alike: the thread's name and the switch; one row to the eye, drawn by x-herdr-chatter in the Chat view and by the x-herdr-chatter-header mod in the Terminal view, both from one `chatter-header.js`
- **x-herdr-chatter-header-tabs** — the Chat | Terminal switch inside that row
- **x-herdr-terminal-header** — the head row of the tray (the bottom quick terminal), part of x-herdr-terminal
- **x-herdr-status** — the status bar along the window's bottom: branch, folder, the open-in commands
- **x-herdr-deck** — our deck mod: every thread's row, their asks and the lanes' cards
- **x-herdr-agents** — our agents list in the sidebar, each agent by its session name
- **x-herdr-tabs** — our tab bar above a space's panes, each agent tab by its session name; copied from zoo's `my-tabs` (FRM-567)
- **draft** — what dima has typed in a box and not yet sent; kept per thread across a reload
- **ask** — an orbit ask a thread put on his deck (and on cc's own board); a **tick** (🛎️) accepts it, a **replay** (🔁) sends it back with his steer
- **code block** — a fenced block in a reply, drawn with a ⧉ copy button that copies its text
- **prompt card** — a fenced block under a 📋 ribbon naming a session or an agent; a click puts its prompt in dima's box, unsent
- **chip** — inline code in the box drawn as one monospace token; the caret skips it, one delete removes it
- **land** — copy a mod from frame into herdr's real mods folder (`pnpm herdr-mods:land`); the **watcher** lands each save that passes `herdr-app check`
- **zoo** — the third-party setup our chat, layout and clones began from; taken over on 2026-11-12, its mods set aside
