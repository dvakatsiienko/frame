---
status: live
until: 2026-12-03
dies-when: the verdict line below is written
---

# effort-raise — the 2026-11-19 effort raises, measured against what they cost dima's weekly usage

Ticket: none

wish: PK-457:W43, PK-457:W44 (dima's o24)

- PK-457:W43 (2026-11-19 19:08, dima): the effort changes feel right; they could be made better, but they will use more of my inference. i want the numbers that confirm it is worth it: a precise measurement of how expensive it was for me and how much better everything was solved, ideally as weekly usage %. my plan is $200 now; after it ends i will most likely move to $100.
- PK-457:W44 (2026-11-19 19:13, dima): let's measure for 7 days: a first round as a checkpoint where we see the numbers, then another 7 days, another read, then the verdict.

**what changed on 2026-11-19:** helga Haiku 5.5 medium → xhigh; `helper` Sonnet 5.5 → high; `fresh-eyes` → high (a try); `scout` stays medium; the stray lane Sonnet 5.5 high by default (was Opus 5.5 medium on some summons).

**test card:** we believe the raised efforts solve chores better for a small rise in usage · we test it by the fleet's real work over two 7-day rounds, no staged runs · we measure weekly usage % (`~/.claude/shelf/cc-usage-window.json` `seven_day.used_percentage`, read at each Monday 06:00 reset), tokens per spawn of each raised card from the transcripts against the 7 days before 2026-11-19, and quality: helga receipt misses (`docs/test-drive/helga.md` receipt log), rework rounds (a 🩹 fix on a card's or the stray's output), and `#dima-caught` lines in `x fleet flow --days 7` · we're right if the weekly usage rises ≤5 points per week while rework or dima-caught falls, or holds with dima's own read «better»

**the cost in his %:** each raised card's tokens per spawn, before and after, priced at the model card's rates, then turned into weekly % by one dollars-to-% rate read off a week's usage against its api-equivalent spend; the rate is re-measured when he moves to the $100 plan (likely ~5 Dec, inside round 2).

**kill rule:** a week on pace to pass 90 % of the weekly window before its reset, with the raised cards' tokens the cause → the raised cards drop back a step that day, dima told in one line.

**rounds:** round 1 read on 2026-11-26 (checkpoint, numbers to dima), round 2 read and the verdict ask on 2026-12-03.

📌 the Monday 2026-11-23 reset closes a mixed week (4 days before the raise, 3 after) and is a fable reset day too; the clean week is 2026-11-23 → 2026-11-30, so the per-spawn tokens carry round 1, the weekly % carries round 2.

## stress list
- helga at xhigh — every groom and pocket write — tokens per chore, receipt misses
- `helper` at high — every mechanical card job — tokens per spawn, 🩹 fixes
- `fresh-eyes` at high — the speak v2 first-screen round (FRM-407) — tokens, spots found
- the stray on Sonnet 5.5 high — every stray chore — tokens per chore, rework against its Opus 5.5 medium days

## rounds
- 2026-11-19 · day 0 · weekly usage 65 % at 19:15, reset 2026-11-23 06:00 · baseline

## verdict
