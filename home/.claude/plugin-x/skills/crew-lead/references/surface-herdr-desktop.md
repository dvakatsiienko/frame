# surface: herdr desktop — the default

herdr is where every thread runs today: clio main and its wings, codie, sixth sense, crow, helga (dima, 2026-11-11: «we currently run in Herdr by default. It's our main place where we run everything»). the base `claude` line is `crew-lead` § the doors; this file holds only how herdr wraps, tabs, finds and stops it. herdr's own mechanics and traps are `x:herdr`, loaded before any `hc` or `herdr-app` call.

## start

- the head: `hc run --bg --no-parent --no-notify --name <short> --cwd <dir> -- claude …`, `<short>` the pane's tag (`cli-codie`), then the base line
- `--remote-control` is a must on every herdr thread: it is what puts the thread in the claude desktop app too, dima's backup door ([surface-claude-desktop.md](surface-claude-desktop.md))
- the tab, the same turn: a `--no-parent` thread has none and herdr's agents list skips it; `x:herdr` § start a member holds the two `do` calls, `skills/herdr/scripts/seat-tab.ts` runs both
- a quick lane: a pane has no bg isolation, so no `--settings`
- `--cwd` is the target repo; a side-lane codie's first reply names its `pwd` (inference until a pane codie's reply shows it)
- done when `herdr-app ls` shows the tab by the thread's registry name

## find and talk

- a thread is reached by its registry name through `SendMessage`, same as on any surface; `hc ls --json` (an object, `.terminals[]`) maps a name to its terminal id
- what a thread shows: `x:herdr` § recipes

## stop

- by its terminal id, `hc kill <t>`, never a bare close: a close with no target ends dima's focused thread
- never a layout save or switch while a thread holds focus: it kills that thread (herdr-app#861, `herdr/PRODUCT.md`)

## when herdr is down

- the threads live on in the claude desktop app through `--remote-control`; a new summon goes by [surface-claude-desktop.md](surface-claude-desktop.md) and says why to dima
