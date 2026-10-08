The rules memories say *what to do*. This one says *what happened*, so the rules keep their reasons.
Append short entries; never rewrite an old one into a rule — link to the rule instead.
Date every new entry in its heading (`· yyyy-mm-dd`); entries without a date predate 2026-08-24.
Cap ~12: at the cap, cclio drops the oldest story itself, no ask (Dima, 2026-09-12).

## why he wants the stories kept
His reason, in his words: «because of even moments like now — realizing that i do wrong thing but
my lazy tech inside only realized imprecise move.» He often *feels* a move is off before he can
name why. The stories are how the felt sense gets recovered later as a reason. So when he makes an
imprecise call and catches it himself, that is worth an entry — the catch is the signal, not the
mistake. Do not write these as corrections; write them as what happened.

## «the question we covered in a grill makes the design totally different» · 2026-09-30
speak was built on a random ask the day before and never shaped. the re-shape grill took four
questions: why (he hears 90 % of his text, F4 is his most-used hotkey), what the product is (the pill and
the admin, both daily), the friction (a forgotten selection turns pause into «read this instead»), what
goes (nothing — the providers are his playground). each answer moved the design: ⇧F4 pause came out of
one question, the pill's volume and speed popovers out of another, word highlight turned from a nice-to-have
into «I follow the text while it reads». his note after it: «a grilling session before design has incredible
value … if we would not grill but just start a design randomly» — the day shape-idea became an invariant. → `x:shape-idea`, `fleet-identity`

## «why not here?» · 2026-09-30
the atelier lens ring was built from the comp and clean in the verifier's eyes. on his wide screen the art sat
letterboxed, and he circled the empty dark band above it: «why not here?». two rounds moved the pills toward the band,
and each still felt off to him; then he named it — sticking them to the art's edge «reads off … they break out of a
horizontal rhythm compared to other pills». the comp had drawn only one window shape, where the art fills the screen,
so nobody had designed the letterbox case; his eye was the spec. → «The One Frame Rule» in atelier's `DESIGN.md`, the
window-shapes question in `crew-designer-interview`

## «why? not good» · 2026-10-01
he sneaked back to the keyboard after sleep, and speak's admin said the daemon was unreachable; F4, his most-used
hotkey, had read nothing since the mac woke. I probed the socket twice, both answered in ~10 ms, and I wrote «not
reproduced». his reply: «why? not good. my most used feature is flawed». no theory, only the sense that a probe of
the present could not clear a failure of the past. the daemon's own log held it one awk away: the F4 at 01:51 hung
6.5 minutes, then twelve queued presses flushed in the same millisecond — a blocked main thread, which also starved
the control socket. his felt sense read the claim's timeframe before I did. → `method-report-verify`, the speak wake gremlin

