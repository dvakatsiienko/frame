# herdr — glossary

the words `herdr/FTR.md` and our herdr mods use, each defined once.

- **x-herdr** — our setup inside herdr: its layout and our mods, each mod under its own name
- **seat** — one Claude Code session running in a herdr terminal
- **Chat view** — a seat drawn as a conversation by x-herdr-chatter; the view dima lives in
- **Terminal view** — the same seat as its raw terminal, where cc's own band and board draw
- **x-herdr-chatter** — our chat mod, the Chat view itself; copied from zoo's `claude-chat` (FRM-556)
- **fleet-board** — our board mod: every seat's row, their asks and the lanes' cards; a second copy draws the strip
- **agents-list** — our agents list in the sidebar, each agent by its session name
- **strip** — fleet-board's copy above the Chat view: the shown seat's context, waiting-on line and asks
- **draft** — what dima has typed in a box and not yet sent; kept per seat across a reload
- **ask** — an orbit ask a seat put on his board; a **tick** (🛎️) accepts it, a **replay** (🔁) sends it back with his steer
- **land** — copy a mod from frame into herdr's real mods folder (`pnpm herdr-mods:land`); the **watcher** lands each save that passes `herdr-app check`
- **zoo** — the third-party setup our chat and layout were borrowed from; being taken over until its name appears nowhere
