---
id: PK-203
title: >-
  system checkup: a health check for the whole fleet — seed it small, grow it
  with every operational pass
status: done
assignee: []
created_date: '2026-10-19 14:32'
updated_date: '2026-10-19 17:06'
due_date: '2026-10-21'
labels:
  - m
dependencies: []
priority: next
type: wish
ordinal: 10950
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-19 17:31 (folded): a health check for the entire system. the skill split / scriptify hunt was this kind of activity. I don't want unnecessary effort: seed an initial place for the flow, start small, and evolve it gradually as we run one operational checkup or another, instead of one big build session. run it through shape-idea with a prior research round — it's a common operation in agentic workflows, so hunt for established practices: what a proper agentic system checkup checks. my guess at the shape: your own skill, maybe user-invocable only; propose whether it should be model-invocable and have a recipe (e.g. refresh system checkup) that hunts ways to sharpen the skill. do not build the full checkup now.

first check to fold in: the skill split + scriptify scan (docs/research/skill-split-scriptify-scan.md, FRM-238/239).
? model-invocable or user-only · ? skill + recipe pair · ? what it checks first · ? cadence
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: the grill is in dima's thread and orbit, the prior-art research runs; unparked when his answers land.

17:38, dima o56 ✓: a cclio skill the model may load, plus a sharpen recipe (refresh-<stem>); the name goes through top-seven (printed 17:39, cclio's pick system-checkup — his own words, no clash).

17:46, dima's grill answers (folded):
- o56 ✓ name cclio:system-checkup, model-invocable; its recipe refresh-system-checkup, made through shape-recipe. once both exist, an initial run of the checkup to see what it finds.
- o57 ✓ the skill split/scriptify scan is a system checkup check — the checkup is about the healthy shape of the whole system and what could move to the cli or scripts. not a monolith: a granular set of checks. the x cli purpose check (are verbs used, is the automation worth it) stays a script and becomes one list option. run all checks in sequence as one big checkup, or one as a targeted operation; the checkup colocates every health check we have, and may also hold its own dedicated flows.
- o58 ✓ memory-lint stays where it is parked; the checkup is the colocator for checks like it: «whenever we want to know if our system is in good health, we go to the system checkup flow, and it should have everything. it's a unification plate.»
- o59 ✓ no strict cadence — our flows are chaotic and the checkup is big; but try a cadence and see if scheduled runs work. works → keep it; doesn't → switch to manual invocation.
- o60 ✓ findings: prefer fix in place.
- o61 ✓ seed: the skill scan, hook latency + errors from OTel, an agnix lint trial. look into the nurture-memory recipe — the fattest and heaviest of all — for anything worth pulling into the checkup; propose pulls only when they are good ones.
- 17:46: test drive agnix; /doctor prompt-audit and /skill-doctor already run in the nurture-memory recipe — never duplicate them here.

17:58: seeded — cclio:system-checkup (3 own + 6 colocated checks), recipes/refresh-system-checkup, docs/test-drive/{agnix,system-checkup-cadence}.md, the boot digest's checkup due line. first run: 4 🔴, 3 fixed in place (agnix frontmatter, x stats dev stamp, today's skill splits), 1 asked (session-start hooks 48–58 s).

18:10, dima o62 ✓ — the 48–58 s session start is cclio-only (6 of 13 cclio SessionStart runs over 5 s, 0 of 9 elsewhere, OTel 10-17→19); his boot stays as is (one boot message with wishkeeper is his ask), quick wins only: the boot digest's gh watch fetches 8 at a time, 17.3 → 5.2 s (digest 44.5 → ~36 s), proven unchanged + a planted change still prints. the barrel probe (claude -p haiku, 7 s) stays. o63 ✓ — nurture-memory's census + install hunt (step 9.2, 2.5) moved into the checkup as install-census; the recipe points at it («the system checkup runs more often than nurture-memory, which runs every 1–3 months»).

18:40: o70 ✓ the cadence is one rotating check per halt (halt phase 3.3), the weekly DUE line a fallback; o69 ✓ his half of FRM-41 (aliases, raycast, pnpm scripts) joined the cli-purpose check; evergreen joined as a colocated check (o58 «it should have everything»).

2026-10-19 20:08 done (dima o106): seeded — cclio:system-checkup (own + colocated checks, naming-entity-first added today), recipes/refresh-system-checkup, the halt's one-slice cadence on trial (docs/test-drive/system-checkup-cadence.md); growth rides each operational pass.
<!-- SECTION:NOTES:END -->
