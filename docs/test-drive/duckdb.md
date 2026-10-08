# test drive — duckdb, the fleet's measuring engine

verdict due: 2026-10-21 (two weeks) — adopt as the doors engine (a doors measure under `x fleet`) and the ad-hoc measure door, or drop

## the want (dima's, 2026-10-07)

> «i spotted that i often ask for measures especially during test drives. how expensive measurement is? … measure our performance by numbers! … but how to make it also cheap? spent low or nothing, have massive gains?» · «hunt tools that would trivialize system scraping for our frequent measures»

## day 0 — what it is

- duckdb 1.5.6 (`brew`), one binary; SQL straight over globs of json lines: `read_ndjson_objects('~/.claude/projects/*/*.jsonl')` reads every transcript in place, no import step
- an agent calls `duckdb -json -c "…"` or `duckdb -c ".read q.sql"`; a saved `.sql` file is a repeatable measure
- extensions worth a round (the researcher's day-0 read, 2026-10-07, unverified here): `agent_data` (Claude Code conversations and stats as tables, 0.4.0, young), `duck_tails` (git history, 1.8.0), markdown / `read_lines`, `shellfs` (a command's output as a table)
- 📌 the json operators bind loosely: wrap every `->>` comparison in parentheses (`(c->>'type') = 'tool_use'`), and use `->` for a nested hop before the last `->>`
- passed over in the same hunt: meteor (a metadata catalog, reads no local jsonl), mergestat-lite (stale since 2024-03); ccusage (cost and tokens, `--json`) and steampipe (github as SQL) are separate candidates

## stress list — one real ask per feature, widest over deepest

1. transcripts as tables: the doors classification (raw `linear api` calls by operation) — round 1
2. joins in time: what an agent runs within a minute of a linear read — round 1
3. subagent transcripts (`*/subagents/*.jsonl`): cost per helper vs per `researcher` — the omitClaudeMd saving across every run, not one probe
4. token columns: first-request `cache_creation` per spawned agent per day — the spawn grid's base, re-measured
5. the x traces once `x-telemetry` lands: an ad-hoc question `x stats` does not answer
6. markdown: the flawlog `#dima-caught` / `#brief` tags per week (today `x fleet flow`'s tag match)
7. `duck_tails`: pr open → merge median from git history alone
8. `agent_data`: does it read our transcripts, subagents and cache tokens, and is it simpler than raw `read_ndjson_objects`
9. `shellfs` + `gh api`: ci reds per repo per week
10. speed at size: the full 1.7 GB `~/.claude/projects` (subagents and tool results included), cold and warm

## log

one line per round: date · ask · seconds · chars in context · hit · grade against the usual door

- 2026-10-07 · the doors classification of 30 days of `linear api` calls (stress 1) · **0.26 s** (2.0 s cpu, multithreaded) · ~0.6k chars · hit: 611 single reads, 81 lists, 59 searches, 52 delegate updates, 28 body writes — the same picture as the sonnet helper's script · 5/5 against the helper: 115 s and 166k tokens for the same table
- 2026-10-07 · what runs within a minute after a linear read (stress 2) · **0.38 s** · ~0.9k chars · hit, with one gap: `cd ~/frame && …` heads hide the real command, so the next round strips a leading `cd` · 4/5 — no usual door existed (the researcher wrote the query, never ran it)
