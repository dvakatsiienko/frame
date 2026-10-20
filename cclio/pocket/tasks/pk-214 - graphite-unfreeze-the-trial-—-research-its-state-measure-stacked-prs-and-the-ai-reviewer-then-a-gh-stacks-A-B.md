---
id: PK-214
title: >-
  graphite: unfreeze the trial — research its state, measure stacked prs and the
  ai reviewer, then a gh stacks A/B
status: done
assignee: []
created_date: '2026-10-20 11:02'
updated_date: '2026-10-20 13:42'
due_date: '2026-10-27'
labels:
  - m
dependencies: []
priority: next
type: wish
ordinal: 99400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-20, dima: the test drive stays parked too long. let's install graphite and drive it for a week or two, so we can eventually try a switch to github's native stacks. what i want: 1. research graphite's state — is it alive? i saw cursor bought it, and they build something else now; will graphite die some day? how does it compare to similar tools? 2. eval and measure its adversarial code reviewer and stacked prs (mostly the stacked prs). 3. drive it 1–2 weeks (the second only if the first gives too little data). 4. then switch to gh stacks for an immediate A/B while traces and experience are hot — who does stacked prs better. caveats: our flow is plain gh prs so far, stacks differ; how to use stacked prs without losing the basic-pr expertise; tricks and likely issues; our hazards, known issues and cli tricks are sharpened against plain prs — will that hurt; stacks are still exotic, how much does an alternative pr tactic cost; the real gains for us — i want stacks to be useful; is our ci compatible at all. a recipe like «refresh-stacked-pr» won't hurt; search: stacked prs with agents, agentic power-usage best practices, tips and tricks, complementary tools you'd want to operate stacks well, any useful skill, and your own proposals. home: docs/test-drive/graphite.md (frozen until 11-07).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-20: his inbox word («test drive stays parked for too long. let's install graphite») ends the 11-07 freeze of docs/test-drive/graphite.md. step 1 (the state research) runs this session as a researcher lane.

2026-10-20 14:18 dima: add to the stacked prs scope — when we research and make the recipe, check how linear works with stacked prs: right away, or some knobs need tweaking. sources: https://linear.app/docs/diffs#stacked-prs · https://linear.app/changelog/2026-10-08-stacked-pull-requests

ticket: BYT-98 — the same question (stacked prs, graphite vs github native); research folded under its vectors 2026-10-20

2026-10-20 16:41 dima: graphite dropped everywhere, never tried (reasons in BYT-98 § dima notes); the stacks want lives in docs/test-drive/stacked-prs.md (github stacks only) and BYT-98
<!-- SECTION:NOTES:END -->
