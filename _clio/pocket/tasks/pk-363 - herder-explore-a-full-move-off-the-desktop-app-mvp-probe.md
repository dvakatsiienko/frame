---
id: PK-363
title: 'herder: explore a full move off the desktop app, mvp probe'
status: open
assignee: []
created_date: '2026-11-09T12:38:00Z'
updated_date: '2026-11-09T12:45:00Z'
labels:
  - m
  - clio-main
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-363:W1 (2026-11-09 inbox, dima): deploy a forward fleet-to-herder migrator codie probe; fold a ticket about herder desktop app as our mods fleet system mvp test build: cheap, fast mock, solid architecture upfront (solid skeleton, shape)

PK-363:W2 (2026-11-09 inbox, dima): support: orbit, glide, phases, my band

PK-363:W3 (2026-11-09 inbox, dima): i want a custom, smooth, pretty messaging area, not a terminal; i don't like the cc terminal ui, i want custom and sleek; to grill later when i am not tired. #big

PK-363:W4 (2026-11-09 inbox, dima): main wish: the c desktop app is nice but a bit rigid; i want a coding environment that is both flexible, pretty and cheap to maintain. cheapest possible but quality probe; herder deploy

PK-363:W5 (2026-11-09 inbox, dima): what i am sure of: warp goes; i use rex as main terminal (agent-friendly, pretty, customizable); i have herder installed, it builds any ui inside; i have not used either deeply, so expertise is needed; for you: research, and maybe a solid skill with the data to build around them, following best practices, patterns, and lessons learned

PK-363:W6 (2026-11-09 inbox, dima): now: i use the claude desktop app; i like it, it's pretty, but rigid; native mods look off and it's buggy; cc terminal ui (and mods ui) is ugly for me

PK-363:W7 (2026-11-09 inbox, dima): rex and herder are sleek; rex is sleeker and prettier

PK-363:W8 (2026-11-09 inbox, dima): i'd move coding fully into one of them, i think herder: rex doesn't seem to support that customizability. i heard, unverified, that herder uses ghostty under the hood; rex is a ghostty front by the same dev, so herder may pull it in too, then it's perfect. to research

PK-363:W9 (2026-11-09 inbox, dima): then: c desktop app for cw projects, docs, artifacts; cc coding in herder

PK-363:W10 (2026-11-09 inbox, dima): but everything is wired to the c desktop app now, so a proper move needs a proper plan

PK-363:W11 (2026-11-09 inbox, dima): research: (1) rex and herder shape, what they are; power use of both; recipes for the most useful stuff; best practices; worthy complementary tools; cool stuff to pull in, copy or borrow. (2) print info in an interesting way. (3) work through the research data fully and thoroughly; build a solid skill via author-memory; codies will use it always, so it must be solid grade, a base for shipping. optionally balance with an agents.md if possible; i don't know if herder supports one

PK-363:W12 (2026-11-09 inbox, dima): shape the idea, grill, and plan how to get the mvp fast; first mvp with orbit, agents list, phases, glide (board); propose what else

PK-363:W13 (2026-11-09 inbox, dima): some parts may be borrowed, pulled, copied, or skipped if herder already has them

PK-363:W14 (2026-11-09 inbox, dima): how is orbit shown in herder? idea: summon a codie in herder ahead of time and park it; consult it on the insides; let it explore herder from inside, do probes, consult with us, help plan the architecture and migration

PK-363:W15 (2026-11-09 inbox, dima): how do herder mods relate to cc mods, especially the ones we already have? ❓

PK-363:W16 (2026-11-09 inbox, dima): does herder have any mcp or cli? how do we knock on herder's doors? ❓

PK-363:W17 (2026-11-09 inbox, dima): any herder-related memory files? ❓

PK-363:W18 (2026-11-09 inbox, dima): stuff to see and test in the herder mvp probe: orbit asks and steers; phases; glide; session board; the replies thread, custom like in the c desktop app, not a terminal view (if expensive or tricky, evaluate and estimate how to have it); everything else mapped, tested, probed with cheap tests to see if migration is even possible

PK-363:W19 (2026-11-09 inbox, dima): shape lane and dispatch: quick lane. i vote quick

PK-363:W20 (2026-11-09 inbox, dima): if the mvp lands, we continue in herder, not in the c desktop app; evolve herder (regroom, adjust, cut mods lane scope)

PK-363:W21 (2026-11-09 inbox, dima): out of scope: theming, fonts and similar; i want a robust framework

raw drop (2026-11-09 inbox, dima): clio main: deploy a forward fleet-to-herder migrator codie probe

raw drop (2026-11-09 inbox, dima): fold ticket about herder dektop app our mods fleet system mvp test build. cheap fast mock. solid architecture upfront. (solid skelton skeleton/shape)

