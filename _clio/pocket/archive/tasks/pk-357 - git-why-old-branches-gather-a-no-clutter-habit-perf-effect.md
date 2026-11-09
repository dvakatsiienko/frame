---
id: PK-357
title: 'git: why old branches gather, a no-clutter habit, perf effect'
status: done
assignee: []
created_date: '2026-11-09T12:37:00Z'
updated_date: '2026-11-09T20:57:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 48000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-357:W1 (2026-11-09 inbox, dima): when: after wing 1 solves its pending perf action items, when free, with me

PK-357:W2 (2026-11-09 inbox, dima): i ran `gba` and found a lot of old branches. why are they gathering? i want the branches clean

PK-357:W3 (2026-11-09 inbox, dima): do not delete them upfront: first i want to know why they gathered and the habit that stops the clutter, then i delete

PK-357:W4 (2026-11-09 inbox, dima): plus: do these strays affect perf? ❓

raw drop (11-09 inbox, dima): **wing 1: git**

raw drop (11-09 inbox, dima): when: after wing 1 solves its pending perf related action items, when free, with me.

raw drop (11-09 inbox, dima): what: i've run `gba` and discovered a lot of old branches. why they gathering? i want git branches clean. (do not delete them upfront. first i want to know why deleted, and proper habit for them to not clutter, then i delete).

raw drop (11-09 inbox, dima): plus: does all these strays it affect perf?

raw drop (2026-11-09 inbox, dima): **wing 1: git**

raw drop (2026-11-09 inbox, dima): when: after wing 1 solves its pending perf related action items, when free, with me.

raw drop (2026-11-09 inbox, dima): what: i've run `gba` and discovered a lot of old branches. why they gathering? i want git branches clean. (do not delete them upfront. first i want to know why deleted, and proper habit for them to not clutter, then i delete).

raw drop (2026-11-09 inbox, dima): plus: does all these strays it affect perf?

note 2026-11-09 clio: the raw drops above sit twice, the first set stamped «11-09», the second «2026-11-09» for the groom check; notes are append-only, so both stay

close 2026-11-09 19:56 wing 1: W2 why they gather → decamp removed the tree but kept its branch; fixed by wing 2's branch-delete-by-lease in frame#152 (FRM-553 queue). W3 the habit → that fix: a decamp now deletes the merged branch with its tree; the 112 local + bytes renovate/minors remote went only after his o52, o53 and typed word, tips logged in the wing 1 tree's .scratch/branches-deleted-tips.txt. W4 perf ❓ → no effect: 0.03 s on branch-listing ops, a 66 MB pack either way. W1 timing met: after the perf items, with him.

close: PK-357:W1 done (after perf items, with him); PK-357:W2 done (decamp kept the branch, fixed in frame#152); PK-357:W3 done (habit = the decamp fix, delete only after his word); PK-357:W4 done (no perf effect, 0.03 s, 66 MB pack)

PK-357:W5 (2026-11-09 19:35, dima): i want all stale branches cleared and pristine. the stale lagged branches should never be present anywhere, nor locally nor on remote, in frame and bytes, so when i print the `gba` alias in the terminal it prints a clean state.

PK-357:W6 (2026-11-09 19:35, dima): how to solve efficiently? do you do it, or ask a subagent to help so your context does not get polluted? ❓ (answered then: one batch by script, the tips logged)

2026-11-09 22:20 reopened (wishkeeper siesta): W5 not yet true — bytes holds a stray `refs/remotes/pr125` (50f593af, 2026-10-08) the branch sort never listed; its delete is asked in orbit

2026-11-09 22:40 wing 1: bytes refs/remotes/pr125 deleted (o86). gba left: seat branches and live lane branches, each with a worktree; one stray, bytes proof/frm-547-review-cite, asked of wing 2. closes once it is gone.

2026-11-09 22:40 wing 2: proof/frm-547-review-cite is its FRM-547 probe plant (pr #149 closed); the delete is wing 2's orbit ask, run on dima's tick. PK-357 closes once it is gone.

close 2026-11-09 22:55 wing 1: PK-357:W5 done — gba clean in both repos: bytes refs/remotes/pr125 deleted (o86), proof/frm-547-review-cite local (wing 2, 22:46) and origin (dima's typed word, 22:54) deleted; what is left is a live seat or lane branch with a worktree, plus origin badges and renovate's

close: PK-357:W5 done (gba clean in both repos: pr125 ref and proof/frm-547-review-cite deleted, the rest live seat or lane branches with a worktree); PK-357:W6 done (answered then: one batch by script)
<!-- SECTION:NOTES:END -->
