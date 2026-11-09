---
status: live
until: 2026-11-14
dies-when: the verdict line below is written
fits: codie sixth-sense
---

# wisphunter — the code-review subagent card 🐆

Ticket: FRM-455

**test card:** we believe a card made for review finds the real slips in a diff at fewer false hits and lower cost than the researcher and helper cards it replaces · we test it by every code review in the fleet for 14 days (codies' local review pair, sixth sense's second reads, clio's diff checks, the rename sweep's review) · we measure per review: findings that held, false hits, slips missed against a known list where one exists, tokens and dollars per spawn, wall time, and which card the spawn landed on · we're right if, judged by clio against FRM-425's findings file, the union of both axes returns ≥5 of FRM-425's 6 known slips in 2 of 3 runs, finds FRM-431 `3b749531`'s held-out slip, keeps false hits ≤1 in 4 findings, and no review spawn lands on `researcher` or `helper` in the 14 days
**kill rule:** two benchmark runs in a row under 4 of 6, or false hits over 1 in 2 across 3 real reviews

## day 0
- the users and the docs: `docs/research/code-review-card.md` (2026-10-29) — Anthropic's code-review plugin and Code Review docs, the Opus 5 / 5.5 prompting guides, coderabbit, greptile, graphite, bugbot

## stress list
- the standards axis — matt's `code-review` on FRM-425's diff, 3 runs — slips found of 6, false hits, tokens
- the spec axis — the same diff against FRM-425's spec — gaps found, false hits
- a held-out diff — FRM-431 `3b749531` (`d9b056e5..3b749531`), sixth sense's exit-1 refute (the throw guard wrapped only the lane cards) — found yes or no
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

### round 3 — mods lane 4, 2026-11-04 (its codies and sixth senses, Opus 5.5)
- 3 reads, 13 real bugs, from the lane's final retro, line 7; tokens not recorded, so this round holds the count alone

### round 4 — frame#125, 2026-11-05 (sixth sense's second read, Opus 5.5)
- 4 findings, 2 reproduced real (a load false green, merged errors), 1 already fixed, 1 nit; it labelled two as inferred, so a brief names which claims it can run
- 2026-11-05 · FRM-480, codie's two axes and sixth sense's read, 8, 6 and 7 findings, all useful, sixth sense still found 6 at round 1; two spec reads against tickets and live code on dima's word, mods 16 findings, cli 20, 4 and 3 high, each opened and held, `mods:replay`'s reach among them; frame#124's read, 5, the silent-end gap among them · ahead of the usual door, keep

### round 5 — retro trial lines, 2026-11-06 (four lane retros)
- 2026-11-06 · frm-514 sixth sense, second read · helped: found a preload gap and a replay drift it had not probed, in 3 min; 1 of its 4 repeated a known read · keep
- 2026-11-06 · frm-514 codie · helped: 2 cards found the compaction bug the built-in missed · keep
- 2026-11-06 · frm-517 codie · helped: found the one defect nobody else did · keep
- 2026-11-06 · mods lane 5 codie · helped: found most real bugs

- 2026-11-06 · BYT-130 ci made boring · codie · helped: the two axes and the scoped read found real gaps the cases missed · keep
- 2026-11-06 · BYT-130 ci made boring · sixth sense · helped: the one real finding came from it, and it marked its own traces as unexecuted · keep; suggestion: brief it with the mutants already run
- 2026-11-06 · cli lane 6 · codie · helped: found the recovery race and the base-only path nobody else did · keep
- 2026-11-06 · BYT-94 ci made boring codie · helped: the spec axis found the permission break and the risky-list gap
- 2026-11-06 · FRM-511 cli lane 5 codie · helped most: a scoped read found 12 real holes after the codie's own fixes; fire it on any rework of a fail-open path
- 2026-11-06 · FRM-511 cli lane 5 sixth sense · helped: the second read found 5 of the 6 round 1 breaks, one claim (`stateDir`) refuted by the code; always reproduce it
- 2026-11-06 · lane retros (BYT-94, FRM-474, FRM-521) · all keep; on FRM-474 2 of 3 findings on the redesign were real false proofs nobody else found; on FRM-521 it found the `--dry` HEAD bug and the shared-checkout break apart from the probe; on BYT-94 2 of 4 were by-design lines it could not see. asks: hand it the known list, name the checkouts a diff's consumers share
- 2026-11-06 · lane retros (FRM-509, FRM-474) · keep; on FRM-509 the mid-rebase break was its read alone in sixth sense's round, the plain card the most useful of codie's five; on FRM-474 a scoped read found a false proof nobody else did
- 2026-11-07 · lane retros (BYT-94, FRM-433, FRM-521, FRM-510) · keep, 4 of 4 helped: ci spec axis 3 of 3 acted on, standards 2 of 5; on FRM-510 2 reads found 7 real and 1 false alarm, each of it and sixth sense finding what the other missed; brief it with what's already found, or it repeats

### round 6 — the escape replay, the benchmark's first run, 2026-11-09 (clio wing 2, FRM-545, Opus 5.5)
- the set: FRM-425's 6 slips (`~/.local/state/x/lanes/FRM-425/2026-10-27-FRM-425-findings.md:7-12`) on `d2d0a87c..c1e9ef0e`, and the held-out H1 on `d9b056e5..3b749531` (the stress list's `07136ee6` is a docs-only commit; `3b749531` is the diff that wrapped only the lane cards)
- one blind run per reader, no slip named in the brief; the cards' files: `.scratch/pk-348/replay/` in the clio-wing-2 tree
- the grid, caught / missed / didn't run:
  - S1 `x linear api` mutation with `projectId: $p` + `--vars` slips the milestone guard — plain missed, spec missed, standards missed
  - S2 `projectMilestoneId: null` counts as a milestone — plain missed, spec caught (a nit), standards missed
  - S3 `railway run rm -rf dist` refused as a remote delete — plain caught (a nit), spec caught (a nit), standards missed
  - S4 a sixth sense's findings to its codie refused as a spec-less lane job — plain caught (a bug), spec missed, standards missed
  - S5 a raw `linear --team X issue create` skips the verb check — missed by all three
  - S6 a ticket id in a quote counts, the why says «any size» — spec half-caught (the item-count mismatch, as a question), plain missed, standards missed
  - H1 the throw guard wraps only the lane cards — spec caught (a bug), plain missed, standards missed
  - didn't run: the built-in `/code-review` (it reviews a live branch or pr, never an old range), coderabbit (no quota today)
- tally: plain 2 of 6, spec 2.5 of 6 plus H1, standards 0 of 6; the union 3.5 of 6 plus H1, under the test card's ≥5 of 6 (one run of the 3 asked; the kill rule needs two runs in a row under 4)
- the trim reading: matt's standards axis added no known slip the other two missed, so the plain card plus the spec axis catch the same known set as all three; its own finds were real but off the set (the milestone rule refusing from day one, which the spec axis also found; an un-gated note; untested parser branches)
- beyond the set, both the plain card and the spec axis found a nested `bash -c` linear move skipping the milestone check, and the plain card a railway delete behind `-s <service>`: candidates for a live check, not slips of record

## verdict
