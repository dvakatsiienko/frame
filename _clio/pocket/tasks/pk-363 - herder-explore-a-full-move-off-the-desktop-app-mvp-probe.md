---
id: PK-363
title: 'herder: explore a full move off the desktop app, mvp probe'
status: open
assignee: []
created_date: '2026-11-09T12:38:00Z'
updated_date: '2026-11-09T15:44:00Z'
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

PK-363:W22 (2026-11-09 16:37, dima): herdr has two modes, a cli and a desktop app; focus on the desktop app, because it has a natural UI, which i want to tweak

PK-363:W23 (2026-11-09 16:37, dima): i assume a custom chatter in herdr is not a freebie at all: an important probe

PK-363:W24 (2026-11-09 16:37, dima): i want a chatter like the claude desktop app's in herdr: the main comms window where you print replies, same or similar, not a terminal view

PK-363:W25 (2026-11-09 16:37, dima): herdr is a clean, pretty canvas; i want you to build a pretty UI there

PK-363:W26 (2026-11-09 16:37, dima): the desktop app's board UI is ok but slightly clunky and not fluid, not enough space; i want something similar in herdr, ideally prettier: the desktop app reads better than a terminal, and i saw herdr can have an even prettier UI

PK-363:W27 (2026-11-09 16:37, dima): cc in a herdr pane: the mods are terminal-native and i don't like them; i want pretty modded panes, and the chatter pretty too

PK-363:W28 (2026-11-09 16:37, dima): rex by itself is very pretty, i like it; but its mods representation and the cc UI in it are ugly for me

PK-363:W29 (2026-11-09 16:37, dima): the herdr layout gallery shows how herdr could look (Kaiju City, the Aperture Science layout); i haven't seen a good-looking chatter window in any example yet

PK-363:W30 (2026-11-09 16:37, dima): fold the differences across the apps that matter for the follow-up herdr steps

raw drop (2026-11-09 16:37, dima): i was busy in other threads.

raw drop (2026-11-09 16:37, dima): 📋 What to research first: round 1, only what decides migrate or stay  ← yes, but take into account that herder have two mods: cli and desktop app. i want to focus on desktop app becase it have natural UI. which i want to tweak.

raw drop (2026-11-09 16:37, dima): note: i assume that custom chatter in herder will be not a freebie at all - important probe.

raw drop (2026-11-09 16:37, dima): plus few SS with example of how herder could look like. (i did not saw good examples of actually good looking chatter window)

raw drop (2026-11-09 16:37, dima): proceed. and fold my wishes from SS and details of a diferences across apps that matter for followup herder-related steps.

raw drop (2026-11-09 16:37 screenshots, dima): SS1 desktop app: i want a chatter like this in herder (main comms window, chatting) / as you see, UI is +- but slightly clunky and not fluid - not enough of space / something similar in herder — ideally prettier (desktop app reads better than terminal but i saw herder can have even prettier UI)

raw drop (2026-11-09 16:37 screenshots, dima): SS2 herdr empty: how clean herder looks. as you see it is a pretty canvas. i want you to build a pretty ui here. note: as you see this is a terminal window. i want this main window (chatter, where you print replies same/similar as claude desktop app have)

raw drop (2026-11-09 16:37 screenshots, dima): SS3 cc in herdr: how cc thread looks in herder. as you see mods are terminal-native i do not like them. i want pretty modded panes. and this catter to be pretty too.

raw drop (2026-11-09 16:37 screenshots, dima): SS4 rex: how rex cc thread looks. rex by itself is very pretty i like it. but mods representation and actual cc UI is ugly for me.

raw drop (2026-11-09 16:37 screenshots, dima): SS5-6: herdr layout gallery examples, Kaiju City by Jiqize (7 of 30) and an Aperture Science layout, no annotation

app differences that matter for the herdr steps (clio, 16:40, read off his 4 screenshots, W30):
- claude desktop app: replies render as rich markdown in a chat column; mods draw as native panes (board: sessions, orbit with tick/replay/steer buttons, glide) and a band above the input (waiting on, 5h, ctx bar); fixed layout, board pane cramped
- herdr desktop app: sidebar of Spaces and Agents (agents self-report status; agents inside tmux may not), tabs, Files and Changes panes, ⌘⇧P command palette, This computer / Add machine; cc runs as its terminal TUI in a pane, so our mods render terminal-native there, orbit has no buttons
- rex: project tabs, same cc TUI and terminal-native board, glide shows [ tick ] as text
- herdr gallery layouts (Kaiju City, Aperture): custom chrome around the panes (agent cards, status bars, facility feed), yet the cc and codex panes inside stay TUIs: no example yet of a rendered chatter, so W23's probe is the crux

corrections (clio, 16:46): W26's arrows in screenshot 1 point at the band (waiting on, 5h, ctx) and the orbit pane too, not only the board UI; the app-differences line «orbit has no buttons» in herdr is [inference]: SS3's orbit pane is empty

probe 1 (2026-11-09 17:43, clio): Zoo installed, gate codie resumed in a herdr pane. the chat showed «Can't find this agent's Claude session»: claude-chat/main.js:180 runs ps with etimes, which macOS ps lacks, so no process tree and no session; the terminal side works. fix handed to the codie in herdr (etime + parse). his wisps: terminal turns don't show in chat, chat-sent text lands only in the terminal — both from the same cause (untested after the fix)

PK-363:W31 (2026-11-09 17:43, dima): is what we build in herdr portable back to what we have in the claude desktop app? can i keep the desktop app in this setup while herdr evolves, or is the move one-way? ❓

PK-363:W32 (2026-11-09 17:43, dima): i worry that herdr's desktop app, or the claude desktop app, gets dropped at some point, and then we struggle to find another place to code

PK-363:W33 (2026-11-09 17:43, dima): zoo's chat and terminal must stay in sync both ways: a turn typed in the terminal shows in the chat, a message sent from the chat lands in the chat
<!-- SECTION:NOTES:END -->
