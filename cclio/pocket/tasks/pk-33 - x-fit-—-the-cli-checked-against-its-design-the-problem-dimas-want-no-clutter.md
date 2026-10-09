---
id: PK-33
title: >-
  x-fit — the cli checked against its design: the problem, dima's want, no
  clutter
status: open
assignee: []
created_date: '2026-10-09 11:06'
labels:
  - m
dependencies: []
references:
  - 'https://linear.app/x-com/issue/FRM-284'
priority: next
type: task
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-09: a census script + a project skill instead of a recipe. «the skill should correctly translate what i actually want from the skill run — to ensure that cli does not drift from its initial design: what problem it solves, my want, and does not clutter/drift.»
- numbers half: `pnpm x:census` (verbs per family, x stats, raw Bash heads with no verb, open cli tickets), no model
- judgment half: project skill `x-fit` reads x/PRODUCT.md's want + the census, prints plan fit (met / partly / missing / contradicted) and keep / merge / cut per family
- seed: today's review, docs/research/cli-architecture-review.md; runs before every cli lane
- after the pocket settles
<!-- SECTION:DESCRIPTION:END -->
