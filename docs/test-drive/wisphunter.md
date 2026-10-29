---
status: live
until: 2026-11-12
dies-when: the verdict line below is written
fits: coder, verifier
---

# wisphunter — the code-review subagent card 🐆

Ticket: FRM-455

**test card:** we believe a card made for review finds the real slips in a diff at fewer false hits and lower cost than the researcher and helper cards it replaces · we test it by every code review in the fleet for 14 days (coders' local review pair, the verifier's second reads, cclio's diff checks, the rename sweep's review) · we measure per review: findings that held, false hits, slips missed against a known list where one exists, tokens and dollars per spawn, wall time, and which card the spawn landed on · we're right if, judged by cclio against FRM-425's findings file, the union of both axes returns ≥5 of FRM-425's 6 known slips in 2 of 3 runs, finds FRM-431 `07136ee6`'s held-out slip, keeps false hits ≤1 in 4 findings, and no review spawn lands on `researcher` or `helper` in the 14 days
**kill rule:** two benchmark runs in a row under 4 of 6, or false hits over 1 in 2 across 3 real reviews

## day 0
- the users and the docs: `docs/research/code-review-card.md` (2026-10-29) — Anthropic's code-review plugin and Code Review docs, the Opus 5 / 5.5 prompting guides, coderabbit, greptile, graphite, bugbot

## stress list
- the standards axis — matt's `code-review` on FRM-425's diff, 3 runs — slips found of 6, false hits, tokens
- the spec axis — the same diff against FRM-425's spec — gaps found, false hits
- a held-out diff — FRM-431 `07136ee6`, the verifier's exit-1 refute (the throw guard wrapped only the lane cards) — found yes or no
- the diff-file door — a worktree-isolated coder hands a diff file — read with no git refusal, yes or no
- routing from the built-in `/code-review` — which card its review agents land on — wisphunter yes or no
- a clean diff — `## findings (0)` with a `checked:` line — yes or no, false hits
- the granular memory — the first request's input tokens against the researcher card's ~10k and full memory's ~82k
- the count — the duckdb query below: `Agent` spawns by `subagent_type` whose prompt names a review; baseline 2026-10-22…29: wishkeeper 84 (its own audits), helper 63, researcher 58, none named 25, fork 12, helper-lite 8, general-purpose 4

```sql
with rows as (select json from read_ndjson_objects('/Users/dima/.claude/projects/*/*.jsonl', ignore_errors=true)),
calls as (select json->>'timestamp' ts, unnest(from_json(json->'message'->'content', '["JSON"]')) c
  from rows where json->>'type' = 'assistant' and json->>'timestamp' >= '<since>')
select c->'input'->>'subagent_type' card, count(*) review_spawns from calls
where c->>'type' = 'tool_use' and c->>'name' = 'Agent' and regexp_matches(lower(c->'input'->>'prompt'), '\breview')
group by 1 order by 2 desc;
```

## rounds

## verdict
