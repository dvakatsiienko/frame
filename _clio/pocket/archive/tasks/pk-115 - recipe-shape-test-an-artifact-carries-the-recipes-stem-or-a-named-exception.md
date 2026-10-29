---
id: PK-115
title: 'recipe-shape test: an artifact carries the recipe''s stem, or a named exception'
status: done
assignee: []
created_date: '2026-10-13 13:20'
updated_date: '2026-10-13 14:49'
due_date: '2026-10-16'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10115
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's o172 ✓ (10-13). audit: refresh-cc-mods, refresh-crew-classifier, refresh-crew-coordinator(-adviser, -pocket), refresh-job-market carry no stem in their artifacts; each gets a rename or an exception line. guard for the 10-13 code-hosts.md miss.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
17:57 landed: script/lib/recipe-shape.test.ts reds a refresh recipe with no artifact carrying its stem or the stem's last word (/ read as -), member-named crew-* exempt; recipes/AGENTS.md § names says so. red-proven both ways: code-storage's artifact swapped → red; the crew exemption removed → red. today all 18 recipes pass.
<!-- SECTION:NOTES:END -->
