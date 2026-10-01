---
dies-when: FRM-287 reaches a verdict — the adviser lands in `x:shape-idea` (and this doc distills into it) or is dropped
---

# plan adviser — a stronger model arguing with a shape before the build

Ticket: [FRM-287](https://linear.app/x-com/issue/FRM-287)

dima, 2026-10-01: «whenever we shape the idea you could spawn a --bg fable and provide it with full context of our plan. and ask to be an advise, to spot our idea/plan flaws, do its own judgement, try to cover weak parts that we plannd. think from different angles than we did. although still needs a full scale research how to do this properly and measure if it is worth it.»

lanes: exa agent (108 s, $0.10) · parallel core (229 s) · an opus source lane (real prompts and docs) · neuroarxiv (30 abstracts). the brief and raw lane output were scratch.

## the verdict

**worth one measured trial, as a `--bg` session with our own brief — never Claude Code's built-in advisor.** the gain is unproven for plan critique; every number below transfers from coding, qa or judging benchmarks.

## what the lanes found

- **claude code already has an adviser door, and it is the wrong one here** (source lane, read at the docs): `claude --advisor fable` / `/advisor fable` / `advisorModel` pairs an opus 5.5 session with a fable 5.1 advisor. it sees the whole transcript, takes no brief, Claude decides when to call it, and with opus 5.5 or fable 5.1 its advice comes back encrypted (`advisor_redacted_result`) — nothing to log, nothing to measure. Anthropic's own number for the pairing: **+1.7 points for ~2.1× the cost, «at the edge of run-to-run noise»; «the advisor buys about what more effort does»** (opus 5.5 `xhigh` alone scored 91.1 vs the pairing's 90.1)
- **an external critic beats self-critique; a critic told where to look beats one that hunts** — self-critique on planning collapses while a sound external verifier gives large gains (arxiv 2402.08115); models are bad at finding errors and good at fixing a located one (2311.08516)
- **argue, don't consult**: an assigned opponent reached 84 % judge accuracy vs 74 % for a consultant, at 68 % of the length (2311.08702); stronger debaters help, stronger consultants hurt
- **the template does the work, not the hostility**: oh-my-claudecode's critic trial first showed +92 % findings from a «this was written by a 7B model» framing; with the output template held equal the effect reversed (81 vs 99 findings) — «the real intervention is structured output» ([omc#1240](https://github.com/Yeachan-Heo/oh-my-claudecode/issues/1240)). Anthropic warns that ALL-CAPS «you MUST» wording makes opus overtrigger
- **anchoring is real**: a prior score or verdict in the prompt pulls 7 of 8 judges toward it (2608.25869); a user's confident framing raises agreement (2502.08177: 58 % sycophantic cases). strip dima's lean, the planner's confidence and any earlier critic's verdict from the brief
- **same family, same blind spots**: capable models' mistakes converge and judges favour similar models (2502.04313) — fable reviewing an opus plan is a same-family pair. a cross-family panel of smaller judges beat one large judge at >7× lower cost (2404.18796)
- **critics hallucinate bugs** (2407.00215): every finding is a candidate until dima's accept / later proof labels it

## the adviser brief — the shape to trial

- **pass 1, blind**: the want, the constraints and the done test only (no plan) → its own top approaches and failure modes. `advise-project-approach` already does this pass
- **pass 2, full plan**, a fixed template:
  - predict the 3–5 likeliest problem areas before reading in detail
  - a pre-mortem: «assume this plan was executed exactly as written and failed — 5 concrete failure scenarios»
  - the strongest argument against each decision, and the alternative that was likely rejected
  - what is missing
  - the fragile assumptions, rated
  - a self-audit: «could the author refute this with context I lack?» → yes moves it to open questions
  - findings capped at 5, each quoting the plan line it targets, with a cheap test that would confirm it
  - a verdict: proceed · revise · investigate · reject — and «no material objection» is an allowed answer
- read-only, a `--bg` session, the brief written by cclio; the output is a file we can log

## measuring it

- one jsonl line per finding: run · arm · located (y/n) · severity · accepted · later proven right / wrong / unknown · cost
- arms on the same plan: `advise-project-approach` blind (today's baseline) · fable 5.1 `high` on the template · opus 5.5 `high` on the same template (Anthropic: «baseline the advisor's model alone first») — so the template and the model are measured apart
- a cheap offline check before real plans: plans with planted flaws plus clean plans, each arm 3 runs, ~$3–5 per full run (omc's harsh-critic benchmark shape)
- the verdict number: confirmed material findings per dollar, false alarms counted against it
- the trigger: every shape during the trial window, then narrowed by the data (irreversible decisions and unresolved forks are the candidates — an inference, no lane measured it)

## where it broke

- no lane found a study of an adviser on software plans; all transfer is inference
- Anthropic's measured pairing gain sits inside noise
- the native advisor is unloggable as of cc 2.1.286
