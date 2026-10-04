# shared-files hygiene — inbox, flowlog, scratch

Shared files are Dima's living space; leftovers cost him attention and blur what is pending.

## the obsidian channel — ideas he drops from mobile, iCloud sync, no mount needed

`/Users/dima/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq/`

- `inbox.md` — his raw drops. **Check first thing every boot; it must always end empty of
  CONTENT — his section headers stay**, they are his reprint-saving skeleton. Copy items into
  `flowlog.md` with statuses (✅🚧❓⏸️🎫); **reset at every halt by copying `inbox-template.md` over
  it** (`/cclio:halt` phase 1.5) — the template is his, read-only.
- `flowlog.md` — the processing journal AND the boot checklist: every inbox item lands here at
  parse time with status + lane, before any resolution. **✅ items pruned at every halt, unasked**
  — only carry-over survives. **carry-over admits only unticketable waits** (dima's hands, an
  open decision): anything with a ticket id is the ticket's job and dies from the list; the BOOT
  flags any ⏸️ older than ~3 sessions — mechanical, not halt-attention (2026-08-27, the rotted
  8-line backlog).
- `protected.md` — his own drop file, read-only, never ours to edit.

## the stash hierarchy — dima's, 2026-09-27

Keep-in-mind stashes, all with one job: nothing he wants solved lands on a long shelf and gets
forgotten. Linear is the long shelf — a ticket parked there is invisible at the next boot; a stash
line is in front of cclio every boot. The stashes stay even after the shift flow is proven.

- **queue** (`.claude/x-queue.md`) — soon: «after X and Y, do Z». ideally empty.
- **reminders** (`memory/_reminders.md`) — a date or a condition: «in 2 days», «before we halt»,
  «when cc ships X, test it with me».
- **flowlog** (`_hq/flowlog.md`) — the main carry-over across sessions.
- **Linear** — the folding place for work with a shape.

❗ no data loss, the flowlog above all: a stash line moves or dies only on his word.

**no copies** (dima, 2026-09-27: «make sure that these stashes will not accumulate redundant stuff») — most
of the 09-27 exhaust was copies: 11 of 17 flowlog lines and 5 of 14 reminders already lived in a ticket.
before a stash line is written, grep the other stashes and linear for it; a line dies the moment a ticket,
a rule or another stash carries it. a watch that a parallel monitor runs keeps only its action in
reminders, the monitor is the trigger.

## cleanup runs the same turn

Working artifacts die the turn their job is done: processed flowlog buckets, scratchpad files,
`/tmp` dumps from CLI heredocs.

- 🚫 never destroy pending or ambiguous content (root `CLAUDE.md`, the invariant #8) — in doubt, mark done and
  ask at the halt.
- **exemption:** `docs/research/*` is kept — deletion there is his manual call; the duty is
  linkage (`Ticket: FRM-N` at the top), not removal.

🌍 Fleet-wide habit; never push into another surface's store yourself.
