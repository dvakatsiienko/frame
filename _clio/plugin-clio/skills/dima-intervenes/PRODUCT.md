# clio:dima-intervenes (was cclio:catch-up) — PRODUCT

## the want

dima, 2026-10-15 (inbox, folded):

> i often ask you to «remind me how this or that works». that deserves its own skill with a recognizable name, and its output format parked in the skill itself.
>
> why i ask: our system grows and changes fast, i have no capacity to keep up with everything, and i'm curious — i want to know how it works so i can steer its optimization properly.
>
> be interested in helping me learn and explore those areas; help me catch up with where we are. no whole manual, no tech details until i ask to go deeper. answer what i asked about, then add a slightly wider outline of the area, and be collaborative: shape the answer as an invitation, so my follow-up can easily go wider or deeper into what i forgot.
>
> the format: light emojis, dense ones where they fit (like the emoji-battle skill); clean, easy to read. optionally pipe it through matt's teach skill, but the output format is custom, set by this skill.

dima, 2026-10-15 (the want, sharpened):

> out of this skill, i want you to guide me through our system and help me recall it, explore it and learn it. as the operator i steer you and the fleet to make it better, and that is harder when i don't understand how our system works. you assist me with exploring, learning and catching up on what's happening everywhere. the skill is open for you to use on your own.
>
> the triggers, roughly: «…btw remind me how our this and that works?…», «…what's happening in our x and y parts of the fleet…», «…remind me how your pm module works…», «…remind me how our recipes system is set up now…».

- naming (dima, 2026-10-15): «remind» stays for setting reminders (`x:remind`); this skill was `cclio:catch-up`, renamed `clio:dima-intervenes` 2026-10-21 on dima's pick; clio's own: coordinator-only, never an `x:*` skill (dima, 2026-10-15).

## decided (the grill, 2026-10-15, all six picks ticked)

