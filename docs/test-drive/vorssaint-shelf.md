---
status: adopted
until: 2026-10-17
dies-when: the verdict line below is written (2026-10-17) — adopted as a door in rules/fleet-doors.md, or dropped
---

# vorssaint shelf — dima's drop box for more screenshots than a prompt holds

Ticket: none

dima, 2026-10-01: «your input prompt only allows five screenshots at once, and sometimes I send more screenshots, so they don't fit into one turn. I will drop those screenshots on the shelf and tell you to check that out. Possibly, I can drop more things there, so let's use this approach. test drive.»

- the read: `pnpm vorssaint:shelf` (`--json` for a machine read) — the app keeps the list as json in its preferences (`com.vorssaint.utils` → `shelfItems`); items are paths, the files stay where he saved them
- the trigger words: «check my shelf», «on the shelf», «dropped it on the shelf»
- 📌 `shelfRemoveAfterDrop = 1`: dragging an item off the shelf removes it, so the list is what he has not used yet

## stress list
- a batch of 6+ screenshots in one ask — all read, in order
- a non-image drop (a file, a link, text) — what the item looks like
- an item whose file moved — the «(gone)» line
- the shelf after he drags items out — the list shrinks as expected

## log — date · items · kinds · read ok · note
- 2026-10-01 · 1 · file (jpg) · ok · the first read, a screenshot of a cclio reply
- 2026-10-16 14:22 · siesta-freebie probe · `pnpm vorssaint:shelf` reads 6 items, all CleanShots from 10-15 19:51 · the first one is named in 2 cclio transcripts, so the batch was read yesterday (inference: all 6, same batch) · 📌 finding: items stay after a read — only a drag removes them — so «the list is what he has not used yet» holds only if he drags; a reader can't tell new from read without a seen-list

## verdict

- 2026-10-16 · **adopted** (dima: «it itself is useful, and it works, so let's use it») · 2 real reads (1 on 10-01, a 6-shot batch on 10-15), every item read · untried: a non-image drop, a moved file · the door line lives in `rules/fleet-doors.md`; items stay until dragged off, so a read names what it already read

## the reminder, moved here (2026-10-11, o139)

⏰ 🔬 vorssaint shelf test drive, two weeks to 2026-10-17 — dima drops screenshots past the 5-per-prompt cap on the vorssaint utils shelf and says «check my shelf»; read with `pnpm vorssaint:shelf`, one log line per read in `docs/test-drive/vorssaint-shelf.md`. on 10-17: a door line in `rules/fleet-doors.md` (his approval), or drop. dima 2026-10-01: «let's use this approach. test drive.» — set 2026-10-01
