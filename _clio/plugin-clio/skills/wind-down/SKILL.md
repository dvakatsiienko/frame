---
description: load when dima says «wind-down», «wind down», «in 2–3 h we finish», «gradually stop everyone», «finish everything for today», «finish as soon as possible», «stop everyone now» — main clio only, the day's lanes ready to park on one stop word.
---

# /clio:wind-down — the day's lanes park on one stop word

his want (PK-363:W1124–W1130, 2026-11-11; reshaped PK-349, 2026-11-24): a wind-down is smooth, gradual and efficient. every lane hears it is coming and keeps working; he sees the estimates and one proposed stop target; when the target lane lands its part, one stop word parks every lane at its nearest clean point. the estimate comes from the day's real cadence, never from inference; only his word stops a lane. main clio runs it; a wing estimates its own lanes and follows main's plan.

## the steps

0. **the notice, first, to every member at once, with no time in it** (dima, 2026-11-24 19:07: «you should at first send everyone a "wind down" notice without time»): «we plan a wind-down soon, keep working: look for a good spot to commit, hand off and park: your chunk's end if it is not too long, else your slice's, else your step's. every step its own commit, your handoff draft current. answer in one line: minutes to your step's, slice's and chunk's end by today's pace». a window he named is the size of his wish, never a timer
1. **the roster**: `ListAgents` and every live 🛼 glide; per lane: its chunk and the lane-plan steps it has left
2. **the cadence, measured**: per lane, its own landed steps with their commit times (`git log --format='%h %ad %s'` over its paths, or its plan's ticked shas), the newest hour first: its median minutes a step; a lane with under 3 steps in that hour takes the day's median
3. **the wings estimate too**: a wing running a lane answers the notice for it; the lane's estimate is the median of its number and mine
4. **the report and the stop target, printed in one reply** (dima, 2026-11-24 18:59: «a short brief about each lane but also a brief estimate on how much time is left for already started work»; 19:07: «We should measure roughly a good synchronous wind-down stop point where everyone finishes some meaningful part»):
   - one line per lane: what is in progress, then the minutes to its nearest meaningful end: its chunk's when it is not hours ahead, its slice's when under an hour, else its step's. each `<n> × <m> min (today's median over <k> steps)` beside the member's own number; the two far apart → both, and the middle; a number without its source never prints
   - then the proposal, one orbit ask: «stop target: <lane>'s <part>, about <HH:MM>», chosen so most lanes finish a meaningful part; the pick's text names only what lands by that time. a chunk that ends within about 40 min past his window is named with its time («allow?»), since he often gives more (dima, 2026-11-23: «if I ask you to stop and some of the lanes are near the end of the chunk, you should let me know and propose to let them finish … I simply don't have the capacity to figure such details out»; 2026-11-24: «today I could change a 15-minute wind down to half an hour of wind down or even 40 minutes just to finish a chunk»)
5. **everyone works until the one stop word** (dima, 2026-11-23: «what i value more is the synchronous stop of all lanes»; 2026-11-24: «While someone finishes everything planned, everyone else should still be active and ideally everyone stops synchronously»):
   - a lane that lands its part before the target does starts its next sealed step or chunk (dima, 2026-11-24: «if mod chunk finishes at 19:40 and speak is still finishing its slice … the mods can still start a new chunk and do a few steps»; PK-363:W1153 «you can send herdr codie another slice, so he is not parked for free»), an unsealed one getting its seal that turn, an unsigned one groomed and signed by clio; a member that waits gets its next step, never a park
   - the target lands → the stop word to every lane in one turn: commit at the nearest clean point, hand off naming the next step and what is half-open, park; never stop. landed is its `[done]` or final; a running sixth sense round finishes first, halt waiting (dima, 25 Nov: «i want wind down to be calm»); an unstarted one waits for pickup
   - a target that slips more than 10 min past its time is re-estimated and told him in one line, with the pick: wait, or a nearer part as the target
   - where each lane stops, best first: its chunk's end, its slice's end, its step's. in any case committed, with a handoff to pick up from. never a chunk's merge by rule (his 19:16: «as granular as possible»; «make stop not mandatory … let everyone aware that we are winding down so they are ready to stop at whichever nearest step or slice or chunk they are at»; «instead of taking the chunk merge as a stop point, we could just granularize and stick to slices, or even steps in the plan of the lane»)
   - a guard, sign or merge change lands only after its sixth sense round; a feature that needs his hands lands behind a switch until he tries it; a pr left open at the stop stays open, named in the handoff with its next act
   - his «now», «as soon as possible» or «finish soon» is the stop word at once: each member finishes only the step in its hands, minutes not hours
   - a member stops its pr Monitor (`TaskStop`) before a second wind and re-arms it after the pickup, since a live watch holds the wind silently (`wind-run.ts`); «do it now» is the default whenever it fits the window, never «tomorrow» (his o3, 11-18)
6. **the check-ins**: halfway to the target and 10 min before it, re-estimated from the newest commits; a lane's state comes from its member (`node ~/frame/_clio/script/check-idle.ts <name>`) and its newest commit, never from its lane plan's ticks alone; he hears only a slip
6.5 **the tails**: a tail no lane owns is solved tonight; it moves to a later day only on his word or when it needs a fresh session, and the reply names which (11-13: three «homed for Monday» overridden in 25 min, «i want all non-lane tails to be solved»)
7. **the end**: each parked member's handoff is read against the night's decisions and rewritten through `x handoff write --replaces` where it misses one; then each parked lane gets its own `⚠️ stop <member>` orbit ask. then one orbit ask for the halt, run with him, after the day's tails and tomorrow's prep
8. **the log**: per lane, estimate vs real finish, one line in `docs/test-drive/wind-down.md`, written before the halt ask goes out; the done test: every lane worked until the one stop word and parked on it at a committed step, its handoff naming the next one

## never

- a park or a stop decided by the estimate alone (his W1127: off estimates stopped lanes too early)
- a lane stopped before his tick, told «nothing new», or parked while another still works
- a wing running its own wind-down: main runs one, the wings follow it