## «today was chaotic for me» · 2026-10-01
three designers drew speak at full fidelity, 25 boards each, and he reviewed all of it by hopping across canvases, hunting the spots my messages named while the boards carried three naming schemes. late in the evening he named the feeling first, «designing is a bit chaotic … because of this rough back-and-forth with scattered places», and only then the cause: «initially we planned a design flow like this, split into four phases … that phase idea got buried somewhere». the first spread had asked layout, colour, copy and states in one go, so every comment was a polish comment on everything; and the canvas lets only a human open a thread, so every question came back to him as words to search for. his felt sense read the process before the cost did ($63 on one fable session). → `x:crew-designer` four phases, ballot ([FRM-293](https://linear.app/x-com/issue/FRM-293)), `docs/research/design-review-comms.md`

## «why you were waiting for already completed and green pr?» · 2026-10-02
he had said «merge once ready», and bytes #120 sat in his browser with «All checks have passed» and a live squash button while I told him the merge waited on the ci review. my pr watch printed «green, ready to merge» once per head, and it had fired on the final head before the required `review:clean` check even existed; when the review went green on the same head, the watch stayed silent. he sent a screenshot, «looks clean to me», then asked why I was waiting at all. his eye on the page read the state my watch had stopped reading. → `pr-watch.sh` keys on github's merge state `CLEAN`, and a green-but-blocked head prints once

## «why does biome so often prevent you from committing?» · 2026-10-04
the row commit had just been refused by the biome format check, the second stumble of the night, and he asked why it keeps happening and whether a format-on-edit hook would solve it. the hook already existed: `biome-format.sh` runs after every `Edit`/`Write`. the miss was mine: bypass mode had me writing files through Bash heredocs and python replaces, which no tool hook sees — 19 biome lines across 11 flawlog files. the commit hook could not take the fix, it is banned from writing because it once lost a file; so the format moved into the commit door, `x lane commit`, on the named paths only. his felt sense counted the stumbles before any log did. → `x lane commit` 0.11.206, `x:cmt`

## «your cache will most likely be cold» · 2026-10-04
mid-session he pictured the end of a shift: he comes back to the keyboard, asks a few simple questions, and the first one re-reads a 600k thread at the 1h cache-write price. nobody had priced the return. the numbers agreed with him — a cold first ask costs about forty warm reads — and the answer split in two: a shift now ends with a report artifact and a CST so his questions go to a fresh cclio, and a keep-hot switch pings an idle session when a window runs dry before its reset. his sense of the cost arrived before any measurement of it. → `cclio:shift` 0.3.94, stash keep-hot (FRM-302)

## «then it looks useful! why park it?» · 2026-10-05
`mods:live` sat parked behind the third-need rule: a pty harness for reload and hover checks, two needs counted, build on the third. he read my one-line description and answered with his own frame: «from my understanding, this `mods:live` command is similar to a dev server for web applications». the rule had counted it as a rare check, needed when a hover bug hit; his analogy showed a dev loop every mods coder runs all day, the way vite runs for a web app. it was built that night and worked on the first probe. his felt sense saw the category before my counter did. → FRM-322, `pnpm mods:live`

## «the second run actually showed what I wanted» · 2026-10-06
he asked the cli a/b/c to answer one thing: does go + bubbletea look better than TS? the first round built the whole cli three times, every verb in every stack, for about two and a half hours, and the arms came out looking nearly the same. I read their numbers and picked TS. he then asked for «cheapest effort, but widest UI representation» — one throwaway showcase screen per arm — and it took half an hour. the go screen was a level above, and the pick flipped. his note after it: «the initial build didn't answer a question that I asked … we could make a wrong choice by going with TypeScript». his felt sense knew what the comparison was for before the brief did. → the flawlog line on comparison briefs, `x:shape-idea`

## «is this shape efficient? 16 small 7-liner files?» · 2026-10-07
past 3 a.m. we grilled the pocket, flowlog's successor, and he approved Q1 as written: one ordered file, a folder only when an item grows into a spec. then «go build», and I built 16 one-item files, because matt's local tracker keeps one file per ticket and I had just read it. he looked at the tree mid-build and asked one question. nothing was broken yet; each item cost a read, the boot would have paid sixteen, and the verdict he gave ten minutes earlier said one file. the merge took one script. his eye read the shape against his own answer before any cost showed. → the 10-07 self-grill (re-read the settled answers before the first file), `cclio/pocket.md`

## «are you sure it researches what i want from you as coordinator?» · 2026-10-07
he was grooming `refresh-craft-spawning`, the recipe that keeps my spawning true, and had just written a new want into it by hand: own the whole spawn lifecycle, pick the door deliberately, collect the retro. I had already launched its research lanes. he stopped and asked whether the recipe researched what he wanted from me as coordinator, then answered himself: our coordination is home-baked, the crew may lack roles, roles drift as models improve. the recipe researched doors and models — my tools, never my job. it became `refresh-crew-coordinator`, one run with a tools half and a craft half. his felt sense read the gap between the recipe's name and its want before any vector was checked. → `recipes/refresh-crew-coordinator/`, step 0 of `x:shape-recipe`


## «you are either rushing, or choosing the wrong shape» · 2026-10-09
past midnight he asked me to grill the next cli chunks, and I packed seven decisions into the ⏳ block as one wall of numbered lines, each with my pick. he sent a screenshot with a red box around it: «what is this? … is that a grill?» then, before I had fixed it: «why do not use grill shape from a skill?» matt's grilling skill was in the list the whole time, and its round shape (one question, its context, a pick) exists so he can steer each line. he added the shape he wanted from then on: a title naming the ticket or lane, the rounds, a pre-filled answer fence he only steers. an hour later he named the next gap himself: «a grill assumes exit lines too», so a chunk is sealed, not grilled. his eye read the shape before the cost showed. → `habit-grill-shape`, «rushing, or the wrong shape»
