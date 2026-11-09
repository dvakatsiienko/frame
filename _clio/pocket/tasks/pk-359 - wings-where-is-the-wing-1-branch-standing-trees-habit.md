---
id: PK-359
title: 'wings: where is the wing-1 branch, standing trees habit'
status: done
assignee: []
created_date: '2026-11-09T12:37:00Z'
updated_date: '2026-11-09T13:10:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 55000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-359:W1 (2026-11-09 inbox, dima): wisp: in scope of winged clio v2, wing 2 added a habit: wing branches and worktrees stand and are never deleted

PK-359:W2 (2026-11-09 inbox, dima): i see only the wing-2 branch now. where is the wing-1 branch? it was active last session, the one solving cpu roasting

raw drop (11-09 inbox, dima): **clio main: wings**

raw drop (11-09 inbox, dima): maybe wisp — in scope of winged clio v2, wing 2 implemented a habit for clio wings — wings branches/wtrees are standing and never deleted. i just saw that only wing-2 branch is present. where is wing-1 branch? it was active prev session (the one that solivng cpu roasting).

raw drop (2026-11-09 inbox, dima): **clio main: wings**

raw drop (2026-11-09 inbox, dima): maybe wisp — in scope of winged clio v2, wing 2 implemented a habit for clio wings — wings branches/wtrees are standing and never deleted. i just saw that only wing-2 branch is present. where is wing-1 branch? it was active prev session (the one that solivng cpu roasting).

PK-359:W3 (2026-11-09 inbox, dima): where is the wing-1 branch? ❓

note 2026-11-09 clio: the raw drops above sit twice, the first set stamped «11-09», the second «2026-11-09» for the groom check; notes are append-only, so both stay

2026-11-09 14:56 clio, the answer: last session's wing 1 (the cpu one) ran as a forked wing in tree fork-483eb11c on branch worktree-fork-483eb11c, never on clio-wing-1, so no standing branch was ever made for it; clio-wing-1 was born today 14:38 with the new wing 1 (reflog). the gap: a forked wing skips the standing seat branch. fix to propose: a forked wing also takes clio-wing-<N>

2026-11-09 15:12 wing 1: the gap already closed — the old wing's tree fork-483eb11c was made 11-07 14:03, the seat rule (every wing, forked or not, takes clio-wing-<N>) landed 11-07 20:58 (4ce50b68), and today's wing 1 took clio-wing-1 by it. the old tree: clean, 0 commits off main, its .scratch/frm-525 copied into clio-wing-1/.scratch (diff clean); its decamp waits on dima's word.

close: W1 done — the habit stands, every wing takes clio-wing-<N> (4ce50b68); W2 done — the old wing 1 ran in fork-483eb11c, decamped on dima's o8; W3 done — answered in this item's notes
<!-- SECTION:NOTES:END -->
