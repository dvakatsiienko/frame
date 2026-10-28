---
id: PK-281
title: 'FRM-425 leftovers: the coder''s 9 named findings and its spec-process issues'
status: done
assignee: []
created_date: '2026-10-27T14:21:00Z'
updated_date: '2026-10-28T16:40:00Z'
due_date: '2026-10-28'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W269 (2026-10-27 16:09, dima): coder found some issues with the process, something related to specs.
W270 (2026-10-27 16:09, dima): go ask him about them, but don't go back and forth with main lane.
W271 (2026-10-27 16:09, dima): first, solve plan scope, and then resolve researcher/coder's smaller findings right after, in the nearest free window.
the list: ~/.local/state/x/lanes/FRM-425/2026-10-27-FRM-425-findings.md (9 not fixed) + the /goal trial gaps (FRM-1) + coderabbit's pocket-green.json JSON.parse catch + note-vet hangs on an open stdin
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
verifier retro (16:34, ~/.local/state/x/lanes/FRM-425/2026-10-27-FRM-425-verifier-retro.md), two automation candidates: `x lane verify-tree` taking an unpushed main sha (built by hand this lane); a shared guard-probe fixture exported from x-mod-guard's tests (hand-written five times)

2026-10-27 18:30 cclio: «note-vet hangs on an open stdin» does not hold for the code — ccrow/note-vet.ts reads no stdin; its one wait polls notes.jsonl for the id until WAIT_MS. a hang is that poll on an id not yet written. no fix; drop the line at the item's close

ticket: FRM-467
close: W269–W271 → FRM-467 § riders (2026-10-28 tails hunt); the coderabbit pocket-green.json crash has no reader left
<!-- SECTION:NOTES:END -->
