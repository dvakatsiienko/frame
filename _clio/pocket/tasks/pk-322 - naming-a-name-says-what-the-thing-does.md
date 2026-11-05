---
id: PK-322
title: 'naming: a name says what the thing does'
status: done
assignee: []
created_date: '2026-11-05T20:19:00Z'
updated_date: '2026-11-05T20:20:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
fleet-wide naming rule from dima's side-channel words (22:03, 22:10)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: rule landed in root CLAUDE.md, recount reminder 12-05

W1: let's do a little sidestep here. so far i noticed that i ask to rename stuff too often.
W2: in my memory, without measurement, i asked for renaming at least 40 to 50 times during recent months, or 2, or 3, or 4. you can try to measure how many times i asked to rename stuff.
W3: 90% of rename asks are all about one reason: initially you name stuff so it is not clear enough for me to understand what it does and why i ask for it.
W4: you create a lot of stuff very quickly because you are designed to act like this, so i should have a way to understand what stuff does from a higher level.
W5: for me a higher level is a name of the stuff and anything. it can be a script, function, cli verb, skill, or anything.
W6: names should describe in a way, ideally, so a thing describes what it does from its name. it can tell more about what it is or what it does.
W7: propose how to solve it via habit. recently we updated habit about family-first namings. propose how to define a fleet-wide naming convention and where to have it so it works.
W8: all things that get named initially are clear. you tend to name stuff very concisely and compact, often one word, which is good. i like this pattern too, but it doesn't scale: when a lot of stuff gets created, one short word stops working, so some additional clarification should be added. it is an accepted sacrifice, so propose how to have this working.
W9: one evocative word only for a member, mod or app, never a metaphor on a tool.
W10: yes, but metaphors and other custom stuff possible via top-7 or my ideas when i ask. e.g. fleet names, vibe etc. only weighted names are accepted. everything else: clear, reads well to a newcomer, and says what it does from its name alone.
W11: recount on 12-05; a commit gate can't judge clarity, so none. reminder: add a little context on why this reminder exists and how to recount.

raw text (side channel, /Users/dima/frame/.claude/worktrees/fork-38d42581/.scratch/naming-wish-raw.md):

## 22:03 canary question (dima's words, groom W10)
`quiet canary ` ← what is it? your (clio) custom skill? if yes propose top7 better names for it. i do not understand what does it do from its name.

## 22:11 (dima's words, groom W11-W12)
quiet canary rename wants mods update too? mods lane rider?
if yes — shape the rename and relay to clio as a rider for mods codie

## his ticks (dima's decisions)
- naming habit: build as proposed, 22:10
- quiet-canary → quiet-delivery-test, 22:10
- /quiet-canary: keep it, one line in mods-verify, 22:06
<!-- SECTION:NOTES:END -->
