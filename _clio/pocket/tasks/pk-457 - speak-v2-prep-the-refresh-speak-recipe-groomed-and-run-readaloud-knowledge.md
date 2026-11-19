---
id: PK-457
title: 'speak v2 prep: the refresh-speak recipe groomed and run, readaloud knowledge'
status: open
assignee: []
created_date: '2026-11-19T14:41:00Z'
updated_date: '2026-11-19T15:37:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 74000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-457:W1 (2026-11-19 16:38, dima): we move to the speak app. to build it we prep data first: fresh data on the latest read-aloud app implementation best practices, the latest best read-aloud models, and a kokoro upgrade or update; then the fable 5.2 research and the fleet's models refresh; then the designer skill refresh.
PK-457:W2 (2026-11-19 16:38, dima): all are recipes or researches. after we research everything, we can start a lane. let's start from the read-aloud data refresh: knowledge, so we build a great read-aloud app.
PK-457:W3 (2026-11-19 16:38, dima): assist me with collecting data about speak app v2 so we build it in the best way. for every research, propose how to fold the findings in the best way.
PK-457:W4 (2026-11-19 16:38, dima): for each research round, print me the interesting details about its results.
PK-457:W5 (2026-11-19 16:38, dima): the read-aloud recipe ran only once, as i remember, and was never rerun; it was born before we wrote a spec for our recipe feature. let's revisit it, groom and sharpen it via shape-recipe.
PK-457:W6 (2026-11-19 16:38, dima): merge my newest wishes and research vectors about the read-aloud feature.
PK-457:W7 (2026-11-19 16:38, dima): propose your own ideas about what to search for in this recipe: what do we want to know to build the best possible read-aloud solution? wispr or superwhisper grade level? ❓
PK-457:W8 (2026-11-19 16:38, dima): read-aloud is my main door to the data on my screen: i read 95 % of the text on screen, on all surfaces, through read-aloud.
PK-457:W9 (2026-11-19 16:38, dima): search for best practices and guides on how to build a solid text-to-speech app; focus on macos, but in general it should work everywhere. maybe i can make something bigger out of this app.
PK-457:W10 (2026-11-19 16:38, dima): search for the newest read-aloud state of the art and the best free models, or not free but with a generous free tier, so i can use them the whole month.
PK-457:W11 (2026-11-19 16:38, dima): we can start from the current model, a locally run app only, but in the future i want it to work on remote hosts too. i don't know how; an electron app? so i can release this app, stick «buy me a coffee» on it and have some income from it ❓
PK-457:W12 (2026-11-19 16:38, dima): search for the newest approaches to run read-aloud efficiently: does our current launchd approach hold? ❓
PK-457:W13 (2026-11-19 16:38, dima): kokoro alternatives? maybe there are other cool read-aloud tools ❓
PK-457:W14 (2026-11-19 16:38, dima): i really like kokoro. it is incredibly good for a fully free read-aloud; it sounds not even comparable to the built-in machine read-aloud. siri is solid though (only one certain voice), kokoro is still better.
PK-457:W15 (2026-11-19 16:38, dima): was kokoro updated since we last looked? if yes, what's the news? you can also include it in the evergreen scope, and solve this part as a rider for plan item 2 ❓
PK-457:W16 (2026-11-19 16:38, dima): remind me how kokoro is actually running on my machine right now: explain briefly how it works, plainly and simply, no tech language ❓
PK-457:W17 (2026-11-19 16:38, dima): i have quite a list of voices in the speak webapp, and i favorited a few. how do i see them? are they part of kokoro's launchd? is this the full list? when kokoro is updated, do those voices become different or better, or do new ones appear? what do kokoro updates actually change? ❓
PK-457:W18 (2026-11-19 16:38, dima): during kokoro updates, ensure its voices survive, my favourites especially, and most importantly af_heart: i like this one the most; it sometimes sounds even better than elevenlabs and fish's voice (sarah).
PK-457:W19 (2026-11-19 16:38, dima): note: fish's sarah is also nice, i like it.
kept: 2026-11-19 — the main lane's current scope: the recipe groom and run, today; BYT-126, FRM-642 and FRM-288 own the build after it

PK-457:W20 (2026-11-19 16:54, dima): kokoro wish: make it easier to update. why can't we update it via brew, for example, or pnpm update? how is it actually installed? i want evergreen to be able to check for its updates, and an easy upgrade door.
PK-457:W21 (2026-11-19 16:54, dima): what better recipe name could we have, given my wishes, what we have in the speak app and what we plan for it? ❓
PK-457:W22 (2026-11-19 16:54, dima): q2: yes, but there is a catch: i don't have a huge amount of time for a long exploratory build, because i also want to resume my cv once we're done with the speak app, so i can resume my job search.
PK-457:W23 (2026-11-19 16:54, dima): q6: where does the researched knowledge land, especially the read-aloud app building best practices? for you (architecting) and for codies (implementation), so everyone uses the useful knowledge at all phases? ❓
moved: W11 → FRM-668:W5 (dima 16:54, phase 2)

PK-457:W24 (2026-11-19 17:02, dima): i thought our evergreen also refreshes python and uv. does it? or is kokoro installed locally in the speak app and not globally, and that's why evergreen misses it? ❓
PK-457:W25 (2026-11-19 17:02, dima): how, then, do we keep it properly updated in an easy way: checked at each evergreen, and updated if updates are present? ❓
PK-457:W26 (2026-11-19 17:02, dima): ok, let's keep refresh-speak for brevity. i actually like «refresh-readaloud»: it is a more precise and more versatile name. for now keep refresh-speak; change to readaloud if we grow this area into something bigger, later.

moved: W20 → FRM-669:W1, W18 → FRM-669:W2 (dima o10, 17:09)

17:37 refresh-speak run 1 done: playbook filled (67ead9ef), W5–W10, W12–W17, W19 met by the run and its 16:42 answers; W11 → FRM-668, W18/W20 → FRM-669; next: fable 5.2 (W1), then the designer refresh
<!-- SECTION:NOTES:END -->
