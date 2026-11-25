---
status: open
dates: 2026-11-13 → 2026-11-24
tickets: [FRM-630]
tags: [comms, dima-graded]
fed-by: incidents
---

# comms log — dima's graded comms cases

- rendered from `~/.claude/shelf/comms-log.jsonl` by `node ~/frame/_clio/script/comms-log-render.ts`; the jsonl is the one source, queried with duckdb
- a case: what happened, its context, his grade and words verbatim, the reply shape that hurt, severity (hot · siesta · halt, his word wins), the fix and its home
- the rules (severity, who fills it) live in [comms-log.md](../../comms-log.md); the statistics of all talk in [fleet-operator-comms.md](../../fleet-operator-comms.md)

## c1 · ran-ahead · - · hot · fixed, watched

- **what:** clio ran his approved 10-step order alone while he spent ~34 min writing his reply; grills and asks of his started with no sign of him
- **how:** he ticked the day's order (o1) as approval; each member or job «done» (helga's receipts, wishkeeper's finish) woke a clio turn, and the last reply had named the next step
- **why:** no line told a member's done apart from his go; the approved order read as a script
- **when:** 13:40 tick → 14:55 reply → 14:59–15:09 the fleet-priority grill, the guard contract, parse fixes, a rex lookup
- **where:** the main thread in herdr's chat, a planning day, no lane running
- **who:** clio main, helga and wishkeeper (whose dones woke the turns), dima writing in the desktop app
- **his words:** «stop. why you run away without me?» · «im still writing a message to your reply … why you started a grill without seeting any activity from my side?» · «Never start any grills without me present»
- **shape:** pace: a new topic of his opened while he was still writing
- **fix:** his items wait for his prompt or his tick on the orbit «next:» ask; a member's done only continues clio's own work (habit-dima-comms § his items move at his pace); a Stop hint when a woken turn opens one of his items (siesta-gate.ts)
- **home:** FRM-630:W9–W16, commit 6b02ce90
- **source:** /Users/dima/.claude/projects/-Users-dima-frame--clio/71eef4ac-a29c-48ef-b147-c1dc088f8eff.jsonl (15:09, 15:12, 15:35, 16:01)

## c2 · restating · - · siesta · rule live, on trial to 11-20; repeat counts here

- **what:** after he agreed a plan, clio restated it back at length
- **how:** a plan settled in orbit ticks; the next reply reprinted the agreed steps as a long summary
- **why:** a habit of confirming by restating; he reads none of it once dispatched
- **when:** 11-13 evening (his o153), and he names it again 11-15 16:43
- **where:** the main thread, reply after a dispatch or a settled plan
- **who:** clio main, dima
- **his words:** «When we agree on a plan it is enough for me if you reply with something like, "The plan is in. I now proceed," or something like this. Simply confirm that you got it and you move, and no restatements are needed.» · «e.g. today i graded as useless your message that restated an already agreed plan.»
- **shape:** restating: an agreed plan reprinted
- **fix:** the reply after a settled plan is one line, «the plan is in, moving», plus only what deviates or risks
- **home:** habit-dima-comms (o153 trial)
- **source:** FRM-630:W3; habit-dima-comms «A reply never restates what he settled» (o153, a trial to 11-20)

## c3 · pace · - · hot · second sighting of c1: the rule alone did not hold, raise at the next comms review

- **what:** the same shape as c1, one day later and with two lanes running: in 40 minutes clio printed 12 replies and put 17 asks on his board while he was still writing one answer; a board, a research print, a siesta card, a correction and three codie relays landed on him as one bunch; measured: 12 replies and 17 asks (his dictation reads «20 replies, 70 asks») between 14:05 and 14:46, with no sign of his presence after his 14:19 «i am here at kb now»; his own reply took him 30 minutes to write, and clio could not tell whether he was there
- **how:** every member ping, subagent finish and background job woke a turn, and each turn ended in a reply to him plus new asks; the Stop hint «his items wait for his prompt» fired three times and each time clio answered it with one more reply
- **why:** clio treated each event as a report turn; nothing held the asks back while he showed no sign of having read the last reply; she also poked his Chrome twice through agent-browser, which popped approval dialogs on him, with no word first
- **when:** 14:05 boot prompt → 14:18 his mobile steers → 14:20–14:40 the bunch → 14:46 his reply
- **where:** the main thread in herdr, his orbit board
- **who:** clio main, dima; the mods and herdr codies, wishkeeper, the researcher and helga as the wakers
- **his words:** «can you stop running away? read my yesterday incident from comms-log. what are you doing with agents-browser? i still slowly write you answer and you keep producing replies and do action items faster than i can even send my reply.» · «calmer pace pls!» · «you again folded out a whole bunch on me. i supposed we solve stuff one by one.» · «Log another comms issue case into the comms log. Properly describe what happened, how and why, and the numbers that you just showed: 20 replies, 70 asks in 40 minutes without seeing even one sign of my presence. You don't even know if I'm here and still writing a storm of asks on me» · «As you can measure, starting from my previous message to you, half an hour has passed. I've spent half an hour writing my previous reply.» · «solve one by one, do not rush, and rushing is not allowed.»
- **shape:** ran ahead
- **fix:** until he answers the last reply, a woken turn does clio own agreed work and prints nothing; one ask at a time reaches his board, the rest wait in the flyway; anything that touches his apps is said before it is tried
- **home:** habit-dima-comms § his items move at his pace; FRM-630
- **source:** FRM-630:W9, W12, W14, W15; c1

