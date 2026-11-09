---
id: PK-348
title: "REVIEW.md: explore it, set up the convention for us everywhere"
status: open
assignee: []
created_date: "2026-11-07T12:46:00Z"
updated_date: '2026-11-07T22:04:00Z'
labels:
  - s
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
<!-- SECTION:NOTES:END -->
