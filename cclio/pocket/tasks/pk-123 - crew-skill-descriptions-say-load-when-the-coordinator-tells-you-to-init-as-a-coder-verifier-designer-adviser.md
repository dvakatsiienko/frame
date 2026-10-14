---
id: PK-123
title: >-
  crew skills load by name: descriptions fire on a brief naming the skill,
  misses measured
status: done
assignee: []
created_date: '2026-10-14 11:48'
updated_date: '2026-10-14 15:55'
due_date: '2026-10-14'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 10060
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-14 (crew-* skills). his question: why not just tell a coder «load the crew-coder skill»? answer: it already works — crew-coder is model-loadable since x 0.11.211, proven 2026-10-06 on frame-1b by a plain message; the --bg prompt expansion stays for fresh spawns. the work: sharpen the crew-* descriptions to the init trigger, then x plugin bump.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
wishkeeper fold: his real want is to stop relying on the slash-opener expansion trick, fresh --bg spawns included. so: a fresh spawn's brief carries a plain «load the x:crew-coder skill» line, no slash opener; crew-lead/briefing.md:5 + watching.md:8 edited to match; the guard is the coder's first reply naming its loaded skill.

dima 15:00: a brief names every skill out loud, never vague: «hey coder, use the crew-coder skill to …, use guide-go to …», «hey verifier, use the crew-verifier skill to …». proof today: a running session loaded crew-coder on a plain named line (10-06); a fresh --bg spawn still uses the /x:crew-coder opener (09-07). the first fresh spawn under the named-line shape is the probe; unnamed skills do not load (briefing.md:5, DOT-233).

dima 15:07, corrects the 15:00 note: KEEP the /x:crew-coder opener on a fresh --bg spawn (it expands, why drop it). the slash expands only as the very first thing of the first prompt; every other skill (guide-go, guide-code, …) and every cross-message skill goes by plain words naming it clearly, no slash: «use the guide-code skill». measure misses: each spawn's first reply names its loaded skills, one round line per spawn (named vs loaded) in a new docs/test-drive/skill-named-load.md.

done 15:37: crew-coder, crew-verifier, crew-adviser descriptions lead with «init yourself as …»; crew-lead/briefing.md: every other skill rides plain words naming it; docs/test-drive/skill-named-load.md counts named vs loaded per spawn (live to 10-28).

15:33 reopened to claimed (wishkeeper): done only when the commit and the x + cclio plugin bumps land.

15:33: crew-designer description now leads with «init yourself as a designer» too.

15:46: crew-adviser/designer descriptions + briefing committed (198b8d33), x 0.11.294 cache carries them. crew-coder + crew-verifier descriptions sit uncommitted beside the PK-83 drafts — they land with PK-83's groom.

parked: the last two descriptions (crew-coder, crew-verifier) land with PK-83's groom of those drafts

16:03 superseded: the «init yourself as …» notes above are the version dima rejected (15:39: «don't copy my prompt verbatim, optimize it»); live descriptions read «Load when your brief or first prompt names this skill …».
his want (15:39): «optimize it, and ask crew coders to optimize it to activate themselves in a way that is optimal … assume it is not expanded, so we have to measure it».
next step: the next coder or verifier spawn's brief asks it to propose its own trigger wording in its first reply; that reply is round 1 in docs/test-drive/skill-named-load.md (named vs loaded + its wording).

18:58 landed: crew commit bc274fcb + crew-dna c4fe555a, x 0.11.303
<!-- SECTION:NOTES:END -->
