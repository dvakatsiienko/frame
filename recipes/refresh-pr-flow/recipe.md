---
kind: refresh
owner: [codie, coordinator]
artifacts:
  - docs/knowledge/pr-flow.md
  - x:crew-codie
script: none
groomed: 2026-10-20 (dima)
---

# refresh-pr-flow

keeps the fleet's pr flow sharp against a fast-moving world: stacked prs, ai reviewers, the human merge gate and how linear reads them. born 2026-10-20 from FRM-270.

## the want

> the graphite test drive stays parked for too long. let's install graphite and drive it for a week or two, so we could eventually try a gh stacks native switch: first research graphite's state — is it alive, i saw cursor bought it and now they build something else; eval its adversary code reviewer and stacked prs (mostly the stacked prs); drive it 1–2 weeks; then switch to gh stacks for an immediate A/B while traces and experience are hot, to see who does stacked prs better. (2026-10-20, inbox)

> caveats: we set up the standard gh pr flow so far, stacks are different — how to use stacked prs without losing the expertise with the basic pr flow? what are the tricks and potential issues? our hazards, known issues and cli tricks are sharpened against plain prs — will that be a trouble? stacks are somewhat exotic still, how much will it hurt? what are the actual gains for us — i want stacked prs to be useful for us. is our ci compatible with stacks at all? (2026-10-20, inbox)

> possibly a recipe like «refresh-stacked-pr» won't hurt. i'd search for: how to properly use stacked prs with agents; agentic power-usage best practices; tips and tricks; supportive complementary tools — what do you want to have to operate stacked prs effectively? any skill would be useful? propose yours. (2026-10-20, inbox)

> add to the stacked prs scope: how linear works with stacked prs — right away, or some knobs need tweaking. [diffs](https://linear.app/docs/diffs#stacked-prs) · [changelog](https://linear.app/changelog/2026-10-08-stacked-pull-requests) (2026-10-20)

> my human pr approval gate: i never actually do the code review, i press «approved» blindly as a chore, or ask you. that gate has nearly no value. simplify it, and propose other parts of our system worth optimizing from the best practices. (2026-10-20, inbox, with [the post](https://claude.dev/blog/solving-code-review-at-anthropic/) and [the video](https://www.youtube.com/watch?v=d8QpDbBKbAU))

> stacked prs are a feature to be tested granularly; probably not a candidate for an automated sweep. (2026-09-26)

> what i want from this recipe: help us understand how to use stacked prs properly via agents — search for best practices and tools that would simplify stacked pr operations. github stacks and graphite are only tools that let us use stacked prs; the recipe hunts for the best tools for stacked prs with agents, any tool. and a proper way to measure whether stacked prs actually help: the pluses and minuses, is it worth it, or are plain prs better — a gain or an additional maintenance burden? (2026-10-20, the grill)

his standing calls:
- low-risk prs merge without his click, risky paths wait for his look (FRM-401, 2026-10-20)
- one recipe for now — stacks, ai review and the gate; trimmed, groomed or split once the stacks question settles (2026-10-20)
- graphite is dropped everywhere, never tried (2026-10-20): cursor owns it and builds something else, no `gt` release since may, its reviewer trailed greptile and coderabbit; github's native stacks are closer to the platform. github stacks stays until tested and adopted — he expects to adopt it at some point
- stacks support in `x` is an extension: the plain pr flow keeps working untouched, and the stacks part is easy to remove — kept in the cli even if stacks are set aside, for a later revisit (2026-10-20)
- the measurement lives in the stacked-prs test drive, `docs/test-drive/stacked-prs.md` (2026-10-20)

## the run

- stacked prs are tried by hand on a real codie job, never inside an automated sweep (his 09-26 call)
- each codie lane that opened a pr proposes this recipe's vector changes in its retro (the codie seat)
- suggest a run when: `gh stack` ships a release, or a codie lane's pr took more than 3 review rounds

1. **shape**: `clio:shape-recipe` step 0, the grill. done: his word on the round. (open)
2. **research** — the brief from `pnpm recipe:brief refresh-pr-flow`; `pnpm research:lanes <brief> <out>` + an opus source lane (gh and linear docs, our ci workflows). done: every lane returned or marked failed. (script)
3. **distill** — into `docs/knowledge/pr-flow.md` (the flow's core and its traps) and the pr part of `x:crew-codie`. done: both read and touched, or named «unchanged». (open)
4. **log** — the line in `log.md`. done: the line is there. (template)

## vectors

### research
- stacked prs with agents, any tool: the best tools and practices that make stack operations simple for an agent — a hunt, never a fixed pair
- github stacks (`gh stack`): how an agent drives it with no prompt, how sixth sense reviews one layer against the whole stack — until tested and adopted
- the worth of stacks: the gain and the maintenance burden against plain prs, as others measured it
- ai code review in practice: what the best teams automate and what still needs a human, by risk tier
- ci on stacks: required checks per layer, a restack re-running ci, renovate moving main under an open stack
- linear and stacks: what links, what closes, what needs a setting — a one-time check, cut after the first run

### analysis
- the stacked-prs test drive's rounds since the last run: gain against burden, read against its card
- our pr medians per repo (`x fleet flow --days 14`) and the review rounds per codie pr since the last run
- every hazard, guard and `x lane` verb that assumes one pr per branch — would a stack break it?

## artifacts

- `docs/knowledge/pr-flow.md` — the core every pr-opening session reads: the gate, the review loop, stacks if adopted; the distill rewrites it, keeping what still holds
- `x:crew-codie` — its pr part; the distill edits only the lines a finding proves wrong

## findings

- the checklist each print carries: stacks adopted or not, and why · the gate's rule against the last 14 days of merges · one practice borrowed, or «none fits»
