---
id: PK-447
title: 'emoji reactions: his 11-18 design asks before FRM-582''s grill'
status: done
assignee: []
created_date: '2026-11-18T09:19:00Z'
updated_date: '2026-11-18T21:29:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 2100
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-447:W1 (2026-11-18 inbox, dima): emojis are not grilled enough yet; i believe each emoji should tell you its intent

PK-447:W2 (2026-11-18 inbox, dima): proposed top 7 emojis (i am not sure on these): 🏎️🚄🛤️ as "go" from me, meaning "dima reads and approves your plan as sound, please move on"

PK-447:W3 (2026-11-18 inbox, dima): 🐢 means "hey from dima, i am overloaded by your message pace: slow down, park and wait for me, then help me gracefully solve the pile of half solved parallel stuff you started without me; i type slowly, sometimes replying to a message of yours 30 to 40 min later; if you keep running from me, i force quit"

PK-447:W4 (2026-11-18 inbox, dima): 🎉🥳🎊🪅🪩: start with these to react to my messages, when i bring good news or am happy about the fleet getting prettier

PK-447:W5 (2026-11-18 inbox, dima): 👀: instead of restarting an agreed plan, confirms you understood and are moving with it; you can print one line ("... on it .... moving ... etc you are free to pick") or just react to my message, e.g. one that joined not pushed

PK-447:W6 (2026-11-18 inbox, dima): 🤔🧐: react to messages you are concerned about, unsure of, or do not trust fully; applies to your own messages too

PK-447:W7 (2026-11-18 inbox, dima): render only the emojis we agreed on; everything else shows when expanded, since sheparder ships a whole bunch enabled at once

PK-447:W8 (2026-11-18 inbox, dima): emojis are searchable; emoji search expands the emoji list

PK-447:W9 (2026-11-18 inbox, dima): each time the grid opens its state starts from scratch: keep track of the most used emojis and put them first, from most tapped to least tapped; propose how to measure and log that properly

PK-447:W10 (2026-11-18 inbox, dima): question: how does an emoji reach you? does what we put in emoji strings become part of your message history sent to you whole on each turn, in the special field where slipstreamed joined messages get folded into, shaped like this: ❓

PK-447:W11 (2026-11-18 inbox, dima): how to optimize emoji descriptions: how to describe them so they are clear for you, so you know how and when to use them, without taking too much space

PK-447:W12 (2026-11-18 inbox, dima): can emoji text descriptions have settings, similar to SW and orbit? if yes, add it to the ticket spec ❓

PK-447:W13 (2026-11-18 inbox, dima): overall the emoji feature is always tricky: how to make it functionally and architecturally solid, robust and high performant? he wants a solid build right away

PK-447:W14 (2026-11-18 inbox, dima): idea: a cc loud chat (claude desktop app) has this feature built in; it auto-reacts to his messages and sees how he reacts to bubbles with emojis; ask for a query (prompt) he can copy-paste that tells cloud chat what we are about to code and asks it to describe the feature from the inside, to learn its best parts and borrow them

PK-447:W15 (2026-11-18 inbox, dima): is it worth researching prior art? research on how to implement such a feature (best practices) may bring insights; if agreed, do it right before we dispatch the emoji feature; he wants to research with us, see the insights himself, and decide what we borrow and what we do not ❓

raw drop (11-18 inbox, dima): emojis (not grilled enough)

raw drop (11-18 inbox, dima): - i believe emojis should tell you their intent

raw drop (11-18 inbox, dima): - 🏎️🚄🛤️ (propose top7 emoji i am not sure on these) like emoji "go" (from me) - " dima reads and approves your plan as sound. please move on. "

raw drop (11-18 inbox, dima): - 🐢- «hey from dima! i am trying to read your message somewehere higher in the thread, and since then you sent too many follow-up messages down the thread, so im overloaded, and cannot keep up with your pace. slow down, park and wait for me. and now, help me gracefully solve a pile of parallel half solved stuff you started without me. i type slowly. sometimes i type reply to a certain message (your), for about a 30 min or even 40. if you will keep running from me, i force quit».

