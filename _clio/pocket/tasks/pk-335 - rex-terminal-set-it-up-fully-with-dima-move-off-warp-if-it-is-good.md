---
id: PK-335
title: 'rex terminal: set it up fully with dima, move off warp if it is good'
status: done
assignee: []
created_date: '2026-11-06T11:50:00Z'
updated_date: '2026-11-06T19:47:00Z'
labels:
  - s
  - wing-2
dependencies: []
priority: next
type: task
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
closed beta invite, https://www.superlogical.com/updates/public-testing-beginning; wing 2's
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 install from the DMG, out of translocation
- [x] #2 research: three lanes, findings doc
- [x] #3 guide and test-drive file written
- [x] #4 native themes and gruvbox light and dark in Rex
- [x] #5 config from scratch: defaults kept, no init.lua yet
- [x] #6 agent doors: an agent builds a real layout through rex
- [x] #7 fleet door: status dots, Activity, session survival, terminfo
- [ ] #8 verdict setup: a week of real use, then the warp call
- [x] #9 rex door set: fleet-doors first, his-hands rule, tooling block, x:rex
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-335:W12 (2026-11-06 13:43, dima): add to side lane scope (at the end):
PK-335:W13 (2026-11-06 13:43, dima): i have an invite to test out rex terminal https://www.superlogical.com/updates/public-testing-beginning (closed beta).
PK-335:W14 (2026-11-06 13:43, dima): tell it to set it up fully with me. i plan to move out from warp if rex is good.

wing 2 fold, dima's prompts of 2026-11-06:
PK-335:W15 (2026-11-06 18:49, dima): there is a new terminal, rex, claimed to be a better ghostty: agents friendly, pretty, lean, easy to configure. i have an invite and rex is downloaded. i want to test it out and, if i like it, migrate from warp to rex. let's start a test drive.
PK-335:W16 (2026-11-06 18:49, dima): find all rex install doors. i assume brew isn't there yet; if not, install via the installer from downloads.
PK-335:W17 (2026-11-06 18:49, dima): full scale research about rex, everything a basic research recipe would cover: best practices, power usage, warp → rex migration paths, good defaults, tips and tricks, its capabilities, so we configure it fully from the start and i explore.
PK-335:W18 (2026-11-06 18:49, dima): the look: i want it pretty, i like pretty tools. hunt how to theme rex. i first explore native, then gruvbox light and dark. see if gruvbox themes exist and install them; if not, create one.
PK-335:W19 (2026-11-06 18:49, dima): ❓ how agents friendly is rex: can you fully configure it? hunt all the best doors for it.
PK-335:W20 (2026-11-06 18:49, dima): it is also claimed to be a mini agentic harness along with being a terminal, or even a full scale one, so it is an optional door for me to run the fleet.
PK-335:W21 (2026-11-06 18:49, dima): create a structured guide for me to test drive rex. i'm a little overloaded with lots of stuff happening, so guide me through the setup step by step, not all at once.
PK-335:W22 (2026-11-06 19:01, dima): i skipped the proposed migration. i want to set it up from scratch, selective migration, nothing special; the gruvbox theme is the main thing to migrate.
PK-335:W23 (2026-11-06 19:03, dima): ❓ tell if rex's installed skills are useful, and if they are, use the rex skill to set it up.
PK-335:W24 (2026-11-06 19:03, dima): tailscale is out of scope, i do not use it.
PK-335:W25 (2026-11-06 19:04, dima): ❓ i enabled remote control: how does it work? does rex have a mobile app?
PK-335:W26 (2026-11-06 19:25, dima): themes are solved, i take care of themes from now on. font size i tweak myself, 13 looks ok.
PK-335:W27 (2026-11-06 19:25, dima, on o2): keep the rex defaults, rex looks pretty actually.
PK-335:W28 (2026-11-06 19:25, dima, on o3): keep cmd+k as the session picker, i explore the defaults first.
PK-335:W29 (2026-11-06 19:25, dima): fold the rex plan into the rex pocket item and claim it as your ticket, wing 2, and update the progress.

19:26 home: guide and stress list in ~/frame/docs/test-drive/rex.md, findings in ~/frame/docs/research/rex-terminal.md, themes in ~/frame/home/.config/rex/themes/. answered in the thread: W19 and W20 partly (no harness; agent doors listed), W23 (the skill is useful, kept), W25 (remote control drives the app itself; ios exists, not in testing).
open: `rex terminfo setup` not run, so TERM reads xterm-256color; not checked: status dots with a real Claude Code session.

