---
id: PK-20
title: >-
  a live lane tracker in the fleet board — resolve with no second lane
  distractions
status: open
assignee: []
created_date: "2026-10-09 10:38"
updated_date: '2026-10-10 20:43'
labels:
  - m
dependencies: []
priority: next
type: idea
ordinal: 22000
---## Description

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


(2026-10-10 17:37–17:48, dima in ccrow's window, relayed by ccrow) — folded:
- a **ccrow strip** in the stash: her last headline, the 🎯 streak and the vet tally; a click opens her window. the data already sits in `notes.jsonl` and `verdicts.jsonl`, so it is a render, not a pipeline; same reader and glance as the trackers and the asks box
- dima: «how could you shape your replies so they could be interesting and useful for me too, if i ever peek into your window?» → he approved her new shape (headline, 🔎 the catch, 👀 for you, 🌤️ fair, predicts + the vet id) and asked cclio to propose her own ideas for making ccrow's output pretty and worth a peek; «we will shape everything in one planning»
- the shape lands in `ccrow/AGENTS.md` at the next siesta (ccrow never edits her charter); a steer: `vet:` → `vet id:` so the line needs no explanation


(2026-10-10 18:02) — dima, the two flows and the join, folded:
- joined asks go model-only (hidden context after his words); he doesn't need to see them in his prompt
- flow 1: cclio ends a turn and fills the asks box → he checks the ones he agrees with (optional steer notes), crosses the ones he rejects, leaves the rest unmarked (parked) → he sends a prompt: his text plus the checked and crossed items reach cclio, the unmarked stay
- flow 2: he sends a prompt without touching the box → cclio starts the turn → mid-turn he spots a forgotten checkbox and checks it → it joins the running turn → the reply covers it → when the turn ends the item leaves the box if resolved, or changes if cclio has a follow-up or something is off
- order: finish the preps, plan the mods chunk fully so a coder can be dispatched, then checkpoint and dispatch (or dispatch, then checkpoint while the coder runs)


## decided — mods grill round 1 (2026-10-10 18:16)
- Q1 the write door: the mod registers its own tool; cclio adds, resolves and sets through it, never by printed markers
- Q2 the ask id: cclio's call (dima: «not a must, your judgment») → a short id per session plus a hidden note the mod stores and returns on the join
- Q3 mid-turn tick: joins the running turn; one cclio has not resolved by the turn's end stays ticked and rides the next prompt; a too-late tick just parks, «that's fine»
- Q4 the cut: chunk 1 = orbit (the asks box) + planned actions + the contract; chunk 2 = the lane tracker + the ccrow strip; chunk 3 = «what did you miss» + the terminal bars
- Q5 where: the fleet board pane's empty lower half; the stash band stays as slim as possible («as the text box grows, your thread hides from me»); the band's empty space above the prompt is optional
- Q6 terminal: replicate for now; dima steers terminal cuts later if needed
- Q7 the codename: 🪐 orbit
- Q8 accept / reject: 🤩 / 👎🏼


## decided — mods grill round 2 (2026-10-10 18:27)
- Q1 lane tracker: his note box per step (joins the next prompt, or the running turn), the waits on the current step, 🤔 per step; plus a 🔭 «what this session waits on» in the board, current session only (the sessions list on top already covers the others)
- Q2 slim stash: try the one-row band of chips with thin meters, but the chips are text only, no click (the traffic-light icon already opens the board)
- Q3 the contract: mechanical, no new skill (yagni, the memory sweep runs): the format rule's ⏳ section rewritten, a per-prompt reminder from the mod, the tool descriptions carrying the contract, and one root `CLAUDE.md` line on why orbit exists
- Q4 the lane runs on main, not a worktree, so dima sees the mod change live; the ⏳ block dies in the same change that ships orbit
- Q5 planned actions: set through the tool at each turn end; after 3 untouched turns the reminder says they're stale; the tool's own text explains stale concisely, nothing extra in context
- Q6 a resolved ask leaves; a follow-up keeps its id, new text and a «changed» mark; new asks only ever append at the bottom, never mixed in or prepended

- steer (dima, 18:34): the 🔭 «what this session waits on» line moves from the board into the band — slim enough, and he wants it visible; shown only while the session waits

chunk 1 shipped as FRM-381 (orbit + planned actions + the band row), closed clean; chunks 2 and 3 stay here

## chunk 1b — two mods from the AI Labs video

ticket: FRM-382 (dima, 2026-10-10 19:16–19:45)

source: the AI Labs «Claude mods» video, read via transit, 9 stills in `~/Desktop/screenshots` (18:35–18:38, all the prompt enhancer). the same orbit coder builds both after FRM-381 (dima: a + b, same coder). shape through `x:shape-idea` before the build.

- **assumption rows** — orbit rows of what cclio assumed; 👎🏼 on a wrong one joins the next prompt. rides orbit, never a new surface. plus one per-prompt usage line in the stash's prompt context (5h used vs pace), so load balancing reads it every turn for free
- **prompt enhancer** — a band button; the mod sends the prompt box to Haiku 5.5 through its model call with `enhancer.md`, our editable instruction file (change the file, change the behaviour); the result lands in the box for review. ? writing back into the box is unprobed
  - v1 starts simple (dima): wispr fixes from the wispr dictionary, and skill words → `/skill-name`
  - decided — three buttons, `enhance | prev | new`, dima's flow: he types, presses enhance and the box takes the enhanced text («new» active); prev brings his own text back; new brings the enhanced one back without a rerun; enhance again reruns Haiku and replaces «new»
  - ticket ids print as the full linear link with its slug, `[FRM-381](https://linear.app/x-com/issue/FRM-381/<slug>)` (dima's example)
  - candidates for after v1: fleet names → exact session names · paths · the screenshot shelf («on the screenshot» → the latest file) · a question tag (a «why/should/can» prompt gets «question, answer only» so no edits run) · fat-drop split · «done looks like»

## decided — chunk 1b grill round 1 (2026-10-10 20:17; Q1–Q3, Q5, Q6 skipped = picks accepted)

- Q1: write-back fails → the enhanced text shows in the band with a copy button
- Q2: «new» brings back his edited version; only enhance reruns Haiku
- Q3: ~1–3 s of Haiku 5.5 per press, spinner on the button; on error his text stays and the band says why
- Q4: an assumption = a choice made without his word that costs a redo if wrong; checked facts don't count. dima: «make it work — i don't want to see 100 assumptions, don't spam me, only the important and interesting ones»
- Q5: rows only on turns that acted on a guess, max 3 per turn, 0 is normal
- Q6: 👍 removes, 👎🏼 + note joins the next prompt, unmarked fades after 3 turns, own «assumed» section under the asks
- Q7: `/mobile-mode` sets a stash flag that flips the per-prompt reminder to «print the fence with orbit ids»
- Q8 (round 2): the flag clears on any tick or press on the board, on «back at the mac», or on `/mobile-mode off`

## exit — chunk 1b (sealed 2026-10-10 20:30 after the blind critic, plan 20261010202310; preflight runs at the spawn, on its ticket)

0. step 0, before any build: (a) the write-back probe on both surfaces — set the box text from a mod, type one character after it, read back a text with CRLF, a trailing newline and an emoji byte-for-byte; the verdict is one line in the mods `AGENTS.md` naming the cc version. (b) a prompt-only trial: for 10 real turns cclio reports its assumptions as orbit asks prefixed «assumed:»; dima grades each; under one a turn and mostly «important» means the rows design holds, otherwise it goes back to him before code
1. given dima typed a prompt, when he presses enhance, then Haiku 5.5 is called once with `enhancer.md`, the skill list and the wispr dictionary; ticket ids come out plain (o13, o14) and the mod hands the session the ticket's title, state and link on send; the box holds the result; prev restores the press-time text byte-identical, new restores the enhanced text including his edits with no second call, enhance again makes exactly one more call; a keystroke during the call cancels the swap; a Haiku error or timeout leaves his text untouched and the band names the reason (plugin tests on call count and texts, red-proven). fallback, if step 0a fails: the same three buttons switch the text shown in the band, and «send without retyping» becomes one copy and one paste
2. given cclio adds assumptions through the orbit tool, when the turn ends, then at most 3 rows show under an «assumed» section below the asks; 🛎️ removes a row, ↩️ with a note joins the next prompt model-only as «wrong assumption: …», an unmarked row leaves after 3 turns (plugin test, red-proven)
3. given dima types `/mobile-mode`, when his next prompt arrives, then the stash's per-prompt reminder tells cclio to print the open orbit asks as a ⏳ fence with their ids; any board press, «back at the mac» or `/mobile-mode off` restores the orbit reminder (plugin test, red-proven)
4. given any push to the stash, when it lands on `main`, then `pnpm mods:typecheck` and `pnpm mods:test` exit 0 before it, every hooks edit went through `scratch-edit`, and orbit's open asks and the mobile flag survive the hot reload (a test)
5. want line: given dima dictates «use the shape idea skill on frm 381» into the box, when he presses enhance, then the box holds `/x:shape-idea` and `FRM-381` and he sends it without retyping, the session getting FRM-381's real title and link; and over a working evening the assumption rows he sees average under one a turn, each one he grades important at the look

- assumptions trial (FRM-382 «before the build»), tally: turn 1 (21:23) 2 rows, 2 right (o38, o39); turn 2 (22:07) 1 row, wrong and caught (o56); then dropped by cclio (flawlog 23:16). dima's yes at 23:18 (o92): build on these 3 rows

## chunk 2 — 🛼 lane + the ccrow strip

ticket: FRM-385 (sealed 22:10, 7 exit lines, preflight green; spec `.scratch/stash-lane/spec.md`; slices SP-3.1–3.4, dima ok o61); spawn ask after FRM-382 lands, dima opens the Code tab

## decided — chunk 2 grill round 1 (2026-10-10 21:59, all picks accepted, notes folded)

- Q1 store: a `lane` op on the orbit tool writes a file under `~/.claude/shelf/`; it survives a compaction and is cclio's own progress log
- Q2 depth: up to 5 items per lane, written by cclio in plain words for dima, no tech detail; an item may map to a ticket or not (one-to-one won't always fit); an item naming a ticket shows it as a link that opens linear. dima: «easy for me to understand what the lane is about and where we are in it … don't overload it»
- Q3 the pointer: cclio moves it through the tool at every member's done and at each turn end; a stale nag after 3 untouched turns, like phases; linear auto-check later. dima: the lane always holds its whole scope; a done item never leaves, only its state changes. unlike phases, where «now» is always first and drops off when it moves
- Q4 lifetime: shows only while a lane is set, one per session; gone when cclio ends it or the last item checks
- Q5 board order: 🌔 phases, 🛼 lane, 🪐 orbit, the ccrow strip (dima: «let's try, i'll probably steer»)
- Q6 ccrow strip: a test drive, simple and useful for him; step 0 probes a click that opens her window, no click if it fails
- Q7 name: 🛼 lane (dima: the fleet word is already good, no new codename)
- the 🔭 waits ride the band (chunk 1, round 2)
- critic round (plan 20261010220027, 5 findings vetted): one note box, on the current item only (dima, o58, reversing a box per step); a finished lane stays listed, all done, until cclio ends it at the next siesta (dima, o57); a timestamped pointer history in the lane file; the ccrow strip shows her headline verbatim, vet counts from `verdicts.jsonl` only; one test per exit clause
## chunk 3 — 🐠 catch («what did you miss»)

ticket: FRM-386 (sealed 22:25, 7 exit lines, preflight green; spec `.scratch/stash-catch/spec.md`); slices SP-4.1–4.3 (dima ok, o69), spawn after FRM-385

## decided — chunk 3 grill round 1 (2026-10-10 22:16, all picks accepted)
- settled before: buttons clear, copy, 🤔 (explain next turn); a note box per piece for the steer; joins model-only like an orbit note (resolves the old prepend/append ?); never starts a turn; an experiment, a simple mvp
- Q1 cclio adds the pieces through the orbit tool at turn end, max 2 per turn, 0 is normal
- Q2 name: 🐠 catch
- Q3 a piece stays until dima clears it; max 5, the oldest drops
- Q4 its own section under orbit, hidden while empty
- critic (plan 20261010221702, 5 vetted): the tool description says when to catch; a piece quotes text already printed; at 5 held a 6th is refused (dima, o68, reversing Q3); the store counts 🤔, clears and refusals, keep-or-kill read 2026-10-17; the copy fallback appends after his draft
- Q5 the terminal-bars half is dropped after one look in dima's terminal: FRM-366 already draws the meters there (`FTR.md` meters line), and the band's 🔋 chip covers the sline pace idea

## tomorrow — FRM-382 resume (dima, 2026-10-10 23:47–23:49)
- SP-2.5 assumption rows landed anyway at 23:49 (50bef031, already built when the pause landed); the verifier on the whole ticket, base the parent of 4694ec05, head 50bef031
- ccrow freebie left: her ledger line at the packet head (sent n · holdout next in k · last send · hits)
- rider o102: ⏰ turned on after a reset still wakes the sessions that reset left capped (armWake reads the switch only at fire time, `register.tsx` ~677)
- rider o103: the band's ⏳ rounds up like cc's «resets in 1 min»
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

back from linear (FRM-377 canceled) on dima's word, 2026-10-10: wanted soon, linear is the long shelf
<!-- SECTION:NOTES:END -->
