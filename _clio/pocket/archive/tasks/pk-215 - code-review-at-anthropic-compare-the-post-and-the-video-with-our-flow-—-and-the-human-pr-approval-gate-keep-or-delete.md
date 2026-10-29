---
id: PK-215
title: >-
  code review at anthropic: compare the post and the video with our flow — and
  the human pr approval gate, keep or delete
status: done
assignee: []
created_date: '2026-10-20 11:02'
updated_date: '2026-10-20 11:54'
labels:
  - m
dependencies: []
priority: next
type: wish
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-20, dima: read [this post](https://claude.dev/blog/solving-code-review-at-anthropic/) and [video](https://www.youtube.com/watch?v=d8QpDbBKbAU&list=PLqvvsYr0T3pnevG3huCGVrqVuLwPpU-gu&index=5). compare the ideas to our system: which tactics could we borrow, or how could we change our flows to simplify, unload burdens and cut time on repeated operations? i think about my human pr approval gate: today you merge only after i press «approved», but i actually never do the code review — i press «approved» blindly as a chore (or ask you). the gate has nearly no value. propose how to simplify or optimize it, say whether it is ok to delete that gate, and propose other parts of our system worth optimizing with the post's and the video's best practices.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-20 done: research docs/research/code-review-human-gate.md; the gate rule ticked → FRM-401; the post's other simplifications (one blocking reviewer, round-3 rethink, REVIEW.md) sit in the doc's point 9, out of FRM-401 by its «out» line
<!-- SECTION:NOTES:END -->
