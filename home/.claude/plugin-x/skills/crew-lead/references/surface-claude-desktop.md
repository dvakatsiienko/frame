# surface: claude desktop — the backup

the claude desktop app is dima's second door to the fleet: herdr is still unstable and can die, and he opens the desktop app to look into threads and other things. every herdr seat started with `--remote-control` shows up here on its own; a seat is started here only when herdr cannot take it, and the summon says why to dima. the base `claude` line is `crew-lead` § the doors.

## the two doors here

- **the desktop thread** — a Code-tab session clio starts and closes herself; the member pings back by `SendMessage`. its start and close calls: [spawn-mechanics.md](spawn-mechanics.md) § the desktop thread
  - mods UI draws only in a native desktop thread, so this is the door when dima tests a mod's look in a code thread
  - a steer clio relays is never dima's grant to the member, who confirms with him
- **background session** (`claude --bg`) — survives a coordinator reset, takes `--model` and `--effort`; herdr shows it only through an attach pane; the probed facts: [spawn-mechanics.md](spawn-mechanics.md) § 5
  - the head: `cd <repo> && claude --bg`, then the base line; a quick lane adds `--settings '{"worktree":{"bgIsolation":"none"}}'` before the prompt
  - spare age: every `--bg` summon claims a pre-warmed `claude bg-spare`, and a day-old spare once booted codie without the repo's root `AGENTS.md`; a day old → `claude daemon stop --keep-workers`. the brief's «name your loaded AGENTS.md paths» line is the belt

## how it ran before herdr

- every clio seat and the mods quick-lane codie ran as native desktop threads, the mods UI being drawn only there; everyone else ran `--bg`, since the desktop thread's own tools and MCPs were dead weight for them
