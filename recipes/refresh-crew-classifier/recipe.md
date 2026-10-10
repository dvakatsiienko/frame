---
kind: refresh
owner: coordinator
cadence: "monthly, or at a jev model bump, or when a flow's vet streak breaks twice in a week"
artifacts:
  - cclio/memory/sys-jev.md
  - script/lib/jev-questions.ts
  - docs/research/skill-router.md
script: jev:report
was: [refresh-branch-classification, refresh-jev, refresh-classification]
---

# refresh-crew-classifier

keeps the classifier seat true: the engine (jev today, unless a better one wins), our flows on it, and the craft of writing them. born 2026-10-05 from FRM-305.

## the want

> i dont want another failing jev flows i want jev to be useful (FRM-268, 2026-10-01)

> still, somehow everyone tells that jev works great as a skill router, why it does not works for us? (2026-10-05)

> it seems that we often approach jev here in a here-and-there manner, and classification recipes for jev are tricky and intricate, and when jev flows approach randomly, it produces bare results (e.g., a half-working jev flows implementation) (2026-10-05)

> i think a «hunt already built to borrow» case is essential, plus «hunt already built for inspo ideas». and hunt jev itself alternatives. (2026-10-05)

> add/merge vectors: jev best practices - how to build solid jev flows? consult with jev docs too … so it is generic for a case if we swap jev into something else? but currently holds jev as our main classifier and should refresh primarily for jev, unless better alternative is found. (2026-10-05)

> the seat is called «classifier», not jev, on purpose: jev is just a model, a tool, and we could find another model for classification some day. what matters is the type of operation. the field looks bare because jev and classification are very new; jev is frozen only because we overspent, and it is useful. (2026-10-08)

## the run

1. **research**: after the groom (`x:shape-recipe` step 0), one brief from the vectors below; `pnpm research:lanes <brief> <out>` (exa + parallel) + an opus source lane (vectors 2–4 need source reading) — `habit-research-lanes`. done: every lane returned or marked failed. (script)
2. **distill** — clever-merge into the guide and the rubrics' comments; raw lane output stays in `last/` until the next run's distill. done: the artifacts carry the merge, or are named «unchanged». (open)
3. **eval + findings** — grade every lane in `docs/test-drive/{exa,parallel}.md`; findings print. done: the grades are in the test-drive files. (template)
4. **resolve** — with dima: a rubric change ships as a commit with `RUNS=3` numbers in its body; noop is fine. done: his word on each change. (open)
5. **a model bump** — before re-pinning `jev-1.13.0`, every flow's fixtures replay on the new model; a drop blocks the pin. done: the replay numbers, or «no bump». (script)
6. **log** today's line in `log.md`. done: the line is there. (open)

## vectors

### research

every vector's finding is read against our flows: name the step, file or habit of ours it shows wrong, or «nothing».

1. jev itself — docs.typesafe.ai, the cookbooks, the changelog, new models since `jev-1.13.0`: what changed, what a cookbook now does that our flows don't
2. **how to build solid jev flows** — jev's own best-practice docs first (question design, Choice vs Noul, criteria, thresholds, multi-stage flows, evals), then what builders report: the rules that separate a working flow from a half-working one, each with its source
3. **hunt already built to borrow** — published jev flows and skill/tool routers (github, the awesome-jev index, grep-mcp for `typesafe` / `jev` imports): read their SOURCE, name what to copy; last run's finds are in `docs/research/skill-router.md` § prior art the lanes found
4. **hunt already built for inspo** — unusual or high-value classification uses by others that our fleet could adopt (inbox lanes, review triage, flawlog lanes, spawn gating …)
5. **jev alternatives** — other classifiers for the same jobs: embedding routers, semantic-router, a small model (haiku) with a schema, BM25 + thresholds; cost, latency and accuracy against jev on our fixtures
6. classification craft — the literature on what makes a typed judgment reliable: context windows (the last turn, never all history), hard negatives, per-route thresholds on held-out data, abstention, multi-label coverage metrics

### analysis

1. the vet: `pnpm jev:vet` streaks and every miss since the last run (`shelf/jev/<flow>.log`) — a miss pattern is a rubric to reword
2. the router: `pnpm jev:report` health (avg, p95 against the hook's 8 s timeout), `pnpm jev:route --from-log` near-misses, fixture coverage (every skill with ≥ 1 positive, the held-out split)
3. the rubrics: `script/lib/jev-questions.ts` — every flow against the guide's rules; a rule the code breaks is a finding
4. the guide: is every rule in it still true on our numbers?
5. **a living eval set** — each run hand-labels ~10 fresh prompts from `route.log` (and the inputs of every other flow) and adds every real miss as a fixture, so the fixtures follow how dima talks instead of freezing
6. **a cheap baseline, every run** — the same fixtures through a small model with a schema (haiku) beside jev: «is jev still worth it» gets a number each run
7. **the flow inventory** — every jev flow in the fleet on one list: owner, vet state, last tuned, weekly cost; a flow nobody reads or tunes is cut8. **the budget gate** — what stops a replay or a bulk run from overspending again (the 10-05 freeze: $4.43 in a day on a $5 monthly credit), which flows are fail-soft when the engine is down or out of credit, and which engine each flow could fall back to
9. **never retire the seat for lack of prior art** — the field is young; a verdict on the seat names the engine it judged, and «retire» is a verdict on an engine, never on the operation
10. **classification candidates from inside** — scan the flawlog and coder retros for judgment calls agents keep making by hand; each is a candidate flow

## artifacts

- `cclio/memory/sys-jev.md`: the rules a coder loads when touching jev, the lanes, the vet policy, the sharpening loop; the rules move to `x:guide-classification` once it exists
- `script/lib/jev-questions.ts` — every rubric, model pinned
- `docs/research/skill-router.md` — written by FRM-305 from the 2026-10-05 lanes; dies into the guide

## findings

- our mistakes: every flow step, file or habit a vector showed wrong, with the vector that showed it
- print dima the delta: what to copy, what to drop, which flow to rebuild
- the checklist, re-checked every run: the engine judged, the jobs found, the budget gate — never a retire verdict without the engine named
- the verify list for a jev change's verifier lives in `cclio/memory/sys-jev.md` (verify — what a jev change's verifier runs)
