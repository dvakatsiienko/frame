---
status: live
until: 2026-11-12
dies-when: the verdict line below is written
fits: codie sixth-sense
---

# wisphunter — the code-review subagent card 🐆

Ticket: FRM-455

**test card:** we believe a card made for review finds the real slips in a diff at fewer false hits and lower cost than the researcher and helper cards it replaces · we test it by every code review in the fleet for 14 days (codies' local review pair, sixth sense's second reads, clio's diff checks, the rename sweep's review) · we measure per review: findings that held, false hits, slips missed against a known list where one exists, tokens and dollars per spawn, wall time, and which card the spawn landed on · we're right if, judged by clio against FRM-425's findings file, the union of both axes returns ≥5 of FRM-425's 6 known slips in 2 of 3 runs, finds FRM-431 `07136ee6`'s held-out slip, keeps false hits ≤1 in 4 findings, and no review spawn lands on `researcher` or `helper` in the 14 days
**kill rule:** two benchmark runs in a row under 4 of 6, or false hits over 1 in 2 across 3 real reviews

## day 0
- the users and the docs: `docs/research/code-review-card.md` (2026-10-29) — Anthropic's code-review plugin and Code Review docs, the Opus 5 / 5.5 prompting guides, coderabbit, greptile, graphite, bugbot

## stress list
- the standards axis — matt's `code-review` on FRM-425's diff, 3 runs — slips found of 6, false hits, tokens
- the spec axis — the same diff against FRM-425's spec — gaps found, false hits
- a held-out diff — FRM-431 `07136ee6`, sixth sense's exit-1 refute (the throw guard wrapped only the lane cards) — found yes or no
- the diff-file door — a worktree-isolated codie hands a diff file — read with no git refusal, yes or no
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

### round 1 — the rename sweep, 2026-10-29 (dima-mode codie, Opus 5.5)
- 15 runs, 41.3 min of review wall time, median 2.2 min, range 1.0–7.8; 65k–216k tokens a run where recorded
- yield, runs from step 5 on: ~48 findings, ~46 real and acted on, 1 by-design, 1 declined for a hidden constraint, 0 pure noise; every bug sat in a gate-green tree
- catches nobody else made: a renamed word inside dima's quote, the only old-role-key test lost, the guard's underscore hole, the `clio:*` preflight owner, the profile redraw never run (spec axis)
- use: plain card + codie's brief 12×, paired beside the built-in `/code-review` 1×, as matt's two axis cards 2×; the brief decides the yield — naming the read-both rule and «already fixed, do not re-report» kept it on new ground
- fit, built-in `/code-review`: not a drop-in, the skill bars subagents for its own angles, so the pair runs side by side; the card found 5 real bugs the angles missed, the angles 2 low ones the card missed
- fit, matt's `code-review`: a drop-in, each axis one card
- codie's verdict: adopt as the default review card, keep per-slice runs, brief it with the rules the diff must keep

### round 2 — the rename sweep post-run wave 1, 2026-10-30 (clio, Opus 5.5)
- matt's two axes as cards, background, ~5 min (standards, 184k tokens, 48 calls) and ~8 min (spec, 129k, 66 calls)
- 16 findings, 8 per axis, all real on read; the spec card checked live state outside git with the brief's `rg`, which is where the sweep's last misses sat

## verdict
