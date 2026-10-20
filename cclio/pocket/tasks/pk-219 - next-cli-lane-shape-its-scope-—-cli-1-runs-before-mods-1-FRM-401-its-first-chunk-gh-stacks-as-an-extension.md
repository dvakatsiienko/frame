---
id: PK-219
title: >-
  next cli lane: shape its scope — cli 1 runs before mods 1, FRM-401 its first
  chunk, gh stacks as an extension
status: open
assignee: []
created_date: '2026-10-20 13:42'
labels:
  - m
dependencies: []
priority: now
type: wish
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 2026-10-20 16:41, folded: since gh stacks and stacked prs need cli changes, plan the next closest lane as cli 1, not mods 1. shape a scope for it — i don't plan to spend too much effort on the cli lane, but i want it to do a meaningful chunk of useful stuff. there are preplanned chunks already (PK-74 rebase-not-merge, PK-134, PK-145, PK-151, PK-185, PK-189, PK-190, PK-199, PK-200, PK-201, FRM-383, FRM-384, FRM-387): refresh them, review, adjust if in good shape and ready to dispatch. FRM-401 is the lane's first to-do. on FRM-401 and stacks: be careful, gh stacks are unverified and we may discard them — the changes must not break the existing flow; the cli supports both modes, plain prs and gh stacks, as an extension easy to delete; even if stacks are set aside, the support may stay for a later revisit. formulate the specs with these notes in mind. stacks blockers to fold: docs/knowledge/pr-flow.md (pr-open base, merge-main merge commit, push no force, crew-coder no-rebase). doors: cclio:shape-lane, cli-drift-check.
<!-- SECTION:DESCRIPTION:END -->