PK-335:W30 (2026-11-06 19:26, dima): i like rex, let's make it my default terminal.
PK-335:W31 (2026-11-06 20:05, dima, on o6): sometimes you propose terminal scripts for me to run in your thread replies; it would be good if those windows used rex.
PK-335:W32 (2026-11-06 20:30, dima): a lot of the things you ask me to do with my hands, you can now do with rex? if so, it is very good.
PK-335:W33 (2026-11-06 20:30, dima): ❓ how do we keep this memory? i'll probably use rex as my main terminal, so maybe save tips, tricks and useful habits in the global memories, maybe in fleet tools with a section of dima's tools, or propose a better way to outline these doors.
PK-335:W34 (2026-11-06 20:30, dima): moving to rex fully is a big move, because i run everything in the desktop app and the mods are a big part of it: orbit, phases, glide. i first need to explore how the mods we build work in rex. not for today, for later; too much for today. i only want to explore rex at a high level.
PK-335:W35 (2026-11-06 20:30, dima): from what i saw so far rex is very good, i really like it, much prettier than warp.
PK-335:W36 (2026-11-06 20:30, dima): even more reason to remember the most useful bits: maybe some parked in fleet tools and the rest in our own custom x:rex skill, which loads the builtin rex skill and extends it with our power usage tricks.
PK-335:W37 (2026-11-06 20:30, dima, on o7): approved, but rethink how to set it up properly: full info in fleet-tooling or a skill? the rex door must be very visible, rex looks like a powerful tool, so it is not allowed to be skipped.

20:32 fleet stop done: 3 of 3 states read right, live claude code survived an app quit. mods in rex parked as a stress-list line in ~/frame/docs/test-drive/rex.md, on W34.

20:49 door set landed: x:rex skill, dima's tools first in fleet-doors, his-hands rule in fleet-output-format, rex block in fleet-tooling; the three rule files groomed.

PK-335:W38 (2026-11-06 21:09, dima): i thought we already made mod support so my ticks work from the first tick. why is it still not there? consult with main clio: is it implemented, or only planned?

21:10 stray remote branch deleted on his typed word. the tick door is built (FRM-427), my ask missed its shape; hint asked of main, the fleet-mods line on the board.

PK-335:W39 (2026-11-06 20:21, dima): ❓ how useful is opening commands straight in a rex tab, what could you run, and how do we not forget the findings? does the rex skill tell it?
PK-335:W40 (2026-11-06 20:41, dima): okay, then put my section first in fleet doors. i like your proposal with memories.
PK-335:W41 (2026-11-06 20:41, dima): ensure that rex is very visible and will be used by everyone in the fleet, especially by you yourself.
PK-335:W42 (2026-11-06 20:41, dima): use x:author-memory for all memory and skill surfaces you act on. while you're in fleet doors, fleet output format and fleet tooling, take a look at the files as a whole and groom them a little; maybe they've drifted and are not in good shape.
PK-335:W43 (2026-11-06 19:25, dima, W26's first half): the theme switched, but with different verbs, not Switch Appearance Mode.
PK-335:W44 (2026-11-06 21:22, dima): tell when you are fully done and can park.

21:30 siesta with both cards. done since the last note: terminfo set up, the ssh include, the fleet-mods tick line, the wing banner's git-crypt flags, x:rex recipes hardened against empty ids. #7 unchecked: program_status read 3 of 3, the status dot in the app is still unconfirmed by his eye. W41's «everyone» means every cc session; cloud chat stays outside, a cc-only section.

21:33 close: on his tick. the status dot seen by his eye on a staged dot-check tab. the trial lives on in ~/frame/docs/test-drive/rex.md, until 2026-11-20 (#8 moved there); the mods in rex moved to FRM-522. his words stay here.
only the mods-in-rex line went to FRM-522.
close: rex is his daily terminal, gruvbox in, x:rex and the fleet doors landed.

close: W12–W33 done, rex set up with him, its door in fleet-doors, x:rex, the trial in docs/test-drive/rex.md; W34 moved FRM-522's wish block; W35–W44 done, the same
<!-- SECTION:NOTES:END -->