## c4 · clarity · + after re-ask · siesta · fix landed

- **what:** a look ask named the codie's private step ids (S0+S1) and a «⌘⇧P hide» that did not exist; the rewrite as a plain card still told him nothing; only the third, a numbered «what you should see» list, landed
- **how:** orbit look ask o2, twice reworded, then the reply's numbered list
- **why:** the ask relayed the member's own labels instead of what changed in his view
- **when:** 11-18 11:21–11:55
- **where:** his board and the main thread
- **who:** clio main, the herdr codie, dima
- **his words:** «what is S0 + S1? i di not understand where to read from» · «currently, clarity of your requests is not good for me, i spend 80% of effort trying to understand what you want from me, isntead of actually testing what changed» · «↑ this description is better. 👍🏼 (log in comms-log - what i disliked and how i liked after re-asking)»
- **shape:** cryptic ask
- **fix:** a look ask names what he will see, part by part, never a member's step id; the herdr codie got the liked shape as its look-card template (11:55)
- **home:** herdr codie took the liked shape as its look-card template
- **source:** 11:21–11:55 thread, his 11:55 line

## c5 · clarity · - · siesta · fix landed

- **what:** the FRM-643 look card told him to open «the board» and a «codie subcard» without naming the surface; the change lived only on cc's own board in a thread's Terminal view, and he searched herdr's orbit
- **how:** orbit look ask o36 and the 13:50 reply's three steps
- **why:** the card named a part, never the surface it lives on, in a fleet with two boards (herdr's orbit, cc's Terminal-view board)
- **when:** 11-18 13:50–14:01
- **where:** his herdr orbit
- **who:** clio main, the mods codie, dima
- **his words:** «you told me to test stuff in a multi-surface environment and did not tell where. result - i spent ~7 mins looking into the wrong place, and typing you a message, ~10 min lost total. fix: tell precisely where and what to look/test.»
- **shape:** wrong surface
- **fix:** every look step opens with its surface and place: «in herdr's orbit», «in the quill», «cc's board, a thread's Terminal view (⌘⌥T)»; a change he cannot see on his daily surface says so first; crew-codie how-you-work § the look card carries the line
- **home:** crew-codie how-you-work.md § the look card
- **source:** his 14:01 herdr-typed line

## c6 · pace · - · siesta · fix landed

- **what:** replies kept listing clio's own small tails («one tail left», «my tails», «not 100% tail-free») and promising a list for him, instead of solving them unasked and reporting tail-free
- **how:** replies at 13:19, 14:25, 14:36 and 14:49, each naming tails
- **why:** the tails rule said solve today, and the replies still reported tails as open items for him to read
- **when:** 11-18 13:19–14:50
- **where:** the main thread
- **who:** clio main, dima
- **his words:** «Why do you write me this whenever, wherever? You could just close it and tell me that you're free.» · «You clean all your small chores by yourself instead of me pointing you to all your small tails and asking me to clean them. For today I already asked you about 10 or 12 times»
- **shape:** tails handed back
- **fix:** craft-pm: a tail of mine never reaches him as a list; solved in the turn it is found, then one line «tail-free»; only a tail needing his word goes to orbit
- **home:** _clio/memory/craft-pm.md § the freebie rule
- **source:** his 14:50 prompt

## c7 · volume · - · siesta · fix landed

- **what:** the 15:52 reply answered his question in two clauses, then printed a full siesta card (nine lines of wishkeeper findings, chores, a freebie, a usage line, a light line) he had no use for
- **how:** the siesta skill prints the card whole into the reply that follows it
- **why:** the card is written for clio and wishkeeper, not for him; nothing filters it to what needs his action
- **when:** 15:52, while he worked with the designer
- **where:** the reply to «chords migrated. now what - messhunt?»
- **who:** clio main
- **his words:** «i showed you a screenshot of your reply and the area that holds 95 % of the clutter in my view and brings no or almost no value: it is long and big. i don't have the time and capacity to read all of this; it only distracts me and trashes the output. the info important for me was at the start: the two clauses about the mess hunt and the design loupe. everything else in your reply is not useful for me. how to fix your replies so they are shorter and contain only relevant info? the wishkeeper results are not 100 % useless, but in such an overloaded shape they become useless as a side effect: when everything becomes too large, everything becomes irrelevant. i think you just shouldn't print your siesta cards to me, or at least print only the actionable items.»
- **shape:** report bloat
- **fix:** proposed 15:58: a siesta card goes to a file; the reply carries only lines that need his action, and a reply answers his question then stops
- **home:** clio:siesta step 5, habit-dima-comms (on his tick)
- **source:** his herdr steer 15:57 with a shot: ~/Library/Application Support/CleanShot/media/media_TNrkHd5sKq/CleanShot 2026-11-23 at 15.55.11.jpg

