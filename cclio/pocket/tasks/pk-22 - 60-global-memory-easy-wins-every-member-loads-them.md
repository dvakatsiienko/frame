---
id: PK-22
title: '[60] global memory easy wins, every member loads them'
status: done
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-09 13:05'
due_date: '2026-10-09'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 60 · status line was: open · task · planned ahead of the sweep (dima, 2026-10-08)

- from cclio's 10-07 20:29 answer: `fleet-hazards` lines whose `x-mod-guard` rule exists die (~3–4k chars); `fleet-tooling` cc-only trial lines (duckdb, ctx7) move to their test-drive files (~2k); frame `AGENTS.md` launchd + tcc hazards move to `schedule/AGENTS.md` (~3k). ~8–9k chars, ~3k tokens per session for every member
- `rules/` and frame `AGENTS.md` edits need dima's word before the edit

## decisions so far

- 2026-10-09: 35 done: all 6 purged shas answer 422 «no commit found» on github; the backup bundle is already gone with its /tmp scratch
- 2026-10-09: 40 «wishes» as a bytes name lands in [BYT-60](https://linear.app/x-com/issue/BYT-60) (rename bytes), decided at the merge with a name grill
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
rules 10-09: vault hazards → x:notes, bash sandbox → 1 line, worktree-hooks line died, ctx7 adopted, duckdb trial text out; −2.5k chars per boot (624aac57). the 10-07 estimate (8–9k) was stale: launchd/tcc had already moved
<!-- SECTION:FINAL_SUMMARY:END -->