raw drop (11-18 inbox, dima): - 🎉🥳🎊🪅🪩 – you can start with these, to react to my messages, when i bring good news your or you are happy about my progress of making fleet prettier.

raw drop (11-18 inbox, dima): - 👀- instead of restarting agreed plan, to confirm that you understood and moving with this emoji in my message. you can print one line "... on it .... moving ... etc you are free to pick".  you can also just react to my messages. if for example a message joined not pushed (from me to you).

raw drop (11-18 inbox, dima): - 🤔🧐: you can react to messages that you are concerned about/unsure/don't trust fully.

raw drop (11-18 inbox, dima): 	- applies to your own messages too.

raw drop (11-18 inbox, dima): - idea: since sheparder borrow ships whole bunch of emojis enabled at once - instead, render only ones we agreed on, everything else shows if expanded.

raw drop (11-18 inbox, dima): 	- emojis searchable pls

raw drop (11-18 inbox, dima): 	- emoji search expands emoji list

raw drop (11-18 inbox, dima): 	- each time emoji grid popup opens, its state is from scratch. keep track of most used emojis. put them at start. from left to right - most tapped emojis > least tapped. propose how to measure/log properly.

raw drop (11-18 inbox, dima): - question: how emoji reaches you? will what we put in emoji strings become part of you message history that is sent to you (whole) on each turn? you see it in that special field where, slipstreamed joied messages gets folded into? like that json shape:

raw drop (11-18 inbox, dima): 	- user message:....

raw drop (11-18 inbox, dima): 	- agent message:...

raw drop (11-18 inbox, dima): 	- our-special-mods-slipstream-field: ... second wind, orbit, emojies ? ← here?

raw drop (11-18 inbox, dima): - open questions:

raw drop (11-18 inbox, dima): 	- how to optimize emojie descriptions? how to describe them in a best way, so they are clear for you, so you know how and when to use them? and so they do not take too much space?

raw drop (11-18 inbox, dima): 	- can i have settings for each emoji text description, similar ot SW and orbit? if yes - add to ticket spec.

raw drop (11-18 inbox, dima): 	- overall, emoji feature is always tricky. how to make it functionally and architecturally solid? and roubst, high performant? i want a solid build right away.

raw drop (11-18 inbox, dima): 	- idea: cc loud chat (claude desktop app) have this feature builtin into the app - it auto-reacts to my messages and can see how i react to message bubbles with emojies. how do you think - can you create a query (prompt) for it, so i copypaste. it sould fully tell cloud chat what we are about to code with this emoji feature, and ask cloud thread to fully describe how he sees this feature from inside? to learn best parts of emojies system, and borrow to our emojies.

raw drop (11-18 inbox, dima): 	- is it worth to research for prior art? maybe research about how to implement such feature (best practices) can bring some interesting and useful insights to fulfill my wish fully? note: if you agree, the research is best to do right before we are abot implement (dispatch) emojies feature. required: research with me, i want to know research insights myself, and decide what we borrow/apply to our system and what's not.

PK-447:W16 (2026-11-18 inbox, dima): propose the top 7 emojis; he is not sure on 🏎️🚄🛤️ as «go», meaning «dima reads and approves your plan as sound, please move on» ❓ (W2 refolded)

PK-447:W17 (2026-11-18 inbox, dima): 🎉🥳🎊🪅🪩: start with these to react to his messages when he brings good news, or when you are happy about his progress making the fleet prettier (W4 refolded)

PK-447:W18 (2026-11-18 inbox, dima): how does an emoji reach you? will what we put in emoji strings become part of your message history sent whole each turn, in the special field where slipstreamed joined messages fold in, shaped: user message …, agent message …, our-special-mods-slipstream-field: second wind, orbit, emojis? ← here? ❓ (W10 refolded)

