---
kind: refresh
owner: coordinator
cadence: "every two weeks while on the test drive, then at a model change or a memory sweep. an eval-set activity from the five moves the cadence to its own reruns."
artifacts:
  - docs/knowledge/agent-ops.md
  - x/go/fleet_ops.go
script: x fleet ops
---

# refresh-agent-ops

keeps the fleet's upkeep measured: which recurring checks pay, and what our tool-call chains and raw doors cost.

📌 on a test drive: the first runs are measured and the verdict decides whether the recipe stays.

## the want

«i spotted, that coder (especially) and verifier tool call chains are sometimes very long … i want to know how optimal their tool call chains» · «what i missed? i printed only thoughts/ideas but i clearly can miss something bigger» (2026-10-07)

## the run

1. **groom**: `x:shape-recipe` steps 0 and 2. done: his word on the list. (open)
2. research: the brief goes through `pnpm research:lanes <brief>` (exa + parallel) and one opus source lane on the papers, the cc docs and `claude plugin eval`, a fresh agent never a fork. done: every lane returned or marked failed. (script)
3. analysis: `x fleet ops` plus each saved duckdb measure over the last 7 days, set beside the artifact's numbers. done: the numbers side by side. (script)
4. distill into `docs/knowledge/agent-ops.md`: clever-merge, keep the verdict, update the numbers and the five; raw lane output stays in `last/` until the next run's distill. done: the artifact carries the new numbers. (open)
5. findings print, never silent edits; resolve with dima. done: his word on the proposal. (template)
6. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

the four vectors of the brief, in dima's wording, as written there:

1. is tool-call chain length a useful efficiency signal for coding agents, or a misleading one? what do practitioners and vendors measure instead: wasted steps, dead-end exploration, re-reads, failed-command retries, cost per resolved task?
2. which recurring maintenance activities for an agent fleet have the best evidence of payoff, with concrete recipes: eval sets of real tasks, transcript failure taxonomies, context and memory trimming, tool and skill description tuning, trigger-accuracy measurement, cost per finished ticket, reviewer-loop calibration?
3. what is the smallest useful eval harness for a solo developer's agent setup: task set size, how tasks are captured from real work, grading by tests vs an llm judge, how often to rerun?
4. which known anti-patterns waste agent tokens or steps in long-running coding sessions, and which fixes worked: hooks, tool design, prompt changes, context pointers, subagent delegation?

### analysis

- the flawlog `#dima-caught` lines since the last run: the verifier's true finds, false alarms and misses
- **doors** (dima, 2026-10-07: «this is very useful data. how/where to automate this check?») — raw calls per external cli (`linear api`, `gh api`, `curl`, inline python) classified by operation; each class is a verb candidate. plus:
  - repeated chains: the same 2–3 command sequence across sessions
  - Bash writes: heredoc and python edits that skip `Edit`/`Write` and their hooks
  - re-reads: the same ticket or doc read again in one session (a context gap)
  - linear extras: comments by actor (each notifies dima), time in Triage, a read followed by a raw call on the same id
  - guard refusals per rule: a hazard rule that never fires dies, one that fires daily earns a verb
  - skill loads per session (`Skill` tool calls): a skill nobody loads in 30 days is a delete candidate; ground truth for jev's router
  - dima's wait: from his prompt to the reply, per session and per kind of ask
  - cost per member and per ticket from the usage fields, the `researcher` agent's saving included
- the engine is `duckdb` on its test drive (`docs/test-drive/duckdb.md`, verdict 2026-10-21); each analysis vector becomes a `.sql` in this recipe's own `scripts/` the first time it runs

## artifacts

- `docs/knowledge/agent-ops.md` — the verdict, the five activities, the 7-day numbers
- `x/go/fleet_ops.go` — `x fleet ops`: cost per ticket, cclio code edits, boot cost; gains a doors measure later

## findings

- overhaul proposal, never silent edits: what is new, what it changes in the fleet, noop included
