---
id: PK-20
title: >-
  a live lane tracker in the fleet board — resolve with no second lane
  distractions
status: open
assignee: []
created_date: "2026-10-09 10:38"
updated_date: '2026-10-10 10:50'
labels:
  - m
dependencies: []
priority: next
type: idea
ordinal: 22000
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
<!-- SECTION:DESCRIPTION:BEGIN -->

pocket 58 · status line was: open · idea · shape-idea first

- dima, 2026-10-08 (screenshot, the board's empty lower half): «i often ask you to tell me where we are … how could i see that plan live via a mod, maybe in the board area, because it has a lot of wasted space?»
- what it shows: now · next · then — the thread's lane (researching the adviser → cli groom → night-shift grill), one line each, plus the 🔭 waits
- two sources, a grill picks one: the pocket's «order» plus a `now:` line cclio keeps · or a `📍 now:` line in cclio's replies, which x-mod-stash already parses (it reads the ⏳ block today), so no new file
- owner: x-mod-stash's board (the mods coder); FRM-349 kept the board in stash, so this is its home
- dima, 2026-10-09 (screenshot, the board's empty lower half): «what I wanted is a live list of a lane with checkboxes (ordered tasks, organized by lane if several lanes run at once), so I could see a kind of progress live.» the `📍 now:` reply line was «naive, it will display poorly». a file the mod reads from has to exist, but never a stray one: it serves several purposes at once — cclio's live progress log during a lane (the one planned before) and the board's render. «a bigger thing to plan» → a granular grill tomorrow, then a ticket

(2026-10-9) — newest, process through shape-idea skill
dima's wish:
i want three things in a mod view:

1. shift lane progress tracker
2. your «current and nearest planned actions» progress tracker
3. your «waiting for your word» stash

**shift lane progress tracker.**
why: when lane goes, i ocassionally peek inside. thread is a mess for me because it ping pong with everyone about tech details, PR's and stuff. unreadable for me. i want to see overall progress plan list. with a moving pointer across the list. it moves as lane progressses.

for example:

1. [x] FRM-XXX: atelier v2
2. [x] FRM-XXX: chords app v2
3. [] FRM-XXX: trophy-sys v2 ← we are here (progress pointer)
4. [] FRM-XXX: migrate pnpm to bun
5. [] FRM-XXX: migrate biome to oxclint
   it is only activates during lanes and shows nothing when there is nothing happening.
   i don't know if it is automatable - likely not. research, think and tell yourself.
   worst case - you just keep it live yourself. as weel as using it as a lane progress tracker for yourself. to a void drifts you could set this place as a min progress tracking place as highest prio.

it works via one-lane too.
[] FRM-XXX: migrate pnpm to bun

1. [x] install bun
2. [] run pnpm-to-bun migration script ← we are here (progress pointer)
3. [] clean old pnpm refs
4. [] reinstall pnpm global installs to bun global installs
5. [] hunt pnpm leftover connections and reconnect to bun
   optionally (depending on looks and scope), the expanded version applies to night shift lanes (e.g. longer ones). can't tell yet, without it even existing.

unknowns:

- if non-automatable - where the «store» is? i think in your folder somewhere, so you could edit it quickly.

musts:

- pretty look
- descriptions are via writing-for-humans, very clear for me

**your «current and nearest planned actions» progress tracker**
why: you often finish some chunk of work via a turn and print me «waiting for your word» containing something short like «commit and slay? y/n». i print «y», you commit. then your next turn: what next? → print me few options to pick. this wastes your turns. and time.

not good:
turn 1: «waiting for your word» — commit and slay? ← i agree
turn 2: «waiting for your word» — do A, B, C? ← i agree
turn 3: you are acting

what would fix it: each time your print «waiting for your word», you also print me a list of next main (ours) lane actions, that we would eventually do after current «waiting for your word».

for example, better:
turn 1:
«planned actions»

- action A
- action B
- action C
  «waiting for your word» — commit and slay? ← i agree, and say: «then do action B and...steering»
  turn 2: you are acting

as you see we are saving a turn each time. looks small, but it adds up.

so: i want a permanent quick peek into your next actions plan.
currently you have a mock of it via, half-baked mid-chaotic turn.

how i want you to answer right now (prettier shape):

📝 planned actions: (propose top 5 emojies for this list)

- action A
- action B
- action C
  each step have to be clear, and human readable. i should not gess what the step is about.

waiting for your word as usual.

but to peek into your next action, i still have to wait for a turn, and also, you often forgot to print. you can spawn a haiku to find how many times i printed «whats next?» «where we at»? «next?», and you will be surprised with the number.

so: i want a mod stash place (likely in a board), where the «planned actions» are parked always, and you maintain it in live mode, never stale. whenever i want to peek into you plan i go look and see, and steer you.

quantity: i think 5 items is good to start with.

**your «waiting for your word» stash**
why: your waiting for your block is not convenient for me. our contract so to work incrementally, turn-by-turn, where we outline a chunk of stuff for you todo → you do → print me this block with questions, clarifications, approvals.

but:

1. it becomes very chaotic when second lane is active — everyone spams you and i get confused often
2. i often have to scroll a lot to find correct block to copy paste, because you often rewrite it, after paralel lane spam you with updates
3. i simply do not like the ux

how it goes chaotic:

second lane is active. you do your turn, print message body + the block:
body ~40 lines
«waiting for your word»

1. A? ←
2. B? ←
3. C? ←

me: reading the body, printing the response in prompt box. (consider that i need time to read your message and print the reply)

...i read and write you the reply...my focus on current turn...
BUT: while i read it, second lane already spammed you with 6 messages, 2 of which are merges, another two are clarification messages, and 1 is a іmprovement proposal, and last one is a roadblock.

now your «waiting for your word»

1. coder roadblock: A or B? ←
2. A? ←
3. PR X: merge? ←
4. B? ←
5. verifier proposal: do, fold or drop? ←
6. C? ←

...i finished writing the reply for that your first initial turn»... and now scrolling a reading the mess of updates from everyone...slowly catching up with the «progress», up-writing corrections/replies/steers for pending second lane messages.

...at this point, for me it is already a race between second lane spam, and your thread...
and since i copypaste your «waiting for your word» block and often fill my steers into «←» part,
the inital «waiting for your word» block that i arleady filled, now broken becaues of «waiting for your word» block state change (second lane updates arrived).

this makes the ux very bad, and exhausting for me.

so, the solution i propose: a stash section (likely in a board), where your «waiting for your box» is always parked, in live state, and you never print this block ever again in your responses.
you maintain that block as my approvals/decisions source of truth. (no actions until i prompted you with the replies).

the stash format: can be actually, the same, numbered list. but you only append new items, never mix:

1. A? ←
2. B? ←
3. C? ←
4. coder roadblock: A or B? ←
5. PR X: merge? ←
6. verifier proposal: do, fold or drop? ←
   it have copypaste btn. i prompt you like this
7. A? ← ...dima's steering...
8. coder roadblock: A or B? ← ...dima's steering...
9. B? ← ...dima's steering...
10. verifier proposal: do, fold or drop? ← <!-- empty means «agree» -->

<!-- is item is not in prompt — it is NOT agreed -->

current «stash asks» implementation does not works for me, bad ux. i keep if folded.

gotchas:

- misunderstanding: you may somehow decide that i agreed where i was not. so maybe a link between «waiting for your word» stash place should be somehow identifyable via an easy way.
- the cost - you now have to watch it always. how to make cheap easy an bulletproof flaw-less?
- current stash asks section have also messages from other threads — it can be dropped for now, until we release a working MVP for your thread, then think how to scale — can we make it work with good ux for any cc thread?
  note: for now i don't want «global» block - only current session «waiting for your word» is parked there.

also: let's figure out a better name for «waiting for your word». some pretty, clear, and recognizable codename that we can create a contract around.

**shared unknowns, applies too all**

- how costy for you would be to edit it each time?

**big picuture**
think of all my asks as a whole. how to make it work efficiently, fluently and with least effort and movements possible, automating as much as possible?

- consider automating via backlog or any other mean.
- consider tuning backlog config, so maybe a mod could pull for a backlog todo? 🤔
- some time ago, while we were grooming the process of running night shift lanes, you told that you will create a kind of «lane progress file», to keep track of the lane progress as an autocompact surviving backup. but never created one, and we even launched few night shift lanes already. maybe connect it somehow?
- i proposed 3 «progress trackers» kinds of mods. think how to best unify them. my take: probably two views: one is a lane progress (active only for second lanes), and your's — almost always active.
- ideally i want it to be least effort for yourself. this wish should not put additional burden for you. how to make it useful for you too?
- maybe task list --json --watch ?


(2026-10-10 17:14, written during the 10-09 power outage, after the block above) — dima's additions, folded:

- **why the asks box exists**: the main thread is chaotic and multi-lane, so i often miss data in your messages that i don't want to miss. the stash tries to solve that
- **the checkbox mod**: each of your asks is a checkbox line (in the stash, likely the board). checked means i agree and accept your proposal. an item leaves the list only when checked; the checked ones are prepended to the next prompt i send you, picked up automatically on send, several at once. you clear or resolve them from the mod with each reply. an ask can carry an optional text box: i can write in it any time, it does not affect sending, only the checkbox does. no more copy-paste. you design the asks upfront, e2e, as a mod coder would: clear and reading well, short (i like one-liners), clear enough for you when it comes back 20 turns later, still readable with 20 piled up
- **the «what did you miss» mod**: stores pieces of your replies i'd be especially interested to read. each has clear (marks it done), copy (i paste and clarify), and 🤔: when on, your next turn explains that piece — mid-turn it appends, so the running turn ingests it; when you're paused it attaches to my next prompt, prepended, never appended. it arrives as `/wait-what <msg> <optional steers>`, a small text box carries the steer; it never starts a turn, it only joins one
- **correction for the asks box**: can it work universally, in any cc session, one asks box per session?

- **nice to have, when the mods coder starts** (dima, 2026-10-10 17:17, terminal screenshot): in the terminal, the stash's 5h and ctx bars do not show (they stay in the desktop app only); the «+14 % pace» figure moves into `sline` instead, same colour and idea, terminal only


(2026-10-10 17:29) — dima's verdicts on the playback, folded:
- the five pieces read right: lane tracker, planned actions, the asks box, checkbox asks, «what did you miss»
- checkbox asks: yes, plus a «check all». a pending state: once checked asks ride a prompt, they lock (can't be unchecked) while cclio is mid-turn, so nothing drifts or breaks
- an ask's note is a steer: with it he can discard or redirect. an easy disagree without text too, an accept / reject pair of buttons; prettier emoji than ✅ ❌ if a more elegant pair exists
- unchecked means nothing: it does not join the next prompt and stays parked. so every ask must be recognizable to cclio whenever it comes back, many turns later; cclio picks how to tie an ask to its memory (an id or similar)
- «universal»: every cc session shows only its own asks in its own box
- «what did you miss» is an experiment: a simple mvp. the pieces are things cclio said that he likely did not see — interesting facts worth a follow-up question
- planned actions: start with 5
- the asks box codename: an adhd round, plus cclio's top 5
- no mod ever starts a turn: only a prompt sent from the prompt box does; what he selects in a mod joins it
- placement: the mods live in the desktop app's side pane, the fleet board's empty lower half (stacked, or two columns side by side)
- the biggest failure point is a habit: cclio must know this mod cold, since it becomes the main comms place; the plan names where that knowledge lives so it is never forgotten
- ? 🤔 earlier said «prepended, never appended», today «what i select from mods is appended»: which end of the prompt?

<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

back from linear (FRM-377 canceled) on dima's word, 2026-10-10: wanted soon, linear is the long shelf
<!-- SECTION:NOTES:END -->
