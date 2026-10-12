---
id: PK-74
title: 'x lane rebases a coder branch onto main, never a merge commit'
status: open
assignee: []
created_date: '2026-10-12 01:13'
updated_date: '2026-10-12 11:08'
due_date: '2026-10-15'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 2026-10-12 04:13, on the crew-coder groom: «since x lane has no rebase why? no rebase?? noooo merge commits»
- want: a coder whose main moved under it rebases its branch onto origin/main; no merge commit ever lands on a coder branch
- seen (read, not built): `x lane merge-main` is the only catch-up verb and it merges (x/go/registry.json); in a worktree git runs only through x lane, so crew-coder's «rebase onto origin/main» has no door today
- the fork to settle: a rebased pushed branch needs a force-push (with lease), which the floor keeps for dima's word and x-mod-guard refuses; a verb has to own that safely (lease on the read-back sha, coder branches only) or the rule changes
- touches: x lane (merge-main → rebase-main, or a flag), x-mod-guard's force-push rule, crew-coder § 4 the pr watch
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima 2026-10-12 04:30, on a) a rebase-main verb with a lease, coder/* only: «i think i agree but i'm sleepy now» — a lean, not his word; confirm before building

parked: behind the 2026-10-12 drops — dima: «don't rush the memory sweep — solve everything new turn by turn, quality first, then plan the next moves from the new drops»
<!-- SECTION:NOTES:END -->
