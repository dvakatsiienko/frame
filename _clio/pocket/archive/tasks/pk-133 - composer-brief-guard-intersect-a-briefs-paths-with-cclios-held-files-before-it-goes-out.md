---
id: PK-133
title: >-
  composer brief linter: refuse a brief whose anchors or paths would break the
  chore
status: done
assignee: []
created_date: '2026-10-14 15:29'
updated_date: '2026-10-14 17:48'
due_date: '2026-10-16'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ccrow 18:28: b2 (17:43) and b4 (18:11) broke on a held file, round B's plan would have broken a third time. a check (a script or an x brief verb) refuses a composer brief that names a path cclio holds or that git status shows dirty. flawlog 17:43 already calls it a brief-check candidate.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
second check (18:33, b6 chore 9): every anchor is one physical line copied from a sed -n print and matches exactly once before the brief goes out; a glued two-line anchor failed twice and the retry left a stray «)»

2026-10-14 20:41, composer's 4 ideas folded here (dima's tick o103, linter first): 1 brief linter — an anchor spanning lines, an anchor matching twice, a path another session holds (the held-file check above is its third rule); 2 bulk-replace runner, a json list of anchor/replacement pairs, all or none, non-zero on any miss; 3 receipt-log writer appending to docs/test-drive/composer.md; 4 a true file count on commit briefs. 2–4 ride the hunt list after the linter.

2026-10-14 20:48: linter, bulk-replace runner and receipt writer landed in cclio/script, crew-composer names all three; diff-stat folded into the linter's scope, not built
<!-- SECTION:NOTES:END -->