PK-447:W19 (2026-11-18 inbox, dima): emojis searchable, please; search expands the list; the grid keeps most-tapped first — propose how to measure and log it ❓ (W9, W11 refolded)

PK-447:W20 (2026-11-18 11:40, dima): 🐢 is debatable as an emoji; instead, or both: a nudge button that tells the selected herdr thread «you rush, slow down», and the emoji pointing at the message where i lag, so you see how far you ran from me: wait until i finish replying, read what you answered after it, then help me catch up gradually

PK-447:W21 (2026-11-18 inbox, dima): proposed top 7 emojis (i am not sure on these): 🏎️🚄🛤️ as "go" from me, meaning "dima reads and approves your plan as sound, please move on" ❓
PK-447:W22 (2026-11-18 inbox, dima): 🎉🥳🎊🪅🪩: start with these to react to my messages, when i bring good news or am happy about the fleet getting prettier
PK-447:W23 (2026-11-18 inbox, dima): question: how does an emoji reach you? does what we put in emoji strings become part of your message history sent to you whole on each turn, in the special field where slipstreamed joined messages get folded into, shaped like this: ❓
PK-447:W24 (2026-11-18 inbox, dima): each time the grid opens its state starts from scratch: keep track of the most used emojis and put them first, from most tapped to least tapped; propose how to measure and log that properly ❓
PK-447:W26 (2026-11-18 inbox, dima): user message: ...
PK-447:W27 (2026-11-18 inbox, dima): agent message: ...
PK-447:W28 (2026-11-18 inbox, dima): our-special-mods-slipstream-field: second wind, orbit, emojis? ← here? ❓
PK-447:W25 (2026-11-18 11:42, dima): 🐢 — my idea from inbox. it is debatable if it should be an emoji. instead - it can by a nudge button that tells currently selected thread in herdr that you rush too fast and have to slow down. OR - both places a nudge button and a emoji. nudge button just tells you that you are rusing. the emoji points to certain message - and you see how far i lag behind - see how much you run away from me. this means that you should wait for me until i finish replying and see what else you answered after that. then help me to keep up with everything gradually.

retires PK-447:W2, refolded into PK-447:W21 (the original stays above as written)
retires PK-447:W4, refolded into PK-447:W22 (the original stays above as written)
retires PK-447:W9, refolded into PK-447:W24 (the original stays above as written)
retires PK-447:W10, refolded into PK-447:W23 (the original stays above as written)
retires PK-447:W16, superseded by PK-447:W21
retires PK-447:W17, superseded by PK-447:W22
retires PK-447:W18, superseded by PK-447:W23
retires PK-447:W19: searchable is PK-447:W8, the grid is PK-447:W24; PK-447:W11 stays its own line above
retires PK-447:W20, superseded by PK-447:W25

23:29 ticket: FRM-582 — every PK-447 W-line lives in FRM-582's wish block (19 lines); its grill is open, FRM-582 held unsigned for it
close: moved to FRM-582, one home (dima 23:29: «pocket item closes into linear ticket?»)

close: PK-447:W1, PK-447:W2, PK-447:W3, PK-447:W4, PK-447:W5, PK-447:W6, PK-447:W7, PK-447:W8, PK-447:W9, PK-447:W10, PK-447:W11, PK-447:W12, PK-447:W13, PK-447:W14, PK-447:W15, PK-447:W16, PK-447:W17, PK-447:W18, PK-447:W19, PK-447:W20, PK-447:W21, PK-447:W22, PK-447:W23, PK-447:W24, PK-447:W25, PK-447:W26, PK-447:W27, PK-447:W28,  moved to FRM-582 (its wish block carries each, 19 lines); its ❓ lines wait for FRM-582's grill
<!-- SECTION:NOTES:END -->
