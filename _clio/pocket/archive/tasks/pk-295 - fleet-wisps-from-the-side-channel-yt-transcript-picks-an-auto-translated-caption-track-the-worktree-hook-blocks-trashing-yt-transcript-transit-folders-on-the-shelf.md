---
id: PK-295
title: >-
  fleet wisps from the side channel: yt-transcript picks an auto-translated
  caption track; the worktree hook blocks trashing yt-transcript transit folders
  on the shelf
status: done
assignee: []
created_date: '2026-11-01T15:59:00Z'
updated_date: '2026-11-04T14:41:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
two transit folders still sit under ~/.claude/shelf; same report path as above
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
side channel's FRM-464 verdict 11-01: boot, role and two-way messaging proven; not exercised: the pocket side label and the worktree round-trip (EnterWorktree → x lane commit → clio's merge); prove both with the next side channel's first small repo edit and one pocket item. the worktree hook also blocked a redirect into $TMPDIR

the worktree guard checks the shell's cwd, not the target path: trash ~/Downloads/x.pem was refused with the shell in ~/frame, passed after cd ~

kept: 2026-11-04 — in today's tails queue, worked one by one on the main lane this session

close: revalidated 2026-11-04 by the side channel. the caption pick: fixed, yt-transcript fetch.sh takes manual en, then the -orig auto key, then en. the transit folders: gone, 25 shelf items, 0 stamped transit. the worktree hook: not reproduced from a worktree shell, a trash of a file outside the tree and a redirect into TMPDIR both exit 0. FRM-464's open half: x lane commit from a worktree ran 4 times today, clio's merge of that branch is the last step; the pocket side label shows on PK-310.
<!-- SECTION:NOTES:END -->
