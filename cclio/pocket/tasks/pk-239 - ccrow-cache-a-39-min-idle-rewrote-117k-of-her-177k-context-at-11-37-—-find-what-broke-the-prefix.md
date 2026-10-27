---
id: PK-239
title: >-
  ccrow cache: a 39-min idle rewrote 117k of her 177k context at 11:37 — find
  what broke the prefix
status: done
assignee: []
created_date: '2026-10-21T12:06:00Z'
updated_date: '2026-10-27T14:27:00Z'
due_date: '2026-10-28'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
OTel 2026-10-21 (~/.local/share/x-cc-otel/2026-10-21.jsonl, session 3e3e598e): 10:58 read 179k from cache; 11:37 read only 59.7k and wrote 117k to the 1h cache, though the 1h TTL had not expired. inference: something early in her prefix changed — dima's x-cw toggle at ~11:11Z (the skill list), or a mod-injected line. the 🔥 keep-hot ping never fired in that gap (it pings 50 min after), so it was not measured. probe: the next gap with no toggle, same query.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: rides the low tide beside PK-233 (ccrow ledger)

2026-10-21 15:12 correction: my 14:15 «a running session's skill list is fixed when it starts» was wrong — this session got mid-session skill-list reminders (neuroarxiv appeared at 14:46), so a list change can reach a running session. second candidate (ccrow, inference): her cd calls at 13:58 and 15:10 landed as «Environment update» lines in her transcript. probe both.

**waiting for:** the coordinator review (PK-90) and the pm revamp (PK-103) — dima's o81, 2026-10-21 17:45
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

ticket: FRM-461
close: moved to FRM-461 (a wait on two lanes is linear's, round 4 wishkeeper); its why, both candidates and the probe carried there
<!-- SECTION:NOTES:END -->
