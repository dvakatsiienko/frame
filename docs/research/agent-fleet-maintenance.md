---
dies-when: the five activities below are each a recipe, a test drive or a dropped line (the 07 retarget, pocket)
---

# agent fleet maintenance — what is worth doing

Ticket: none

Three lanes on one brief, 2026-10-07 (exa 109 s, parallel 591 s, an opus source lane): is tool-call chain length a useful signal, and which maintenance activities pay off for a solo Claude Code fleet. raw lane output stayed in the session scratchpad.

## the verdict, all three lanes agree

- **chain length is the wrong target.** failed SWE-agent runs are longer and noisier ([arXiv 2511.00197](https://arxiv.org/abs/2511.00197), 2025-10), so length follows failure; it does not cause it. cutting length rewards stopping early and skipping verification. our 7-day numbers already rule out the cheap waste: identical repeated calls ≈ 0, the longest silent run is 19.
- **measure outcome and cost first, then the kind of waste inside a run.** 10.7 % of passing runs are «lucky passes» with blind retries or missing verification ([AgentLens, arXiv 2605.12925](https://arxiv.org/abs/2605.12925)).
- **a generic waste detector is unreliable**: the best method on RedundancyBench scored 24.88 % (parallel lane). label waste by hand on a sample first.

## the five, merged across lanes

1. **an eval set** — two sizes:
   - skill triggers, through `claude plugin eval` (cc ≥ 2.1.269, [docs](https://code.claude.com/docs/en/plugin-evals)): prompt + `tool_used: Skill` graders, 3 runs, a no-plugin baseline, `--max-cost-usd`. seed from `shelf/jev/fixtures/skill-router.jsonl`. only the opus lane found it; it is the cheap first step (~2 h)
   - 20 real tasks from merged tickets whose exit lines are tests, rerun at a model or memory change ([Anthropic, demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01: «20–50 tasks drawn from real failures»). ~5 h to seed, rare runs
2. **a transcript failure taxonomy** — label one primary cause on the 10–20 most expensive, failed or verifier-rejected runs (bad localisation, unproductive search, blind retry, test not run, wrong patch, false verifier finding); [MAST](https://arxiv.org/abs/2503.13657) gives 14 modes in 3 groups. ~1 h a week
3. **cost per accepted ticket** — coder + verifier + retries per ticket id, divided by merged tickets. the `flow:chains` script already pairs sessions by ticket
4. **verifier calibration** — replay ~15 past rounds: true find, false alarm, missed (against `#dima-caught`); precision and recall, as Cognition evaluates its evaluators
5. **context, tool and skill trimming** — driven by 1 and 2, one measured change at a time: the memory sweep (FRM-267) is this activity

## where the lanes split

- order: exa and parallel put the real-task suite first; the opus lane puts the skill-trigger eval first because the tool already exists and costs hours, not days
- the opus lane proposed a scripted waste scan; parallel's RedundancyBench number says label by hand before trusting a script
