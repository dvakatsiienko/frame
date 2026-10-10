---
id: PK-17
title: 'the 5h prestarter kit — ios shortcut, raycast kick, a scheduled kickoff'
status: done
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-10 11:29'
due_date: '2026-10-17'
labels:
  - m
dependencies: []
priority: later
type: research
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** dima picked a door (ios shortcut, raycast kick or a scheduled kickoff)

pocket 52 · status line was: `standing · task` (his word 13:05: stays until he tried every door and picked one) · dima 10-08, from 38 · research: `scratchpad/research-5h-window.md` (this session's scratch; the facts are in the exa/parallel/researcher logs)

dima: «let's try shortcut and ray cmd. i also want a way to set a scheduled 5h kickoff or a routine. for example: i plan to start you at 1 pm; i wake up at 9 and set a scheduled 5h kickoff at 11 am. how to do that the easiest way?»
- his hands: an ios shortcut on the «Ask Claude» app intent, prompt «ok», home screen on iphone + ipad, ending with a «window opened · resets» notification; the probe tomorrow morning (tap with no claude use in 5 h, boot, read the digest's 5h reset)
- a coder freebie: a raycast script command in x-ray running `claude -p --model haiku` with no tools and a replaced system prompt (not `--bare`); a «kick at HH:MM» variant via a one-shot launchd job + `pmset schedule wake`
- the scheduled kickoff: candidates — an ios automation on an alarm trigger (set the alarm = set the time; runs locked? «?»), a one-off cloud routine set from the phone (whole cloud session per kick), the mac one-shot above. one probe each before a pick
- merged from 38 (dima, 2026-10-09):
  `open · research` · inbox 10-08, first-action first actions

  dima: the 5h window starts on the first token spent, so when he boots me the window opens and our token plan spreads over those 5h. but if at boot the window is already at, say, 2:30, we can code more densely in the shorter window. how to set up a 5h autokicker properly? a tiny probe that sends 1 token to claude.ai so the window is always moving, and he starts at any time but always with less than 5h? alternative: a 1-click door to a 5h prestarter — he roughly plans when he boots me and opens the window 1–2 h before. must: 1. good ux · 2. preferably works on his mobiles · 3. preferably 1-click · 4. maybe a complementary useful feature or two · 5. ideally pretty. «search and propose».
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
done 10-10 on dima's word: the two raycast commands (5h kick, 5h kick at) and their lib + test are deleted, x-ray rebuilt in raycast; no launchd job, log dir or pmset wake was left. dima sets the schedule himself in the cw schedule tab.
<!-- SECTION:NOTES:END -->
