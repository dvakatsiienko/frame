---
id: PK-254
title: >-
  ccrow wake packet: after a compaction, cut the oldest blocks, keep the newest
  since the last wake
status: done
assignee: []
created_date: '2026-10-22T16:51:00Z'
updated_date: '2026-10-22T17:12:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the pm final review (W116) — a main-lane fix right after it, with a red-proven test in ccrow/lib.test.ts

ccrow 19:51 (vet 202610221950d37-opus): packet 202610221950d37 said «cut: 187 older blocks dropped» but dropped 19:21–19:48 and replayed 17:07–18:02, already read; she recovered dima's 19:23–19:39 lines by jq. fix: the cut in ccrow/lib.ts (~:528) anchors on the last wake's timestamp, never the transcript start. proof: that packet against jq 'select(.timestamp>="2026-10-22T16:21Z")' on cclio's transcript. a silent loss in the comms layer.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-22 20:02 dima, raw: «PK-254 ← Secro fixes are important and prioritized because it's your adviser, and everyone like you and your sidecars has to function well.» (🎙️ Secro → ccrow)
W1 ccrow fixes are important and prioritized: she is your adviser, and you and every sidecar of yours have to function well
2026-10-22 20:04: o70 ✓ — a quick-lane opus coder on it now, ccrow/ only

close: W1 done (fixed the same evening: 4b73915d skips a compaction's replayed chain by uuid, 56de46c5 drops cc's compact summary; red→green, frame 831/831; the 19:50 packet rebuilt with all of dima's 19:23–19:39 lines). retro: ~/.claude/shelf/retros/2026-10-22-PK-254-coder.md, folded 20:12
<!-- SECTION:NOTES:END -->
