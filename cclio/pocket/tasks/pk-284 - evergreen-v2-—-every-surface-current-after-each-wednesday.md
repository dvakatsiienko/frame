---
id: PK-284
title: evergreen v2 — every surface current after each wednesday
status: done
assignee: []
created_date: '2026-10-28T12:53:00Z'
updated_date: '2026-10-28T13:21:00Z'
labels:
  - m
dependencies: []
priority: now
type: wish
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
wish, evergreen v2 — renovate on our own Action, every upgrade lane, the exit gate; shaping via cclio:shape-idea (dima's o10, 2026-10-28)

W306 (2026-10-28 14:28, dima): something is wrong with evergreen.
W307 (2026-10-28 14:28, dima): pnpm outdated -r in both frame and bytes produce a large outdated list.
W308 (2026-10-28 14:28, dima): why renovate does not work?
W309 (2026-10-28 14:28, dima): each after each evergreen everything should be upgraded, including packages in each repo, not just brew and pnpm
W285 (2026-10-28 14:37, dima): bytes: mend SS is attached plus i opened in a browser pane so you can inspect. let's fully refine renovate before moving on, i want evergreen to work as expected. exit criteria: each wednesday, after evergreen we should have everything up to date on all surfaces:
W286 (2026-10-28 14:37, dima): brew
W287 (2026-10-28 14:37, dima): pnpm
W288 (2026-10-28 14:37, dima): frame + bytes package.json
W289 (2026-10-28 14:37, dima): any other surface i missed? python? go (cli + sline)?
W290 (2026-10-28 14:37, dima): ideally the upgrade of everything is optimized and synced (especially frame + bytes), so upgrade is efficient and reusable
W291 (2026-10-28 14:37, dima): go learn what's wrong and why pnpm not updated. i meanwhile investigate bytes update state and biome issues.
W292 (2026-10-28 14:37, dima): after we configure the flows — let's gracefully upgrade bytes and frame there are lots of majors there
W294 (2026-10-28 14:45, dima): go: `x/go` has 1 direct module behind, and sline is current. Renovate already covers `go.mod`.
W295 (2026-10-28 14:45, dima): python: 3 `uv` tools (changedetection-io, harbor, mlx-audio) that no lane reads yet
W296 (2026-10-28 14:45, dima): i'd like to these in evergreen digest. if nothing new important/interesting - blank lines
W297 (2026-10-28 14:45, dima): same for node/pnpm.
W298 (2026-10-28 14:45, dima): toolchain:sync ← what does it do? Did we run it today? Evergreen? If no, why?
W299 (2026-10-28 14:45, dima): 1. Renovate moves off the Mend app into our own GitHub Action in both repos. Both are public, so the runners are free with 16 GB of memory. One shared config lives in frame and bytes extends it, so the two repos are configured once and stay in sync. ←
W303 (2026-10-28 14:51, dima): toolchain:sync ← I currently have Node installed via FNM. Does `toolchain sync` properly upgrade Node and PNPM with FNM in mind?
W304 (2026-10-28 14:51, dima): let's run it now.
W305 (2026-10-28 14:51, dima): can i run it? to see how it works
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-465

close: W283–W311 moved to FRM-465 (W283 done: bytes pushed 14:28; W284/W300 done: stashes dropped; W298/W303–W305 answered in thread, toolchain lane in read.md)
<!-- SECTION:NOTES:END -->
