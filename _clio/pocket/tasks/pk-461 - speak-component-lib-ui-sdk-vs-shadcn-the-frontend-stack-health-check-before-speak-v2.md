---
id: PK-461
title: >-
  speak component lib: ui sdk vs shadcn, the frontend stack health check before
  speak v2
status: open
assignee: []
created_date: '2026-11-20T17:11:00Z'
updated_date: '2026-11-20T17:54:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 76000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
19:11 born from dima's 19:10 vault note «_hq/wing plan (in progress).md» § speak component lib (raw stays in the vault); not BYT-110 (a sidebar move, unrelated). step 1 done: the three videos read (two came as arabic auto-captions, read whole). next: research item 1, ui sdk's concerns, one item at a time, a grill after each (his «do not parallelize»)

PK-461:W1 (2026-11-20 19:10, dima, vault «wing plan»): speak component lib: shadcn vs the new «vercel/shadcn ui sdk» (docs https://ui-sdk.dev/, github https://github.com/vercel-labs/ui).
PK-461:W2 (2026-11-20 19:10, dima): the problem: speak is built with plain react today, and i want a proper, solid component lib for it, for a good ui and overall component solidity.
PK-461:W3 (2026-11-20 19:10, dima): is the new ui sdk usable? is it a new generation of ui components, a replacement for shadcn? its design is very good, i like it, especially its doors to the components: codie can then easily talk to the app and test it. the components are ok too; i checked a few examples and i like them. but what about the future: is it next-gen shadcn, or just another hype item? ❓
PK-461:W4 (2026-11-20 19:10, dima): we set shadcn as the main component lib of the bytes ui kit, so it matters to learn about ui sdk: is there a chance the bytes ui kit's driver changes? ❓
PK-461:W5 (2026-11-20 19:10, dima): is it worth trying ui sdk on some app? if yes, which one, and why? ❓
PK-461:W6 (2026-11-20 19:10, dima): is ui sdk possible in herdr, since it is kind of headless, or not compatible with what the herdr codie does there? consult with clio and the herdr codie. ❓
PK-461:W7 (2026-11-20 19:10, dima): all of these are researched thoroughly; i suspect the answer is «still raw, not today», but i still want the data, maybe i'll see something new.
PK-461:W8 (2026-11-20 19:10, dima): along with it, check shadcn's overall health as a top-tier component lib for react apps, specifically with agentic ui coding: is it still the best way to build ui, or did something better or fully new appear? is react, shadcn, tailwind, vite, next.js still the best stack for building frontend apps with agents? ❓
PK-461:W9 (2026-11-20 19:10, dima): a health check of our frontend stack before we build speak v2: for speak v2 specifically, and for our fleet stack overall.
PK-461:W10 (2026-11-20 19:10, dima): do not parallelize: each item is approached carefully and granularly; each is part of my key tools. i use read-aloud the whole day: ~95 % of what i read from the display, your replies included, is read aloud to me.
PK-461:W11 (2026-11-20 19:10, dima): research on any topic can bring anything, even unexpected stuff; grill with me thoughtfully and make sure the research data is processed thoroughly and carefully.
PK-461:W12 (2026-11-20 19:15, dima): the research must actually search against shadcn itself overall: is it still a healthy, solid, top-tier pick for ui development, or what is, if not? ❓

19:20 the source note was renamed by dima: «_hq/dima's stash.md» (was «wing plan (in progress).md»)

PK-461:W13 (2026-11-20 19:54, dima, o7): q1 ok: we stay on shadcn through the bytes ui kit for now.
PK-461:W14 (2026-11-20 19:54, dima): the rest about the ui kit: no probes for now, no time for experiments.
PK-461:W15 (2026-11-20 19:54, dima): the grill itself narrows to this: we use shadcn and the bytes ui kit for now.
19:54 settled: speak's base is shadcn through the bytes ui kit (W13); ui sdk: no probe, no test drive now (W14); research 2–3 ask open in orbit
<!-- SECTION:NOTES:END -->
