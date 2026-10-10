# shared-files hygiene — inbox, pocket, scratch

Shared files are Dima's living space; leftovers cost him attention and blur what is pending.

## the obsidian channel — ideas he drops from mobile, iCloud sync, no mount needed

`/Users/dima/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq/`

- `inbox.md` — his raw drops. **Check first thing every boot; it must always end empty of
  CONTENT — his section headers stay**, they are his reprint-saving skeleton. Every item becomes a
  pocket item; **reset at every halt by copying `inbox-template.md` over
  it** (`/cclio:halt` phase 1.5) — the template is his, read-only.
- `flowlog-archive-2026-10-07.md` — the old journal, kept as written.

## the pocket — cclio's local work pool (`~/frame/cclio/pocket.md`, dima 2026-10-07)

one file, shaped after matt's local tracker: order · decisions so far · standing · one section per item; a spec-sized item gets its spec in the target repo's `.scratch/`.
**checked and emptied before linear**; it holds ticketless by-hand work too. an item points at its
linear ticket when one exists; a new ticket is made only when a coder takes the item. every inbox
item lands here at parse time, before any resolution; resolved items leave one line in «decisions
so far» (the file's end); the halt moves those lines into the day's gazette post and empties the section.
**what the pocket is for** (dima, 2026-10-10): items to be done first, things never meant for the long shelf. linear is the long shelf, for bigger settled wishes he allows to wait. moving an item from the pocket to linear is never its solve, only a postponement, and he wants things done — so keeping an item in the pocket is fine, cluttering it is not.
**the birth gate** (dima, 2026-10-10, after a 60-item pocket ate a whole day): an item gets its fate the turn it is born — `xs` (minutes) is solved now or at the next siesta; a bigger one stays in the pocket and gets worked in order; it goes to linear only on his word that it may wait; blocked goes to waiting with its `**waiting for:**` first line, a deliberately deferred one gets a `parked: <reason>` line. a done item is `backlog task complete`d the turn it closes — he reads the pocket often, a stale state is not allowed. `pocket-check` reds every breach, and more than 5 open items (waiting and parked ones excluded): over the cap, the pocket runs before the main lane.
**an item that gets a ticket carries a `ticket: FRM-N` line**; `pocket-check` (the boot runs it) reds any open item whose ticket linear has closed (dima, 2026-10-09, after pk-44 stayed open behind a closed FRM-371: «keep your pocket up to date»).

## the stash hierarchy — dima's, 2026-09-27

Keep-in-mind stashes, all with one job: nothing he wants solved lands on a long shelf and gets
forgotten. Linear is the long shelf — a ticket parked there is invisible at the next boot; a stash
line is in front of cclio every boot. The stashes stay even after the shift flow is proven.

- **reminders** (`memory/_reminders.md`) — a date or a condition: «in 2 days», «before we halt»,
  «when cc ships X, test it with me».
- **pocket** (`~/frame/cclio/pocket.md`) — the main carry-over across sessions, checked before linear. it took the x-queue's job on 10-07: in cclio, `/queue` and «after X, do Z» become a pocket item placed in «order» right after X — local wins over `x:queue`'s `.claude/x-queue.md`, said out loud (the skill stays as is for every other repo)
- **Linear** — the folding place for work with a shape.

❗ no data loss, the pocket above all: a stash line moves or dies only on his word.

**no copies** (dima, 2026-09-27: «make sure that these stashes will not accumulate redundant stuff») — most
of the 09-27 exhaust was copies: 11 of 17 flowlog lines and 5 of 14 reminders already lived in a ticket.
before a stash line is written, grep the other stashes and linear for it; a line dies the moment a ticket,
a rule or another stash carries it. a watch that a parallel monitor runs keeps only its action in
reminders, the monitor is the trigger.

## cleanup runs the same turn

Working artifacts die the turn their job is done: resolved pocket items, scratchpad files,
`/tmp` dumps from CLI heredocs.

- 🚫 never destroy pending or ambiguous content (root `CLAUDE.md`, the invariant #8) — in doubt, mark done and
  ask at the halt.
- **exemption:** `docs/research/*` is kept — deletion there is his manual call; the duty is
  linkage (`Ticket: FRM-N` at the top), not removal.

🌍 Fleet-wide habit; never push into another surface's store yourself.