- **source** — a light live read every time: the area's home file plus its commits since the stamp (critic fold below); never from memory alone
- **🆕 what changed** — one line per answer: what moved in that area since his last catch-up there (a per-area «last asked» date), else the last 14 days; from git and the gazette
- **on my own** (dima: «invoke the skill yourself when you think i'm off in my understanding of how a given area works, and propose to assist») — when his question or steer shows an outdated picture, a one-line offer naming the area; never an unasked lesson
- **routes** (dima: «you propose a few include / go-deeper routes, and i accept or reject») — every answer ends on 2–3 routes: wider, deeper, what changed; they live in orbit (round 2, Q7)
- **big areas** — a small ascii map when the area is a flow; an artifact is overkill, made only on his ask
- **trigger** — no bare «X» placeholder in the description (dima: it reads as the `x` cli); areas are named as «this or that part»

## prior art

- `x:walkthrough` — a guided tour where he runs one command per stop; heavier, hands-on. catch-up is an answer plus a map; a route can hand off to a walkthrough when he wants to see it on his machine. its trigger owns «walk me through», so catch-up's description leaves that phrase out
- `anthropic-skills:learn` (installed; matt's `teach` sits in the marketplace cache, mattpocock-skills 1.3.1, not in this session's listing) — socratic, it holds back the answer so the learner finds it. the opposite of the want: catch-up answers first. borrowed: name the one misconception when his picture is off. its triggers («explain», «how does … work») overlap, so catch-up's description says «our system» and «the fleet» to win for our own parts
- no outside tool or lib: this is one skill file and a small stamps file — build

## the plan critic (crow, opus, 5 findings — folded)

- 🆕 reads `git log --since=<the area's stamp>`, no stamp → 14 days; never a fixed 7 days beside a stamp (finding 1)
- no hand-kept area → path table: the area resolves live through the homes the fleet already keeps (`AGENTS.md` maps, skill names, `rg`), and every path is `test -e`'d before the log reads it — a dead path prints nothing and exits 0 (finding 2)
- the answer names the file it came from, and when the area's code is newer than its home doc, says so: «docs lag the code by N days» (finding 5, invariant 4)
- self-use fires on a concrete tell — his words contradict what the area's file says now — at most once per area per session (finding 4)
- open: the reply budget and where the routes live (finding 3) — asked in the grill's round 2
- **routes** live in orbit: each one an ask he ticks to go there, or leaves to drop (grill round 2, Q7)
- **size**: up to ~1,500 chars, longer only on «go deeper» — a trial; dima leans to a more compact shape and judges on the first run (Q8)

## the cut — polish tier: an internal tool, «works and clear»

in:
- one skill, `plugin-clio/skills/catch-up/SKILL.md`: the description (the trigger), the gather, the answer shape, the routes, the self-use tell
- a stamps file outside git, `~/.local/state/clio/catch-up.json` — `{ "<area>": "<last asked, iso date>" }`
- the answer: the asked thing in plain words · a wider outline (3–5 neighbours, one line each) · one 🆕 line · an ascii map only for a flow · the source file named, a lag label when code outran the doc · 2–3 routes as orbit asks

out:
- an `x:*` copy for other sessions
- a hand-kept area → path table
- quizzes or socratic holding-back (that's `anthropic-skills:learn`)
- artifacts, unless he asks
- a scheduled «what changed this week» digest — the gazette already is one
- tech details before he asks to go deeper

## the done test

- given dima asks «remind me how our recipes system works now», when clio answers, then the reply answers it in plain words first, names `recipes/AGENTS.md` as its source, carries one 🆕 line from that area's commits since its stamp (or 14 days), stays under ~1,500 chars, and orbit holds 2–3 route asks
- given the area is a flow (the fleet flow, the handoff), when clio answers, then the reply carries an ascii map of ≤8 lines
- given an area whose code is newer than its home doc, when clio answers, then the reply says «docs lag the code by N days»
- given an area path that no longer exists, when clio gathers, then the answer names the dead path, never a quiet «nothing new»
- given dima steers with a stale picture of an area (his words contradict its file), when clio replies, then one line offers a catch-up on that area, and never twice per area per session
- given «remind me to …» (a reminder), when clio reads it, then `x:remind` loads, never catch-up
- given a catch-up ran, then the area's stamp in `~/.local/state/clio/catch-up.json` is today

- **teach** (dima, 2026-10-15: «optionally pipe through matt's teach skill») — offered as a route only when an area deserves real study; teach is a multi-session course of html lessons, too heavy as a default

## 2026-10-21 — the reshape into dima-intervenes (fix mode)

### the want v2 — one point per line (dima, 2026-10-18 inbox W4 + 2026-10-21, folded)

- W1 i spot something off in an area of our system (any part) and want us to hunt it; suspected, unfounded issues hurt the system
- W2 i may have forgotten or lost the grasp of an area; i'm capable but overloaded, and my brain needs to rest
- W3 my understanding shapes my prompts, and prompts shape your output; an operator has to understand the flows firsthand
- W4 be willing and participative: help me understand, cover what i forgot, smoothly introduce me to unexplored areas like the mods source or the x cli source
- W5 you gain too: better prompts, and you function better; i'm also just curious
- W6 it does what catch-up does now, plus an action: intervention, where i go with you and we fix
- W7 optionally merged into catch-up; the name revisited
- W8 example: the pm module drifted; the sweep fixed the clutter, not the clarity of shape and flow contracts — outline it, top-level highlights first, then more parts, a few turns, not too many
- W9 flow: i ask around and tell concerns; you zoom in gradually; i ask more, we explore layers; identify issues and inefficiencies; plan a fix; fix
- W10 gradual zooming-in: spot an area, zoom minimally, zoom more only if needed
- W11 why not just «fix it»: fine for simple things, not always; you're the tornado tactic, i'm the strategist; the skill unfolds an area for my vision and review
- W12 the system changes too fast for me to hold every part; a good fix needs the area understood first
- W13 your role: pair program with me in assistive mode
- W14 the pm example to fix: review all pm flows from a to b, lane closing included; evaluate the flow; find weak parts and gaps; apply shortcuts, cut redundancies (lives in PK-103)
- W15 the system grows faster than i catch up, so i keep losing understanding — not good for an operator
- W16 the fix part is an advanced mode: for when i lost track of a part, or a part truly goes off the rails and needs interference and fixing
- W17 there you're my pair programmer: i review, think how things should work and suggest fixes; you take the technical part and help me figure things out
- W18 no tech overload: explain how things work in human-approachable language

### decided (grill rounds 1–2, 2026-10-21)

- one skill: the recall, a light tour and a fix mode (W6, W7); name `clio:dima-intervenes`, dima's pick
- fix mode starts on his concern words — «feels off», «drifted», «something's wrong with»; a plain «how does … work» stays a recall (W1, W16)
- tours of unexplored areas are light, an MVP to try (W4)
- pace: one layer per turn, at most 4 highlights a layer, the issue list by turn 4 (W8–W10)
- roles: he drives the what and picks the fixes, and may steer tech choices; clio does the essential tech herself, never overloads him, leaves him the option (W11, W13, W17)
- plain words; tech in a linked file, shown on «show me the tech» (W18)
- after the issue list: one grill round on the fixes, then fix in place first; a ticket only when too big for now's time or capacity (W9, W16)
- first run: the pm module, PK-103 (W8, W14)
- settled by the wish itself: W2, W3, W5, W12, W15

### prior art borrowed (`prior-art.md`)

- fix mode opens with «what were you seeing?» and plays his account back before digging (Allspaw)
- he names his own guess in one line before the issue list, or skips; the list puts his guess beside clio's findings (Buçinca: cognitive forcing cuts over-reliance)
- the issue list in postmortem form: the fact · a one-click file:line link · the effect in plain words · one proposed fix
- at most 4 highlights a layer; the current layer plus one named next step, never the whole tree (Cowan, NN/g)
- avoid: over-explaining an expert; fixing anything outside the decision round; «approve all?» rounds that invite a rubber stamp

### the cut — polish tier: an internal tool, «works and clear»

in: `SKILL.md` gains a fix-mode section (open, layers, his guess, the issue list, the decision round, the fix, the close) and a light-tour line; the description adds the concern triggers
out: a second skill; a ticket by default; a design critique; tours as a course (teach stays a route); tech in the chat unasked

### the done test

- given «something feels off with the pm module», when clio replies, then turn 1 asks what he was seeing and shows at most 4 top-level highlights in plain words, no code
- given a zoom turn, then it shows at most 4 highlights and names one next step, and the issue list lands by turn 4 at the latest
- given the issue list, then his guess was asked first, and each issue carries a file:line link, the effect in plain words and one fix
- given the decision round, then only the fixes he picked are applied, in place; one too big becomes a ticket on his word
- given «how does … work» with no concern word, then it stays a recall
- given «show me the tech», then the linked file's detail comes into the chat

### the plan critic (crow, opus, revise, 5 findings — folded 2026-10-21)

- the rename reaches every live layer; v1 above is marked as history (finding 1)
- fix ownership: clio's own files and our tooling land in place; an app, a flow contract or anything bigger than a tweak goes its lane, shaped first (finding 2)
- the stamps key is the area's home file path, never his wording (finding 3)
- a concern word anywhere wins over a recall ask; an unreadable case gets one «recall, or fix?» line (finding 4)
- the run state lives in `runs/<area>.md`, written every turn; turn 4 is a target, not a forced list (finding 5)
