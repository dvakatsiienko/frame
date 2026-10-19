---
id: PK-27
title: 'refresh-guide-go: ever run? seeds guide-go and the charm knowledge'
status: done
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-09 13:46'
labels:
  - m
dependencies:
  - PK-28
priority: next
type: question
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 65 · status line was: open · question + task · inbox 10-09, dima-question · after shape-recipe is refreshed (66)

- dima: did we ever run the refresh go recipe, to seed the `x:guide-go` skill and the charm knowledge? is the knowledge fresh? sharpen it after the shape-recipe skill is refreshed
- «charm knowledge» (dima-question): which is better — 1. stay in `docs/knowledge`, or 2. park inside the go skill + a skill-go reference
- the recipe exists: `recipes/refresh-guide-go/`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
answered 10-09: the recipe ran once on 10-07 (docs/knowledge/charm.md verified-on 10-07), its log.md never recorded it — fixed; charm stays in docs/knowledge (dima's pick 1, the recipe wires it). left: sharpen after shape-recipe is refreshed (pk-28).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
refresh-guide-go ran once (10-07), seeded docs/knowledge/charm.md; dima 10-09: charm stays in docs/knowledge, served by x knowledge read (logged); the next run adds a nonce (pk-44)
<!-- SECTION:FINAL_SUMMARY:END -->
