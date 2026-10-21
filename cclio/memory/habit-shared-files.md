# shared-files hygiene — inbox, pocket, scratch

Shared files are Dima's living space; leftovers cost him attention and blur what is pending.

## the obsidian channel — his drops from mobile, in the vault's `_hq/`

- `inbox.md` ends every session empty of content, his section headers kept (his reprint-saving skeleton); the paths, the read and the reset live where they run: `cclio:boot` step 3 and `cclio:halt` phase 1.5. `pocket.md` there is a read-only phone mirror (`.claude/hooks/pocket-mirror.sh`): a phone edit is lost, his asks go in the inbox.

## the pocket — cclio's local work pool (Backlog.md in `~/frame/cclio/pocket/`, dima 2026-10-07, Backlog.md adopted 2026-10-11)

one `pk-N` task per item (born green by `node script/pocket-add.ts`, moved between priorities by `node script/pocket-move.ts <PK-N> now|next|later`, both picking the band's ordinal; else `backlog task edit|list --plain --sort ordinal`, from a script `BACKLOG_CWD=~/frame/cclio`): status open · claimed · waiting · done, the `ordinal` is the order, a size label xs · s · m · l; a spec-sized item gets its spec in the target repo's `.scratch/`.
**a note is appended, never replaced**: `backlog task edit <id> --append-notes "…"`; `pocket-check` reds a note line lost since HEAD.
<!-- failure: a `--notes` close replaced PK-90's and PK-141's notes, dima's quoted steers (memory-sweep log, wishkeeper siesta rounds 7–13); `--notes` replaces every note -->

**checked and emptied before linear**; it holds ticketless by-hand work too. an item points at its
linear ticket when one exists; a new ticket is made only when a coder takes the item. every inbox
item lands here at parse time, before any resolution; a resolved item is set `done`, and the halt files it (`backlog task archive`) after the day's gazette post carries it.
**what the pocket is for** (dima, 2026-10-10): items to be done first, things never meant for the long shelf. linear is the long shelf, for bigger settled wishes he allows to wait. moving an item from the pocket to linear is never its solve, only a postponement, and he wants things done — so keeping an item in the pocket is fine, cluttering it is not.
**the birth gate** (dima, 2026-10-10, after a 60-item pocket ate a whole day): an item gets its fate the turn it is born, and an ask of his born anywhere — a grill, a sweep plan, a log or test-drive line — is born here too, never with that line as its only home — `xs` (minutes) is solved now or at the next siesta; a bigger one stays in the pocket and gets worked in order; it goes to linear only on his word that it may wait; blocked goes to waiting with its `**waiting for:**` first line and a due date, a deliberately deferred one gets a `parked: <reason>` line. a done item is set `done` the turn it closes and filed by the halt — he reads the pocket often, a stale state is not allowed. `pocket-check` reds every breach and runs on every status move (`onStatusChange`, a notification when red); a red pocket runs before the main lane.
**a pocket write with its fields known goes to composer as a `pocket-write` chore**; a write that needs wording stays mine.
<!-- 2026-10-14, dima: 1 of ~6 pocket writes went to composer that day -->

**an item that gets a ticket carries a `ticket: FRM-N` line**; `pocket-check` (the boot runs it) reds any open item whose ticket linear has closed (dima, 2026-10-09, after pk-44 stayed open behind a closed FRM-371: «keep your pocket up to date»).

## the stash hierarchy — dima's, 2026-09-27

Keep-in-mind stashes, all with one job: nothing he wants solved lands on a long shelf and gets
forgotten. Linear is the long shelf — a ticket parked there is invisible at the next boot; a stash
line is in front of cclio every boot.

- **reminders** (`memory/_reminders.md`) — a date or a condition: «in 2 days», «before we halt»,
  «when cc ships X, test it with me».
- **pocket** (`~/frame/cclio/pocket/`) — the main carry-over across sessions, checked before linear. «after X, do Z» becomes a pocket item ordered right after X
- **Linear** — the folding place for work with a shape.
- **watches** — every upstream thing we follow (a github issue or pr, a release feed, a page) is a watch in x-changedetector, `http://127.0.0.1:7390`, never a link kept in prose to re-fetch; cclio owns every watch (dima, 2026-10-16: «I lean towards yourself, but you have to properly shape your habit»): an upstream link met anywhere — a report, a ticket body, a reminder, his inbox — gets `pnpm -C ~/frame x-changedetector:watch-add <url>` the same turn (it skips a watched url); any web link in his prompt (our own surfaces skipped) arrives with a hook nudge (`watch-nudge.ts`); removal runs at the boot's upstream read (`cclio:boot` step 4); members never add one. on trial, `docs/test-drive/x-changedetector.md`.

❗ no data loss, the pocket above all: a line he wrote or asked for moves or dies only on his word.

**no copies** (dima, 2026-09-27: «make sure these stashes don't accumulate redundant stuff») — most
of the 09-27 exhaust was copies: 11 of 17 flowlog lines and 5 of 14 reminders already lived in a ticket.
before a stash line is written, grep the other stashes and linear for it; a copy cclio wrote dies the moment a ticket,
a rule or another stash carries it; a line of his carried elsewhere is asked about at the halt. a watch that a parallel monitor runs keeps only its action in
reminders, the monitor is the trigger.

## cleanup runs the same turn

Working artifacts die the turn their job is done: resolved pocket items, scratchpad files,
`/tmp` dumps from CLI heredocs.

- **a background task dies the turn its answer is read** — a shell or an agent whose result folded gets `TaskStop` with its id that turn, and a check of the running list rides every siesta; only the standing pr and ci watches outlive their turn (10-16: a fork's research lane and a count shell sat «running» for hours after their answers landed)

- 🚫 never destroy pending or ambiguous content (root `CLAUDE.md`, the invariant #8) — in doubt, mark done and
  ask at the halt.
- **exemption:** `docs/research/*` is kept — deletion there is his manual call; the duty is
  linkage (`Ticket: FRM-N` at the top), not removal.

