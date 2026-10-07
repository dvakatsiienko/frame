# recipe — refresh-agent-ops

📌 on a test drive: the first runs are measured and the verdict decides whether the recipe stays.

## the want (dima's)

«i spotted, that coder (especially) and verifier tool call chains are sometimes very long … i want to know hot optimal their tool call chains» · «what i missed? i printed only thoughts/ideas but i clearly can miss something bigger»

## research vectors (dima's wording, regroomed with him each run)

the four vectors of the brief, as written there:

1. is tool-call chain length a useful efficiency signal for coding agents, or a misleading one? what do practitioners and vendors measure instead: wasted steps, dead-end exploration, re-reads, failed-command retries, cost per resolved task?
2. which recurring maintenance activities for an agent fleet have the best evidence of payoff, with concrete recipes: eval sets of real tasks, transcript failure taxonomies, context and memory trimming, tool and skill description tuning, trigger-accuracy measurement, cost per finished ticket, reviewer-loop calibration?
3. what is the smallest useful eval harness for a solo developer's agent setup: task set size, how tasks are captured from real work, grading by tests vs an llm judge, how often to rerun?
4. which known anti-patterns waste agent tokens or steps in long-running coding sessions, and which fixes worked: hooks, tool design, prompt changes, context pointers, subagent delegation?

## analysis vectors (local evidence)

- the flawlog `#dima-caught` lines since the last run: the verifier's true finds, false alarms and misses
- **doors** (dima, 2026-10-07: «this is very useful data. how/where to automate this check?») — raw calls per external cli (`linear api`, `gh api`, `curl`, inline python) classified by operation; the seed run found 981 `linear api` + 93 curl calls in 30 days and reshaped the `linear` family. each class is a verb candidate. plus:
  - repeated chains: the same 2–3 command sequence across sessions
  - Bash writes: heredoc and python edits that skip `Edit`/`Write` and their hooks
  - re-reads: the same ticket or doc read again in one session (a context gap)
  - linear extras: comments by actor (each notifies dima), time in Triage, a read followed by a raw call on the same id
  - guard refusals per rule: a hazard rule that never fires dies, one that fires daily earns a verb
  - skill loads per session (`Skill` tool calls): a skill nobody loads in 30 days is a delete candidate; ground truth for jev's router
  - dima's wait: from his prompt to the reply, per session and per kind of ask
  - cost per member and per ticket from the usage fields, the `researcher` agent's saving included
- the engine is `duckdb` on its test drive (`docs/test-drive/duckdb.md`): each measure is a saved `.sql` file, run in under a second over the transcripts

## artifacts (pointed at, never housed)

- `docs/knowledge/agent-ops.md` — the verdict, the five activities, the 7-day numbers
- `script/agent-ops.ts` — `pnpm agent-ops:report`: cost per ticket, cclio code edits, boot cost; gains `--doors` (the 2026-10-07 seed classifier was a throwaway regex script; `--doors` rebuilds it), later `x fleet doors`

## the run

1. regroom the four vectors with dima; drop what the last run already answered
2. research: the brief goes through `pnpm research:lanes <brief>` (exa + parallel) and one opus source lane on the papers, the cc docs and `claude plugin eval`, a fresh agent never a fork
3. analysis: run the chain stats script over the last 7 days, compare with the numbers in the artifact
4. distill into `docs/knowledge/agent-ops.md`: clever-merge, keep the verdict, update the numbers and the five; raw lane output dies here
5. overhaul proposal, never silent edits: what is new, what it changes in the fleet, noop included; resolve with dima

## cadence

every two weeks while on the test drive, then at a model change or a memory sweep. an eval-set activity from the five moves the cadence to its own reruns.

## last run

none yet. the seed run was 2026-10-07: three lanes (exa 109 s, parallel 591 s, an opus source lane) distilled into `docs/research/agent-fleet-maintenance.md`, which this recipe's artifact replaces.
