---
id: PK-405
title: >-
  herdr chat: emoji reactions as small events with their own rules, 13 tips from
  a claude.ai thread
status: done
assignee: []
created_date: '2026-11-14T19:16:00Z'
updated_date: '2026-11-16T20:57:00Z'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's ask (stuff project, 🎮 against the storm ✦ 1, 2026-11-14): save the emoji-reaction tips for herdr chat with the fleet, written by a claude.ai project thread that has reactions built in.
dima describes: i ask cloud thread to tell you tips about how to implement emojieable messages in herdr properly (tips and trick) - we have ticket planned for it.

core: treat a reaction as a small event with its own rules, not as a message.

1. both ways: dima reacts to an agent's message, and an agent reacts to dima's. a 👀 «got it, working» placeholder that the agent removes once it replies is worth copying
2. payload: emoji, target message id, who reacted, added or removed, timestamp
3. reply rule in the event: light feedback, reply only when it answers a question the agent asked; without it every 👍 sets off a «thanks!» turn
4. meaning: ✅ or 👍 on a yes/no question counts as the answer (a tap can approve); decide which emojis carry weight, the rest is mood
5. timing: queue reactions that land mid-turn and deliver them between steps; never interrupt a turn for one; merge a burst
6. history: the read-back shows counts plus whether the agent itself reacted
7. wake cost: each reaction wakes a turn; batch them, or skip the wake for reactions that need nothing (two test reactions meant two empty wakes)
8. idempotent: one user + one emoji + one message = one reaction; toggling it off is a removal event, never a second add
9. routing: a reaction goes to the agent that wrote the target message, not to every member in the room
10. trust: the event carries who reacted; a reaction from another agent is never dima's approval
11. context: include a short snippet of the target message, so an agent can read a reaction on an old message without fetching history
12. normalize emoji: canonical unicode (variation selectors, skin tones, zwj sequences like the phoenix bird-and-fire one) and shortcodes both ways (👍 = +1)
13. agent tools: react and unreact, plus «reacting to a reaction I already added does nothing»

start with 2, 3 and 5: they are the parts that are hard to add later.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-405:W1 (2026-11-16 17:36, dima): chat emoji reactions: review how it changes now that base ftr can be borrowed from shepardr.

ticket: FRM-582
close: 22:57 the 13 tips and W1 folded into FRM-582 (his 22:27 «fold everything into a real linear ticket»), clio
<!-- SECTION:NOTES:END -->