## c8 · volume · - · siesta · fix landed

- **what:** a reply opened «Hazard line updated as ticked: `rules/fleet-hazards.md` now says the hook allows a clean call …» and went on to a reviewer's note on how a cpu measurement might count a test worker as zero: nothing he uses changed, nothing for him to decide. beside it he marked a useful one: «Kokoro is back and the ear test is closed», a thing he uses working again, said in its first three words
- **how:** each finished chore got its own reply
- **why:** the rules asked for every state change to be reported with its command; nothing asked whether he had a use for it
- **when:** 11-24, before 15:03
- **where:** the main thread
- **who:** clio main
- **his words:** «useless noise» · «useful — i know kokoro is back (my readaloud door)» · «I opened her thread and can clearly show you what is useless for me and what is useful»
- **shape:** housekeeping told as news
- **fix:** the format rules open with: write as said aloud to a colleague who was not in the room; before writing ask «does this change something he uses, or need his decision?», neither → write nothing
- **home:** home/.claude/rules/fleet-output-format.md § to dima, first
- **source:** his 15:03 prompt with a shot: ~/Library/Application Support/CleanShot/media/media_bMRJScKMUi/CleanShot 2026-11-24 at 15.03.04.jpg

## c9 · volume · - · siesta · fix landed

- **what:** a reply told the agent's own save trouble («The hazard line's commit was refused by the memory check (it grew the file by 11 bytes …) so I shortened the clause … The commit is running again»), and another said «committed and on origin (verified: `git status` reads level …)». he marked OK only the reviewer's verdict that a fix was clean at round 3: progress on a lane he follows
- **how:** a refused commit and its retry each got a reply
- **why:** nothing told an agent its own chores are not news; the refusing check was wing 1's new net-zero memory check
- **when:** 11-24, before 15:06
- **where:** the main thread
- **who:** clio main
- **his words:** «useless tech noise, only overloads» · «OK — i see the progress on key part of the lane (round 3 clean)» · «In the output you spend effort to write your replies, and I spend effort to filter them out, which is double inefficient. They only hurt.»
- **shape:** own chores told step by step
- **fix:** an agent's own chores (a save refused and retried, a commit landed, a file trimmed) are never told to him; progress on a lane he follows is one sentence, the outcome first
- **home:** home/.claude/rules/fleet-output-format.md § to dima, first
- **source:** his 15:06 prompt with a shot: ~/Library/Application Support/CleanShot/media/media_lfheEb45rq/CleanShot 2026-11-24 at 15.04.17.jpg

## c10 · orbit · - · siesta · fix landed

- **what:** an ask on his board read «dialog hook, what I left unsaid: your press was the last stop on an unparseable delete»: it did not say which area it belongs to (speak, mods, the board itself), so he could not place it
- **how:** the ask opened with an internal name and a tech phrase
- **why:** nothing makes an ask name its area; his earlier wish for themed asks is not built
- **when:** 11-24 15:09
- **where:** an orbit ask from the main thread
- **who:** clio main
- **his words:** «I do not understand this honestly but what is it related to? Is it about speak or mods? Comms log, Wisp: you write me and ask. That doesn't describe an area where it relates. It is Orbit-related. Previously I asked that I want Orbit asks to be themed (e.g. to tell what they are about). Verify if my wish is in so we build it at some point»
- **shape:** an ask with no area
- **fix:** folded as FRM-670:W13, an ask names its area
- **home:** FRM-670
- **source:** his 15:09 tag on main's ask, relayed by main 15:28

## c11 · hidden-result · - · siesta · fix landed

- **what:** the herdr review's findings stayed folded in a ticket; he got them only after asking twice. the reply he then got was useful: it showed the scattered timers and states, everything unsynced
- **how:** he asked when the review gets solved, then «i mean the result»; the findings came after the second ask
- **why:** a review he asked for was written into the ticket and the reply kept only the plan
- **when:** 23:25–23:53
- **where:** the main thread
- **who:** clio main
- **his words:** «i mean the result you did not replied what the resulsts and findings on herdr review side» · «Actually you hidden this message. This is actually the info that I was interested in and if I didn't ask you for details, you wouldn't print that and keep that folded in the ticket»
- **shape:** a result folded away
- **fix:** a review he asked for prints whole the turn it lands, never folded into a ticket alone
- **home:** habit-dima-comms § A reply never restates what he settled
- **source:** FRM-630:W4; prompts 2026-11-13.md 23:26
