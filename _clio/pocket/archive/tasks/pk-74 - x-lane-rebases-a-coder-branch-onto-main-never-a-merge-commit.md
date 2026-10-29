---
id: PK-74
title: 'x lane rebases a coder branch onto main, never a merge commit'
status: done
assignee: []
created_date: '2026-10-12 01:13'
updated_date: '2026-10-22T16:51:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the cli lane opening — PK-74 is its first chunk (dima o87, 2026-10-12)
dima 2026-10-12 04:13, on the crew-coder groom: «since x lane has no rebase why? no rebase?? noooo merge commits»
- want: a coder whose main moved under it rebases its branch onto origin/main; no merge commit ever lands on a coder branch
- seen (read, not built): `x lane merge-main` is the only catch-up verb and it merges (x/go/registry.json); in a worktree git runs only through x lane, so crew-coder's «rebase onto origin/main» has no door today
- the fork to settle: a rebased pushed branch needs a force-push (with lease), which the floor keeps for dima's word and x-mod-guard refuses; a verb has to own that safely (lease on the read-back sha, coder branches only) or the rule changes
- touches: x lane (merge-main → rebase-main, or a flag), x-mod-guard's force-push rule, crew-coder § 4 the pr watch
<!-- SECTION:DESCRIPTION:END -->

halt flush 2026-10-13 (o181): x brief check flags a todo whose exit-line words match a commit subject from the last week (todo 23 was already built), and a pointer into a doc whose heading grep cannot find.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima 2026-10-12 04:30, on a) a rebase-main verb with a lease, coder/* only: «i think i agree but i'm sleepy now» — a lean, not his word; confirm before building

parked: behind the 2026-10-12 drops — dima: «don't rush the memory sweep — solve everything new turn by turn, quality first, then plan the next moves from the new drops»

dima o87 ✓ 20:37: **waiting for:** the cli lane opening — its first chunk. the lease force-push is approved for this verb only (x lane rebase-main, coder/* branches, --force-with-lease on the read-back sha).

2026-10-19 rider: the tdd trial rides this lane (dima o96) — the coder brief loads mattpocock-skills:tdd and the done report logs a line in docs/test-drive/tdd.md § next lanes

ticket: FRM-403 (cli lane 1, sealed 2026-10-20)

2026-10-22 19:55: closed into FRM-403 at the cli lane 1 spawn (its scope is sealed in that ticket's exit lines; chunk 1 FRM-401 running)
<!-- SECTION:NOTES:END -->
