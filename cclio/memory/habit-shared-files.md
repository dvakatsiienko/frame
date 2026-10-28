# shared-files hygiene — inbox, pocket, scratch

Shared files are Dima's living space; leftovers cost him attention and blur what is pending.

## the obsidian channel — his drops from mobile, in the vault's `_hq/`

- `inbox.md` ends every session empty of content, his section headers kept (his reprint-saving skeleton); the paths, the read and the reset live where they run: `cclio:boot` step 3 and `cclio:halt` phase 1.5.

## the pocket — cclio's local work pool (Backlog.md in `~/frame/cclio/pocket/`, dima 2026-10-07, Backlog.md adopted 2026-10-11)

one `pk-N` task per item (born green by `node script/pocket-add.ts`, moved between priorities by `node script/pocket-move.ts <PK-N> now|next|later`, both picking the band's ordinal; else `backlog task edit|list --plain --sort ordinal`, from a script `BACKLOG_CWD=~/frame/cclio`): status open · claimed · waiting · done, the `ordinal` is the order, a size label xs · s · m; a spec-sized item gets its spec in the target repo's `.scratch/`.
**a note is appended, never replaced**: `backlog task edit <id> --append-notes "…"`; `pocket-check` reds a note line lost since HEAD, and the pocket hook commits every pocket write in the background, so HEAD is the last write (dima's o37).
<!-- failure: a `--notes` close replaced PK-90's and PK-141's notes, dima's quoted steers (memory-sweep log, wishkeeper siesta rounds 7–13); `--notes` replaces every note -->

**what the pocket is for** (dima, 2026-10-25, W219–W237, grill 1; it replaces the 10-22 round-2 and grill-5 lines): cclio's by-hand stash for quick iteration, pulled from first — the inbox parse lands every item here before any resolution, and the main lane's current scope lives here when no linear ticket owns it (one or more related items, no length cap); cclio's own open questions and shapeless ideas may stay too. everything planned for any time that is not the main lane's current progress lives in linear; nothing ever moves from linear to the pocket. side-lane chunks never enter it. test drives keep their own home in `docs/test-drive/`. «unload the pocket first, always, so it stays as empty as possible» (his board note).
**the birth test is one question: does linear already own this outcome?**
- yes → it is born in linear, a body line of the owning ticket before any new ticket, even when it is worked this minute; no, today-or-tomorrow work → pocket; no, later → linear, into its milestone
- one outcome never lives in both stores. the inbox net comes first: an inbox item lands here at the parse, and the test runs at the halt's sort, so an inbox landing lives ≤1 day. `pocket-add` prints the top linear matches before it writes
- the freebie pre-check: moving an item to linear is never its solve, only a postponement (dima, 2026-10-10), so the freebie test (`craft-pm` § the freebie rule) runs first: a pass is solved that turn with no pocket item, the commit and the reply its record (dima, 2026-10-23, o156; an inbox drop still gets its item at the parse)
- an ask of his born anywhere — a grill, a sweep plan, a log or test-drive line — gets a home, never with that line as its only one
**promotion is one-way**: an item that needs a sign or a coder moves to linear and dies here with `ticket: FRM-N` and a `close:` line. a wait on a lane, a window or a date is linear's, never a pocket `waiting` or `parked` item; a pocket wait ends today or tomorrow.
**staleness, by hand** (W223, W224): every 3 days the boot lists the items untouched for 2 days; each is revalidated by hand — still main lane, or out to linear; a stayer carries `kept: <date> — <why>`, and an item carrying his words is asked at the halt. a done item is set `done` the turn it closes and filed by the halt (`backlog task archive`) after the day's gazette carries it — he reads the pocket often, a stale state is not allowed. `pocket-check` reds every breach and runs on every status move (`onStatusChange`, a notification when red); a red pocket runs before the main lane.
**a pocket write with its fields known goes to composer as a `pocket-write` chore**; a write that needs wording stays mine.
<!-- 2026-10-14, dima: 1 of ~6 pocket writes went to composer that day -->

**an item that gets a ticket carries a `ticket: FRM-N` line**; `pocket-check` (the boot runs it) reds any open item carrying one, unless a `held: <date> — FRM-N <step>` line dated within 3 days names its own ticket and the step it waits for (dima o80; `kept:` is only a stale item that stays); a closed ticket reds it all the same (dima, 2026-10-09, after pk-44 stayed open behind a closed FRM-371: «keep your pocket up to date»).

## the stash hierarchy — dima's, 2026-09-27

Keep-in-mind stashes, all with one job: nothing he wants solved lands on a long shelf and gets
forgotten. Linear is the long shelf, in front of cclio at every boot through the milestone queue; a
ticket outside any milestone is the one that goes unseen.

- **reminders** (`memory/_reminders.md`) — a date or a condition: «in 2 days», «before we halt»,
  «when cc ships X, test it with me».
- **pocket** (`~/frame/cclio/pocket/`) — the by-hand stash, pulled from before linear. «after X, do Z» goes where X lives: a pocket item ordered right after X, or a line in X's ticket
- **Linear** — the folding place for work with a shape.
- **watches** — every upstream thing we follow (a github issue or pr, a release feed, a page) is a watch in x-changedetector, `http://127.0.0.1:7390`, never a link kept in prose to re-fetch; cclio owns every watch (dima, 2026-10-16: «I lean towards yourself, but you have to properly shape your habit»): an upstream link met anywhere — a report, a ticket body, a reminder, his inbox — gets `pnpm -C ~/frame x-changedetector:watch-add <url>` the same turn (it skips a watched url); any web link in his prompt (our own surfaces skipped) arrives with a hook nudge (`watch-nudge.ts`); removal runs at the boot's upstream read (`cclio:boot` step 4); members never add one. adopted 2026-10-22, `docs/test-drive/x-changedetector.md`.

❗ no data loss, the pocket above all: a line he wrote or asked for moves or dies only on his word.

**no copies** (dima, 2026-09-27: «make sure these stashes don't accumulate redundant stuff») — most
of the 09-27 exhaust was copies: 11 of 17 flowlog lines and 5 of 14 reminders already lived in a ticket.
before a stash line is written, grep the other stashes and linear for it; a copy cclio wrote dies the moment a ticket,
a rule or another stash carries it; a line of his carried elsewhere is asked about at the halt. a watch that changedetector runs keeps only its action in
reminders, the monitor is the trigger.

## cleanup runs the same turn

Working artifacts die the turn their job is done: resolved pocket items, scratchpad files,
`/tmp` dumps from CLI heredocs.

- **a background task dies the turn its answer is read** — a shell or an agent whose result folded gets `TaskStop` with its id that turn, and a check of the running list rides every siesta; only the standing pr and ci watches outlive their turn (10-16: a fork's research lane and a count shell sat «running» for hours after their answers landed)

- 🚫 never destroy pending or ambiguous content (root `CLAUDE.md`, the invariant #8) — in doubt, mark done and
  ask at the halt.
- **exemption:** `docs/research/*` is kept — deletion there is his manual call; the duty is
  linkage (`Ticket: FRM-N` at the top), not removal.

