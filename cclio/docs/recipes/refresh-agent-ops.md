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

## artifacts (pointed at, never housed)

- `docs/knowledge/agent-ops.md` — the verdict, the five activities, the 7-day numbers
- `script/agent-ops.ts` — `pnpm agent-ops:report`: cost per ticket, cclio code edits, boot cost

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
