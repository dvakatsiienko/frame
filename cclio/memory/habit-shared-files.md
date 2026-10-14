# shared-files hygiene — inbox, pocket, scratch

Shared files are Dima's living space; leftovers cost him attention and blur what is pending.

## the obsidian channel — ideas he drops from mobile, iCloud sync, no mount needed

`/Users/dima/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq/`

- `inbox.md` — his raw drops. **Check first thing every boot; it must always end empty of
  CONTENT — his section headers stay**, they are his reprint-saving skeleton. Every item becomes a
  pocket item; **reset at every halt by copying `inbox-template.md` over
  it** (`/cclio:halt` phase 1.5) — the template is his, read-only.
- `pocket.md` — a read-only mirror of the pocket for his phone, rewritten after every cclio turn (`.claude/hooks/pocket-mirror.sh`); a phone edit there is lost, his asks go in the inbox.

## the pocket — cclio's local work pool (Backlog.md in `~/frame/cclio/pocket/`, dima 2026-10-07, Backlog.md adopted 2026-10-11)

one `pk-N` task per item (`backlog task create|edit|list --plain --sort ordinal`, from a script `BACKLOG_CWD=~/frame/cclio`): status open · claimed · waiting · done, the `ordinal` is the order, a size label xs · s · m · l; a spec-sized item gets its spec in the target repo's `.scratch/`. the old file is frozen as `_pocket.md`.
**checked and emptied before linear**; it holds ticketless by-hand work too. an item points at its
linear ticket when one exists; a new ticket is made only when a coder takes the item. every inbox
item lands here at parse time, before any resolution; a resolved item is set `done`, and the halt files it (`backlog task complete`) after the day's gazette post carries it.
**what the pocket is for** (dima, 2026-10-10): items to be done first, things never meant for the long shelf. linear is the long shelf, for bigger settled wishes he allows to wait. moving an item from the pocket to linear is never its solve, only a postponement, and he wants things done — so keeping an item in the pocket is fine, cluttering it is not.
**the birth gate** (dima, 2026-10-10, after a 60-item pocket ate a whole day): an item gets its fate the turn it is born, and an ask of his born anywhere — a grill, a sweep plan, a log or test-drive line — is born here too, never with that line as its only home (#dima-caught 10-09 crew-dna, 10-10 the verbatim-fold sweep) — `xs` (minutes) is solved now or at the next siesta; a bigger one stays in the pocket and gets worked in order; it goes to linear only on his word that it may wait; blocked goes to waiting with its `**waiting for:**` first line and a due date, a deliberately deferred one gets a `parked: <reason>` line. a done item is set `done` the turn it closes and filed by the halt — he reads the pocket often, a stale state is not allowed. `pocket-check` reds every breach and runs on every status move (`onStatusChange`, a notification when red); a red pocket runs before the main lane.
**a pocket write with its fields known goes to composer as a `pocket-write` chore** (dima, 2026-10-14: 1 of ~6 went to him that day); a write that needs wording stays mine.
**an item that gets a ticket carries a `ticket: FRM-N` line**; `pocket-check` (the boot runs it) reds any open item whose ticket linear has closed (dima, 2026-10-09, after pk-44 stayed open behind a closed FRM-371: «keep your pocket up to date»).

## the stash hierarchy — dima's, 2026-09-27

Keep-in-mind stashes, all with one job: nothing he wants solved lands on a long shelf and gets
forgotten. Linear is the long shelf — a ticket parked there is invisible at the next boot; a stash
line is in front of cclio every boot.

- **reminders** (`memory/_reminders.md`) — a date or a condition: «in 2 days», «before we halt»,
  «when cc ships X, test it with me».
- **pocket** (`~/frame/cclio/pocket/`) — the main carry-over across sessions, checked before linear. «after X, do Z» becomes a pocket item ordered right after X (`x:queue` retired 2026-10-14, dima)
- **Linear** — the folding place for work with a shape.

❗ no data loss, the pocket above all: a line he wrote or asked for moves or dies only on his word; cclio's own copies and done items die by the dedupe and cleanup rules below.

**no copies** (dima, 2026-09-27: «make sure these stashes don't accumulate redundant stuff») — most
of the 09-27 exhaust was copies: 11 of 17 flowlog lines and 5 of 14 reminders already lived in a ticket.
before a stash line is written, grep the other stashes and linear for it; a copy cclio wrote dies the moment a ticket,
a rule or another stash carries it; a line of his carried elsewhere is asked about at the halt. a watch that a parallel monitor runs keeps only its action in
reminders, the monitor is the trigger.

## cleanup runs the same turn

Working artifacts die the turn their job is done: resolved pocket items, scratchpad files,
`/tmp` dumps from CLI heredocs.

- 🚫 never destroy pending or ambiguous content (root `CLAUDE.md`, the invariant #8) — in doubt, mark done and
  ask at the halt.
- **exemption:** `docs/research/*` is kept — deletion there is his manual call; the duty is
  linkage (`Ticket: FRM-N` at the top), not removal.

