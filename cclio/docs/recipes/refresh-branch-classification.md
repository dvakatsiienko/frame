# refresh-branch-classification — recipe

Keeps the fleet's classification branch sharp: our classifier — jev (typesafe.ai) today, the primary
target of every run unless a better alternative wins — our flows, the craft of writing them, and what
else exists. Born 2026-10-05 from the skill-router research round. Recipe entity per [_spec.md](_spec.md).

## the want (dima's)

> i dont want another failing jev flows i want jev to be useful (FRM-268, 2026-10-01)

> still, somehow everyone tells that jev works great as a skill router, why it does not works for us? (2026-10-05)

> it seems that we often approach jev here in a here-and-there manner, and classification recipes for jev are tricky and intricate, and when jev flows approach randomly, it produces bare results (e.g., a half-working jev flows implementation) (2026-10-05)

> i think a «hunt already built to borrow» case is essential, plus «hunt already built for inspo ideas». and hunt jev itself alternatives. (2026-10-05)

> add/merge vectors: jev best practices - how to build solid jev flows? consult with jev docs too … so it is generic for a case if we swap jev into something else? but currently holds jev as our main classifier and should refresh primarily for jev, unless better alternative is found. (2026-10-05)

## research vectors (re-groom each run)

1. jev itself — docs.typesafe.ai, the cookbooks, the changelog, new models since `jev-1.13.0`: what changed, what a cookbook now does that our flows don't
2. **how to build solid jev flows** — jev's own best-practice docs first (question design, Choice vs Noul, criteria, thresholds, multi-stage flows, evals), then what builders report: the rules that separate a working flow from a half-working one, each with its source
3. **hunt already built to borrow** — published jev flows and skill/tool routers (github, the awesome-jev index, grep-mcp for `typesafe` / `jev` imports): read their SOURCE, name what to copy. last run's finds: kerpopule/hermes-jev-skills, diet103/claude-code-infrastructure-showcase, juew/Skill-Routing-Kit, zhengyanzhao1997/SkillRouter, aurelio-labs/semantic-router
4. **hunt already built for inspo** — unusual or high-value classification uses by others that our fleet could adopt (inbox lanes, review triage, flawlog lanes, spawn gating …)
5. **jev alternatives** — other classifiers for the same jobs: embedding routers, semantic-router, a small model (haiku) with a schema, BM25 + thresholds; cost, latency and accuracy against jev on our fixtures
6. classification craft — the literature on what makes a typed judgment reliable: context windows (the last turn, never all history), hard negatives, per-route thresholds on held-out data, abstention, multi-label coverage metrics

## analysis vectors (local evidence)

1. the vet: `pnpm jev:vet` streaks and every miss since the last run (`shelf/jev/<flow>.log`) — a miss pattern is a rubric to reword
2. the router: `pnpm jev:report` health (avg, p95 against the hook's 8 s timeout), `pnpm jev:route --from-log` near-misses, fixture coverage (every skill with ≥ 1 positive, the held-out split)
3. the rubrics: `script/lib/jev-questions.ts` — every flow against the guide's rules; a rule the code breaks is a finding
4. the guide: is every rule in it still true on our numbers?
5. **a living eval set** — each run hand-labels ~10 fresh prompts from `route.log` (and the inputs of every other flow) and adds every real miss as a fixture, so the fixtures follow how dima talks instead of freezing
6. **a cheap baseline, every run** — the same fixtures through a small model with a schema (haiku) beside jev: «is jev still worth it» gets a number each run
7. **the flow inventory** — every jev flow in the fleet on one list: owner, vet state, last tuned, weekly cost; a flow nobody reads or tunes is cut (today: inbox-lanes, skill-router, flawlog-lanes)
8. **classification candidates from inside** — scan the flawlog and coder retros for judgment calls agents keep making by hand; each is a candidate flow

## artifacts (pointed at, never housed here)

- the jev guide — the craft rules a coder loads when touching jev (home: `x:guide-classification`, built after FRM-305 lands; until then `cclio/memory/sys-jev.md` «the rules» sections)
- `script/lib/jev-questions.ts` — every rubric, model pinned
- `cclio/memory/sys-jev.md` — cclio's side: the lanes, the vet policy, the sharpening loop
- `docs/research/skill-router.md` — written by FRM-305 from the 2026-10-05 lanes; dies into the guide

## the run

1. **research** — one brief from the vectors above; `pnpm research:lanes <brief> <out>` (exa + parallel) + an opus source lane (vectors 2–4 need source reading) — `habit-research-lanes`
2. **distill** — clever-merge into the guide and the rubrics' comments; raw lane output dies here
3. **eval + findings** — print dima the delta: what to copy, what to drop, which flow to rebuild; grade every lane in `docs/test-drive/{exa,parallel}.md`
4. **resolve** — with dima: a rubric change ships as a commit with `RUNS=3` numbers in its body; noop is fine
5. **a model bump** — before re-pinning `jev-1.13.0`, every flow's fixtures replay on the new model; a drop blocks the pin

## cadence

monthly, or at a jev model bump, or when a flow's vet streak breaks twice in a week.

## last run

- 2026-10-05 — the skill-router round (3 lanes, exa 5 · parallel 4 · opus 5): the router misses from what it sees (prompt alone, 32 of ~90 skills, no session memory), not how it's built → [FRM-305](https://linear.app/x-com/issue/FRM-305) skill router v2
