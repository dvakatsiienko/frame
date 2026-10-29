---
id: PK-113
title: >-
  ccrow vets never lost: a vet before the harvest queues, and an unvetted note
  is flagged at cclio's turn end
status: done
assignee: []
created_date: '2026-10-13 11:18'
updated_date: '2026-10-13 14:36'
due_date: '2026-10-15'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10113
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
10-13: two vets failed with «no note with id» because cclio vetted within a minute of the note, before harvest.ts logged it; the first went unseen under a hook error (ccrow caught it, note 202610131417). fix: note-vet waits ≤60 s for the note line, then queues the verdict; the harvester (or a Stop hook) flags a sent note with no vet at the next turn end. the holdout test to 10-20 loses a data point per miss.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
17:35 part 1 landed: ccrow/note-vet.ts waits ≤60 s (CCROW_VET_WAIT_MS) for the note line, polling every 2 s, then fails loud naming the wait; probed on a scratch state dir: a note appended 3 s late → vetted (exit 0, 1 verdict), a missing id → exit 2 after the wait. part 2 (an unvetted sent note flagged at cclio's turn end) open, on dima's word (orbit).

17:40 part 2 landed (dima o148 ✓): ccrow/unvetted.ts, cclio's Stop hook (pnpm ccrow:unvetted) blocks her turn end once per «🔴 sent» note with no verdict, naming the vet command; probed on a fixture: only the unvetted sent note flagged, the second run silent; live run today: nothing unvetted.
<!-- SECTION:NOTES:END -->
