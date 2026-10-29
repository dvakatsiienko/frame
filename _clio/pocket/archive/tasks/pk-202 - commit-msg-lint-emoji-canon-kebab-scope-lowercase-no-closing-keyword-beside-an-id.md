---
id: PK-202
title: >-
  commit-msg lint: emoji canon, kebab scope, lowercase, no closing keyword
  beside an id
status: done
assignee: []
created_date: '2026-10-19 14:22'
updated_date: '2026-10-19 16:03'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** a free slot after the PK-171 batch — a lefthook commit-msg check in frame (script/), not an x verb; the scan placed it there.

from the FRM-238/239 skill scan, 2026-10-19 (~/frame/docs/research/skill-split-scriptify-scan.md, scriptify section); dima o53 ✓: belongs in x, rides the cli lane.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
19:03 done: script/commit-msg-lint.ts + lib/commit-msg-lint.ts (24 tests), first in lefthook's commit-msg block. refuses: off-canon emoji, no «<emoji> <scope>: <desc>» shape, a conventional-type scope (chore fix feat cleanup format perf refactor style; docs and ci stay, they are frame domains), a trailing period, a closing keyword beside FRM/BYT/DOT ids. warns: a capital opening the description. kebab scope and ≤60 chars left free: 24 and 114 of 300 commits break them. proven through lefthook: 🐛 → exit 1, 🔧 → exit 0; replayed on 300 commits, 3 refused (a renovate commit made on github, a 🔀 merge, one subject with no scope). merges skipped via MERGE_HEAD.
<!-- SECTION:NOTES:END -->
