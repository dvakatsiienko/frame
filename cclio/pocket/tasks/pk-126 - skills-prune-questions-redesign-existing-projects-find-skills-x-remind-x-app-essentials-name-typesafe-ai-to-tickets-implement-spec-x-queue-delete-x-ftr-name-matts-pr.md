---
id: PK-126
title: >-
  skills prune questions: redesign-existing-projects, find-skills, x:remind,
  x:app-essentials name, typesafe-ai, to-tickets, implement-spec, x:queue
  delete, x:ftr name, matt's pr
status: done
assignee: []
created_date: '2026-10-14 11:48'
updated_date: '2026-10-15 11:42'
due_date: '2026-10-16'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 10620
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
skills prune questions from the inbox (2026-10-14). settled at sweep 9.3 (o56–o61): find-skills, redesign-existing-projects, greploop and x:queue dropped; greptile-cli, x:mobile-mode, x:cclio-mode, typesafe-ai, quicksilver, advise-project-approach kept. matt's skills: PK-125 kept his full install. the census replaces /skill-doctor (it overcounts ~10×, #92327) and now counts reads by hand too. open for 9.5: rename x:app-essentials and x:ftr to say what they do (init or verify); x:remind fold or keep; to-tickets and implement-spec stay read-by-hand.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
his reminder in the same drop: «remind me to paste you skill-doctor output so we optimize skills» — due at 9.2: tell him the census (transcripts via duckdb) replaces skill-doctor, which overcounts ~10× (#92327).
renames, their own ask: x:app-essentials and x:ftr get names that say what they do (init or verify) — a rename pick per skill, not a census number.

2026-10-14 21:01: renames landed on dima's pick (o106 r4): x:app-essentials → x:app-setup-essentials, x:ftr → x:app-author-ftr (pairs with x:author-memory, scoped to an app)

2026-10-15 closed in the tail sweep: every prune question settled at 9.3, both renames landed 10-14; the skill-doctor answer (the census replaces it, it overcounts ~10×) told to dima on the 10-15 board.
<!-- SECTION:NOTES:END -->
