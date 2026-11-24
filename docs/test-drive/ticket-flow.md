---
status: live
until: 2026-12-01
dies-when: the verdict line below is written
---

# ticket-flow — signing moved from dima to clio, a week to see if lanes stop parking

Ticket: FRM-700

**test card:** we believe lanes stop parking for a missing seal once clio signs her own tickets and a script watches the seals · we test it by the running lanes, mods, speak and herdr, 24 Nov → 1 Dec · we measure parks for a missing seal, missed seals, a coder hitting a gap in a signed ticket, the blind critic's highs at a seal, and whether a part grew with nobody told · we're right if no park is a missing seal and no gap costs a lane an hour
**kill rule:** a lane builds something dima did not want because nobody asked him → his word that day, not the date

## what changed on 24 Nov, for a reader who forgot

- before: dima ticked a sign on every ticket and a re-sign after each edit; a lane could not start without it. 96 such asks in 14 days, 94 bare ticks; two parks on 23 Nov were a missing seal, which needs only clio
- now: ✍️ signed means clio groomed the ticket and a lane could start from it alone; no sign or re-sign ask reaches dima. an edit to the running chunk or the next one is groomed, signed and resealed that turn
- what still asks him: a change that refuses or locks something, changes a tool he uses daily, is a part no wish of his asked for, or belongs to a part that doubled; the operator override is untouched (on: every merge with no ask; off: a guard or review merge asks him)
- built: a queue move runs the seal check by itself (`_clio/script/queue-moved.ts`), current plus one ahead. with the stray: FRM-700 (a start refuses an unsealed ticket), FRM-701 (a part over its limit stays red until he keeps it)
- dima, 18:37: «When we reach this date gate, ensure you remind me properly what we are up to doing on the 1st of December (e.g. link me to today's thread and remind me that that reminder is about fixing the ticket flow). Remind me that we removed or changed the signing mechanism»

## on 1 Dec

1. read the five counts: parks and missed seals from the fleet stories and the siesta checks, a coder's gaps from its `[ask]` pings and lane plans, the critic's highs from `~/frame/.scratch/*/critique*`, growth from `x fleet growth`
2. decide the sign as a script (his W43–W49, the list in the ticket-flow notes), keep it by hand, or go back
3. read whether the additions list found anything he took out (`.scratch/*/additions-*.md`), and what else protects scope

## where it lives

- the day's thread: 🦉🪽 clio: wing 1; reopen it: `claude --resume e076e03b-2cf8-473b-9601-7b3a3ff80036` in `~/frame/_clio`; its transcript `/Users/dima/.claude/projects/-Users-dima-frame--clio/e076e03b-2cf8-473b-9601-7b3a3ff80036.jsonl` (from 16:45); his words: PK-468, W1 on
- the gazette of 24 Nov, `_clio/gazette/2026-11-24-*.md`, once the halt writes it

## rounds

## verdict
