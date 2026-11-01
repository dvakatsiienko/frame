---
id: PK-295
title: >-
  fleet wisps from the side channel: yt-transcript picks an auto-translated
  caption track; the worktree hook blocks trashing yt-transcript transit folders
  on the shelf
status: open
assignee: []
created_date: '2026-11-01T15:59:00Z'
updated_date: '2026-11-01T16:31:00Z'
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
<!-- SECTION:NOTES:END -->
