---
id: PK-136
title: watch the github issues we care about in one place
status: done
assignee: []
created_date: '2026-10-14 17:35'
updated_date: '2026-10-23T09:23:00Z'
due_date: '2026-10-23'
labels:
  - m
dependencies: []
priority: next
type: idea
ordinal: 10800
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the x-changedetector trial verdict (its date: `docs/test-drive/x-changedetector.md`) — it is the one-place watch this asks for.
dima, 2026-10-14: we track random github issues scattered everywhere (#100843 you-should-know, #95589 bg-spare, #99217 mod panels, the ones in workarounds.md and test-drive files), and there are a lot of them. whenever a fix lands, someone should know — ideally the way parallel monitors work: everything hoisted to one place, we look and see the updates we care about. parallel monitors were tried and did not report issue state changes well, so they may not fit this. not now.

parked: dima's word, «not now» (2026-10-14)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 unparked on dima's word (o10), widened: solve it properly, not as a habit of more github reads. his want, folded: we follow a lot of github issues scattered across claude code, libraries and tools, and need an efficient way to hear when they move. a plain list re-fetched each time is clunky and easy to forget; parallel's monitors failed on github issues (1 of 6 events, 09-27). find a dedicated tool — a centralized watcher like parallel's monitors that works properly, for github issues and maybe everything else — that does the watching by itself; I only peek into it for the whole picture and what changed. research: 3 lanes on cclio/.scratch/research-watcher/brief.md. first watch list: claude-code#88822, #99217, Backlog.md#1070, #1071 + the Backlog.md release (its ⏰ reminder becomes the stopgap this item retires), plus every link the boot's gh watch reads today.

2026-10-15 research landed (3 lanes, cclio/.scratch/research-watcher/): pick changedetection.io self-hosted under launchd, issues watched as github api json + jq (state, labels, comments, updated_at), releases via releases.atom, one GET /api/v1/watch for the agent's read (last_changed vs last_viewed). runner-up urlwatch (brew, no query api); exa's n8n rejected: webhooks need admin on repos we don't own. next: a 7-day test drive on dima's word.

2026-10-15 15:55: x-changedetector live — schedule/jobs/x-changedetector, 54 watches seeded and checked, 0 errors; trial docs/test-drive/x-changedetector.md to 10-22. next: the positive control on a test issue, the boot's read, a push channel.

2026-10-18: priority now → next — it is waiting on the x-changedetector verdict, and the now cap holds today's three items.

2026-10-22 halt: due moved to 10-23 on dima's word («fold everything that wants me for tomorrow»).

2026-10-23: solved by x-changedetector, adopted 10-22 (docs/test-drive/x-changedetector.md § verdict): every watched issue in one place, read at every boot. dima's o1 tick moved the dues; this one closes instead.
<!-- SECTION:NOTES:END -->
