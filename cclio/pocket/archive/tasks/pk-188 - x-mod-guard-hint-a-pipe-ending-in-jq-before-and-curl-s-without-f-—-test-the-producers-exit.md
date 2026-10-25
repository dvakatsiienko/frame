---
id: PK-188
title: >-
  x-mod-guard hint: a pipe ending in jq before &&, and curl -s without -f — test
  the producer's exit
status: done
assignee: []
created_date: '2026-10-18 16:59'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-25'
labels:
  - xs
dependencies: []
priority: later
type: task
ordinal: 100600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (its P4 wisps).

halt flush 2026-10-18 (dima's halt word): the pipe-tail exit trap, 2nd sighting — 18:26 `op item get … 2>/dev/null | jq … && echo EXISTS` printed EXISTS for a missing item (jq on empty input exits 0), 18:35 `curl -s` with hand-built json. a warn rule with red-proofs: hint «pipestatus / curl -f».
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: moved — FRM-428 carries this item (its body lists «pocket PK-188») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
