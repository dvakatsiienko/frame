# agent-ops — what is worth measuring and maintaining in the fleet

read when asking «are the coder and verifier chains too long?» or planning agent maintenance; maintained by the `refresh-agent-ops` recipe (`recipes/refresh-agent-ops/`).

verified-on: 2026-10-07 (three lanes: exa, parallel, an opus source lane; numbers from 189 transcripts, 7 days)

## the verdict

- **chain length is the wrong target.** failed runs are longer and noisier ([arXiv 2511.00197](https://arxiv.org/abs/2511.00197), 2025-10), so length follows failure and does not cause it. cutting it rewards stopping early and skipping verification.
- **measure outcome and cost first, then the kind of waste inside a run.** 10.7 % of passing runs are «lucky passes» with blind retries or missing verification ([AgentLens, arXiv 2605.12925](https://arxiv.org/abs/2605.12925)).
- **a generic waste detector is unreliable.** the best method on RedundancyBench scored 24.88 % (parallel lane), so label waste by hand on a sample before trusting a script.

## the 7-day numbers (2026-10-07)

- coders: median 131 tool calls per session
- longest silent run (calls with no text between): 19
- longest run without a human prompt: median 70, max 364
- repeated identical calls: about 0
- verifiers: a quarter to a third of their coder's calls

the cheap waste (loops, repeats) is already absent. what remains is cost and outcome.

## the five activities

1. **an eval set**, two sizes
   - skill triggers through `claude plugin eval` ([docs](https://code.claude.com/docs/en/plugin-evals), cc 2.1.269 or later): prompt + `tool_used: Skill` graders, 3 runs, a no-plugin baseline, `--max-cost-usd`. first step: seed from `shelf/jev/fixtures/skill-router.jsonl`. setup about 2 h, but each case runs a full session (~137k base context in the fleet tier): 10 cases × 3 runs × 2 arms = 60 sessions. price one case first (`--max-cost-usd 1`); parked until the weekly budget allows (pocket 31). a plugin-only tier is cheaper and overstates accuracy, the full-fleet tier is the truth
   - 20 real tasks from merged tickets whose exit lines are tests, rerun at a model or memory change ([Anthropic, demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01). cost about 5 h to seed, rare runs
2. **a transcript failure taxonomy**: label one primary cause on the 10 to 20 most expensive, failed or verifier-rejected runs; [MAST](https://arxiv.org/abs/2503.13657) gives 14 modes in 3 groups. cost about 1 h a week
3. **cost per accepted ticket**: coder + verifier + retries per ticket id, divided by merged tickets. `pnpm agent-ops:report` prints it (median 30.0M tokens, 30 min wall over 23 tickets, 2026-10-07; tokens are mostly cache reads)
4. **verifier calibration**: replay about 15 past rounds, mark true find, false alarm, missed (against `#dima-caught`), compute precision and recall
5. **context, tool and skill trimming**: driven by 1 and 2, one measured change at a time; the memory sweep (FRM-267) is this activity

## where the lanes split

- order: exa and parallel put the real-task suite first; the opus lane puts the skill-trigger eval first because the tool exists and costs hours
- the opus lane proposed a scripted waste scan; parallel's RedundancyBench number says label by hand first
