---
kind: refresh
owner: coordinator
artifacts:
  - clio:system-checkup
  - docs/research/system-checkup-prior-art.md
script: research:lanes
draft: true
---

# refresh-system-checkup

keeps `clio:system-checkup` the one plate of every health check our fleet needs, sharpened by what others check and by what broke for us.

## the want

dima's, 2026-10-19 (folded):

> «a health check for the entire system … I also don't want to spend unnecessary effort on it. seed an initial place for the flow and start with something small; while it is already seeded and working, we gradually evolve it as we do one operational checkup or another, instead of one dedicated session to build it»

> «it is a pretty common operation in agentic workflows … let's hunt for established good practices: what a proper agentic system checkup should check for»

> «a recipe for it (e.g. refresh system checkup), so it would hunt for ways to sharpen this skill»

> «not a monolith, but a granularized set of checks … whenever we want to know if our system is in good health, we go to the system checkup flow, and it should have everything. it's a unification plate»

## the run

- a new check is born only from a real miss (a 🔴 nobody caught, a flawlog line, a retro) or a practice the research shows paying off; a check green for 90 days in `_clio/checkup/log.md` is proposed for removal
- a check that already lives elsewhere joins by pointer, never by copy; the memory groom, `doctor prompt-audit` and `/skill-doctor` stay in `recipes/nurture-memory`
- suggest a run when: a check has gone 90 days green, a checkup run misses something dima then catches, or a cc release adds a doctor-style built-in

1. **groom**: `clio:shape-recipe` step 0, the grill. done: his word on the list. (open)
2. one research round per `x:research` (exa + parallel + an opus source lane), built by `pnpm recipe:brief refresh-system-checkup`. done: every lane returned or marked failed. (script)
3. distill into the plate: each check kept, added (with its home and its run line) or proposed for removal; the prior-art doc rewritten to today's picture. done: both artifacts touched or named «unchanged». (open)
4. findings print per `x:research` § the print. done: printed. (template)
5. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

- what checks other agentic setups run on themselves, and which ones paid off
- new linters, doctors and telemetry events for agent configs since the last run
- how others keep a checklist from rotting: retiring checks, checking the checker

### analysis

- the checkup log: which checks went red, which never did, which could not run
- the 🔴 that dima caught before a check did (the flawlog's `#dima-caught` lines since the last run)

## artifacts

- `clio:system-checkup` — the plate: its check list and run rules; the distill edits only the lines a finding moves, then `x plugin bump --apply clio`
- `docs/research/system-checkup-prior-art.md` — the outside picture and its sources; the distill rewrites it whole

## findings

- a check earns its line by a fix or an ask it produced; a check that only prints is a removal candidate