raw drop (2026-11-09 inbox, dima): support: orbit, glide, phases, my band. i want custom smooth and pretty messaging area not terminal. i do not like cc terminal ui. wanna custom. sleek. to grill later when i am not tired. #big

raw drop (2026-11-09 inbox, dima): ma main wish: c desktop app is nice but slightly rigid, i want a coding environment that is both flexible pretty and cheap to maintain. this have to be cheapest possible but quality probe herder deploy.

raw drop (2026-11-09 inbox, dima): what i am sure of:

raw drop (2026-11-09 inbox, dima): 1. warp goes

raw drop (2026-11-09 inbox, dima): 2. i use rex as main terminal. it's agentic friendly it is very good. and it is pretty which is also very good. it's customizable! very good.

raw drop (2026-11-09 inbox, dima): 3. i have herder installed. it allow to build any ui inside of it.

raw drop (2026-11-09 inbox, dima): 4. i did not used any of them deeply. so expertise is needed for me. for you - research and maybe a solid skill with all necessary info and data to efficiently build around it, following best practices and best patterns. plus best lessons we learn about them.

raw drop (2026-11-09 inbox, dima): 5. currently i use claude desktop app. i like it. it's pretty. but slightly rigid. and native mods looks off. and buggy. while terminal cc ui (and mods ui) is ugly for me

raw drop (2026-11-09 inbox, dima): 6. rex and herder are sleek (rex is sleeker and prettier)

raw drop (2026-11-09 inbox, dima): 7. i'd move coding fully to either of them. i think herder because from what i know rex does not support customizability like this. although from what i heard, unverified, that herder uses ghostty under the hood. since rex is a ghostty accessor, by same dev, herder may pull it in too then its perfect. to research.

raw drop (2026-11-09 inbox, dima): 8. then: i'll have c desktop app for cw projects, docs, ariticats. cc coding in herder.

raw drop (2026-11-09 inbox, dima): 9. but currently everything wired to c desktop app, so to make a proper move, a proper plan needed

raw drop (2026-11-09 inbox, dima): 10. research

raw drop (2026-11-09 inbox, dima): 1. rex and herder shape, what it is. power usage of both. recipes for most useful stuff. best practices.worthy  complementary tools. already working cool stuff to pull in complete or borrow/copy.

raw drop (2026-11-09 inbox, dima): 11. print me info, in an interesting way

raw drop (2026-11-09 inbox, dima): 12. workthrough research data yourself fully and thoroughly. dread solid skill via author-memory skill. codie's will use it always (it is important to have solid grade quality because it is a base codie's use to ship). optionally, balance with agents.md if possible. i do not know if herder supports one.

raw drop (2026-11-09 inbox, dima): 13. shape idea, grill and plan how to have that mvp fast. first mvp with orbit, agents list and phases plus glid (board). propose what else.

raw drop (2026-11-09 inbox, dima): 1. some parts could be borrowed or pulled or copied or skipped (if redundant because herder have that)

raw drop (2026-11-09 inbox, dima): 2. how does orbit is shown in herder?

raw drop (2026-11-09 inbox, dima): 1. idea: a this point you summon a codie in herder ahead of time and park. and consult about insides. let it explore herder from inside, do probs. consult with us. help plan migration architectural and migration plans.

raw drop (2026-11-09 inbox, dima): 3. how herder mods relates to cc mods, especially to the ones we already have?

raw drop (2026-11-09 inbox, dima): 4. does herder have any mcp or cli? how to knock knock to herder? doors?

raw drop (2026-11-09 inbox, dima): 5. any herder-related memory files?

raw drop (2026-11-09 inbox, dima): 6. stuff i want to see/test in herder mvp probe:

raw drop (2026-11-09 inbox, dima): 1. orbit asks and steers

raw drop (2026-11-09 inbox, dima): 2. phases

raw drop (2026-11-09 inbox, dima): 3. glide

raw drop (2026-11-09 inbox, dima): 4. session board

raw drop (2026-11-09 inbox, dima): 5. the your replies thread — i want it custom, like in c desktop app. dont want terminal view. if it is expensive or tricky - eval and estimate how to have it.

raw drop (2026-11-09 inbox, dima): 6. everything else - mapped/tested/probed with cheap tests to see if migration is even possible

raw drop (2026-11-09 inbox, dima): 14. shape lane and dispatch side/uick lane. i vote for quick.

raw drop (2026-11-09 inbox, dima): 15. i see working mvp. if it lands we continue in herder, not in c desktop app. and evolve herder (regroom/adjust/cut mods lane scope)

raw drop (2026-11-09 inbox, dima): 16. out of scope: theming, fonts and other similar stuff. i want robust framework.
<!-- SECTION:NOTES:END -->
