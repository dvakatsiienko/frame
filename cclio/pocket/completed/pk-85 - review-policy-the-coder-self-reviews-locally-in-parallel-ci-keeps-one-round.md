---
id: PK-85
title: 'review policy: the coder self-reviews locally in parallel, ci keeps one round'
status: done
assignee: []
created_date: '2026-10-12 11:08'
updated_date: '2026-10-13 15:29'
due_date: '2026-10-16'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 100200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, inbox 2026-10-12, folded. what is the current self-review policy for a coder and for ci; how many rounds is ci capped at, 2? let it be one, and give the coder matt's code review: it runs it in parallel with coderabbit (his «CR»), waits for both, fixes, grades each review's usefulness and quality into a log file, applies fixes as reviews arrive, then tells the verifier. why: ci review is slow; local is faster and needs fewer hops; ci review exists for a standard software flow and stays as the final gate, but patching should be robust and agile, so reviews move closer to coder + verifier. 1. the coder saves the verifier work by self-reviewing (matt's review, maybe the builtin /code-review — which is better?, coderabbit: 3 reviews/h, quota-out is silent); 2. the verifier saves ci hops by making sure all works before the push; 3. ci is the final gate — the worst part is a fail restarts the coder loop.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: queued under the ≤5 open cap, 2026-10-12 — worked in ordinal order after PK-75–79

18:32 folded into FRM-72, the pm review (o157)
<!-- SECTION:NOTES:END -->
