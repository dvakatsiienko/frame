---
id: PK-348
title: 'REVIEW.md: explore it, set up the convention for us everywhere'
status: open
assignee: []
created_date: '2026-11-07T12:46:00Z'
updated_date: '2026-11-09T16:24:00Z'
labels:
  - s
  - clio-wing-2
dependencies: []
priority: next
type: task
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's 14:43: REVIEW.md is cc Code Review's own instructions file, at a repo root, plus subdirectories on a protected default branch (docs: code-review-customize.md); none exists in frame or bytes today, by git ls-files. explore what it gives us, then set up the convention everywhere.

dima notes 7 nov 2026 (i write by hand): Review.md is only a part. along with it let's also sharpen code reviewing fleet have overall. read this video via yt-trasncript tasnrit mode https://www.youtube.com/watch?v=TFCDWrEBaFM&list=PLqvvsYr0T3pnevG3huCGVrqVuLwPpU-gu&index=5
read how anthropic does Code review.
https://claude.dev/blog/solving-code-review-at-anthropic/

compare to how code review setup in our fleet (including 1 ci code review for side lanes). and propose top 7 improvements to our system. including cuts. do we do code reviews in a right way? maybe too many code review rounds? what to add or change to make our code reviews better? what to remove to make out system lighter and remove unnecessary dead weight?

plan:

1. read video and docs
2. discuss with me a research vectors. i think about this: current latest (only new) agentic code review best practces, neuroarxiv included. additional search branch for anthropic 5.5 set of models. research about review.md - what it is? how it works? power usage recipes? is review.md truly good? propose your own vectors - what info you want to search to make our fleet code review integrity more robust?
3. propose improvements based on theo video, https://claude.dev/blog/solving-code-review-at-anthropic/ and research results
4. propose how to setup review.md everywhere in our fleet
5. ideally review.md is applied via research resulsts
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-07 23:10 wing 2 halt: handed back to main; PK-351 left: the fresh-wing boot probe at the next boot (W85), FRM-516's live reads by 11-09

kept: 2026-11-09 — dima 14:42 (o2): stays on wing 2's flyway, line #3

PK-348:W1 (2026-11-07 inbox, dima): REVIEW.md is only a part. along with it, let's also sharpen the code reviewing the fleet has overall.
PK-348:W2 (2026-11-07 inbox, dima): read this video in yt-transcript transit mode: https://www.youtube.com/watch?v=TFCDWrEBaFM
PK-348:W3 (2026-11-07 inbox, dima): read how anthropic does code review: https://claude.dev/blog/solving-code-review-at-anthropic/
PK-348:W4 (2026-11-07 inbox, dima): compare to how code review is set up in our fleet, including the one ci code review for side lanes, and propose the top 7 improvements to our system, including cuts.
PK-348:W5 (2026-11-07 inbox, dima): do we do code reviews the right way? maybe too many code review rounds? ❓
PK-348:W6 (2026-11-07 inbox, dima): what to add or change to make our code reviews better, and what to remove to make our system lighter and drop unnecessary dead weight? ❓
PK-348:W7 (2026-11-07 inbox, dima): plan: 1 read the video and docs; 2 discuss the research vectors with me: the current latest agentic code review best practices, neuroarxiv included, a branch for the anthropic 5.5 models, and REVIEW.md: what it is, how it works, power-usage recipes, is it truly good; propose your own vectors; 3 propose improvements from the video, the blog and the research; 4 propose how to set up REVIEW.md everywhere in the fleet; 5 ideally REVIEW.md is applied from the research results.
PK-348:W8 (2026-11-09 15:58, dima): propose how to solve PK-348 optimally. REVIEW.md seems to be our new convention: how to set it up properly so it improves fleet flows everywhere, and how to improve our code review overall?
PK-348:W9 (2026-11-09 15:58, dima): any cuts needed? do we do something redundant? too many reviews? ❓
PK-348:W10 (2026-11-09 15:58, dima): i set up the code review model blindly, following my intuition, but maybe i overextended, because from what i saw in videos everything is automated now.
PK-348:W11 (2026-11-09 15:58, dima): propose how to optimize it and cut redundant stuff, but preserve the protections code review provides.
15:59 wing 2: step 1 done: the blog read (web-fetch), the video kept on the shelf (fetch mode, not transit: theo-t3gg-how-claude-fixes-its-own-code-TFCDWrEBaFM), summary at the scratchpad's theo-review-summary.md. a stack map of our review layers is running.

stamp note: W1 to W7 were typed by hand into this item's description on 11-07, not a prompt; «inbox» is the nearest stamp the groom check takes.

ticket: FRM-545
ticket: FRM-546
ticket: FRM-547
ticket: FRM-548
ticket: FRM-549
held: 2026-11-09 — FRM-545 the sixth sense round counter's placement (a cli rider or its own chunk), asked of main 17:23; this item closes once it has a home

held: 2026-11-09 — FRM-546 its sign, then the ask-guard close of PK-348
held: 2026-11-09 — FRM-547 its sign, then the ask-guard close of PK-348
held: 2026-11-09 — FRM-548 its sign, then the ask-guard close of PK-348
held: 2026-11-09 — FRM-549 its sign, then the ask-guard close of PK-348

17:28 the sixth sense round counter's home: a rider on FRM-414 (main's placement, re-sign asked of dima, o34)

close: 2026-11-09 18:24 — dima o38. homes: W1 W6 W8 W10 W11 → FRM-546–549; W2 W3 W4 W7 answered by the proposal and the replay (FRM-545, closed o39); W5 W9 too many rounds → FRM-414's round cap; ticket: FRM-414

held: 2026-11-09 — FRM-546 his o38 close stands; left: each moved W-line copied into its ticket's wish block (W1 W6 W8 W11 → FRM-546–549, W5 W9 → FRM-414), the answered ones dropped citing o38, then done

close: 2026-11-09 18:26 — PK-348:W2 PK-348:W3 PK-348:W4 PK-348:W5 PK-348:W7 PK-348:W10 answered by the proposal and the escape replay, dropped from the tickets (dima o38)
<!-- SECTION:NOTES:END -->
