---
id: PK-457
title: 'speak v2 prep: the refresh-speak recipe groomed and run, readaloud knowledge'
status: done
assignee: []
created_date: '2026-11-19T14:41:00Z'
updated_date: '2026-11-20T14:52:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 74000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-457:W1 (2026-11-19 16:38, dima): we move to the speak app. to build it we prep data first: fresh data on the latest read-aloud app implementation best practices, the latest best read-aloud models, and a kokoro upgrade or update; then the fable 5.2 research and the fleet's models refresh; then the designer skill refresh.
PK-457:W2 (2026-11-19 16:38, dima): all are recipes or researches. after we research everything, we can start a lane. let's start from the read-aloud data refresh: knowledge, so we build a great read-aloud app.
PK-457:W3 (2026-11-19 16:38, dima): assist me with collecting data about speak app v2 so we build it in the best way. for every research, propose how to fold the findings in the best way.
PK-457:W4 (2026-11-19 16:38, dima): for each research round, print me the interesting details about its results.
PK-457:W5 (2026-11-19 16:38, dima): the read-aloud recipe ran only once, as i remember, and was never rerun; it was born before we wrote a spec for our recipe feature. let's revisit it, groom and sharpen it via shape-recipe.
PK-457:W6 (2026-11-19 16:38, dima): merge my newest wishes and research vectors about the read-aloud feature.
PK-457:W7 (2026-11-19 16:38, dima): propose your own ideas about what to search for in this recipe: what do we want to know to build the best possible read-aloud solution? wispr or superwhisper grade level? ❓
PK-457:W8 (2026-11-19 16:38, dima): read-aloud is my main door to the data on my screen: i read 95 % of the text on screen, on all surfaces, through read-aloud.
PK-457:W9 (2026-11-19 16:38, dima): search for best practices and guides on how to build a solid text-to-speech app; focus on macos, but in general it should work everywhere. maybe i can make something bigger out of this app.
PK-457:W10 (2026-11-19 16:38, dima): search for the newest read-aloud state of the art and the best free models, or not free but with a generous free tier, so i can use them the whole month.
PK-457:W11 (2026-11-19 16:38, dima): we can start from the current model, a locally run app only, but in the future i want it to work on remote hosts too. i don't know how; an electron app? so i can release this app, stick «buy me a coffee» on it and have some income from it ❓
PK-457:W12 (2026-11-19 16:38, dima): search for the newest approaches to run read-aloud efficiently: does our current launchd approach hold? ❓
PK-457:W13 (2026-11-19 16:38, dima): kokoro alternatives? maybe there are other cool read-aloud tools ❓
PK-457:W14 (2026-11-19 16:38, dima): i really like kokoro. it is incredibly good for a fully free read-aloud; it sounds not even comparable to the built-in machine read-aloud. siri is solid though (only one certain voice), kokoro is still better.
PK-457:W15 (2026-11-19 16:38, dima): was kokoro updated since we last looked? if yes, what's the news? you can also include it in the evergreen scope, and solve this part as a rider for plan item 2 ❓
PK-457:W16 (2026-11-19 16:38, dima): remind me how kokoro is actually running on my machine right now: explain briefly how it works, plainly and simply, no tech language ❓
PK-457:W17 (2026-11-19 16:38, dima): i have quite a list of voices in the speak webapp, and i favorited a few. how do i see them? are they part of kokoro's launchd? is this the full list? when kokoro is updated, do those voices become different or better, or do new ones appear? what do kokoro updates actually change? ❓
PK-457:W18 (2026-11-19 16:38, dima): during kokoro updates, ensure its voices survive, my favourites especially, and most importantly af_heart: i like this one the most; it sometimes sounds even better than elevenlabs and fish's voice (sarah).
PK-457:W19 (2026-11-19 16:38, dima): note: fish's sarah is also nice, i like it.
kept: 2026-11-19 — the main lane's current scope: the recipe groom and run, today; BYT-126, FRM-642 and FRM-288 own the build after it

PK-457:W20 (2026-11-19 16:54, dima): kokoro wish: make it easier to update. why can't we update it via brew, for example, or pnpm update? how is it actually installed? i want evergreen to be able to check for its updates, and an easy upgrade door.
PK-457:W21 (2026-11-19 16:54, dima): what better recipe name could we have, given my wishes, what we have in the speak app and what we plan for it? ❓
PK-457:W22 (2026-11-19 16:54, dima): q2: yes, but there is a catch: i don't have a huge amount of time for a long exploratory build, because i also want to resume my cv once we're done with the speak app, so i can resume my job search.
PK-457:W23 (2026-11-19 16:54, dima): q6: where does the researched knowledge land, especially the read-aloud app building best practices? for you (architecting) and for codies (implementation), so everyone uses the useful knowledge at all phases? ❓
moved: W11 → FRM-668:W5 (dima 16:54, phase 2)

PK-457:W24 (2026-11-19 17:02, dima): i thought our evergreen also refreshes python and uv. does it? or is kokoro installed locally in the speak app and not globally, and that's why evergreen misses it? ❓
PK-457:W25 (2026-11-19 17:02, dima): how, then, do we keep it properly updated in an easy way: checked at each evergreen, and updated if updates are present? ❓
PK-457:W26 (2026-11-19 17:02, dima): ok, let's keep refresh-speak for brevity. i actually like «refresh-readaloud»: it is a more precise and more versatile name. for now keep refresh-speak; change to readaloud if we grow this area into something bigger, later.

moved: W20 → FRM-669:W1, W18 → FRM-669:W2 (dima o10, 17:09)

17:37 refresh-speak run 1 done: playbook filled (67ead9ef), W5–W10, W12–W17, W19 met by the run and its 16:42 answers; W11 → FRM-668, W18/W20 → FRM-669; next: fable 5.2 (W1), then the designer refresh

PK-457:W27 (2026-11-19 18:06, dima): fable 5.2 was released about 10 days ago, so we can now run the refresh recipe to learn its data.
PK-457:W28 (2026-11-19 18:06, dima): we should know where and when fable 5.2 is good. it's 20 % cheaper than fable 5.1 medium, still expensive.
PK-457:W29 (2026-11-19 18:06, dima): all the same steps; the recipe should already include what to look at and where to fold. fable 5.1 retires with this.
PK-457:W30 (2026-11-19 18:06, dima): the data should be precise: the price, where and how it is best to summon fable 5.2, the best baseline effort setting, and when low or high matters.
PK-457:W31 (2026-11-19 18:06, dima): from what i saw, anything higher than high is wasted inference; the research may tell otherwise, so you tell me. ❓

PK-457:W32 (2026-11-19 18:12, dima): full crew research is redundant, but refresh the knowledge about every model we use: opus, sonnet and haiku. we use every one of them, so fresh knowledge about each is good to have.
PK-457:W33 (2026-11-19 18:12, dima): after we have the numbers, compare them to how our system uses each model today, operation by operation, and tell me whether we use each model for the right tasks, and at the right effort.
PK-457:W34 (2026-11-19 18:12, dima): if i had more usage to use fable 5.2 more proactively, i would use it in layers. the first layer: fable 5.2 on medium for clio and all wings; all codies and verifiers would still run on opus.
PK-457:W35 (2026-11-19 18:12, dima): i would leave crow on opus, to have an alternative model's opinion while clio runs on fable. optionally i'd consider the verifiers on fable too, for an alternative opinion. just thoughts, no actions here: i am telling what i like.

PK-457:W36 (2026-11-19 18:49, dima): i believe that despite fable 5.2 being cheaper than 5.1, it still gets more than 2× opus; in reality it feels even more expensive, about 2.5× at least. on monday i ran everyone on fable all day (all clios, crow, all codies, the verifiers) and spent the full 100 % of the fable share in one day.
PK-457:W37 (2026-11-19 18:49, dima): fable 5.2 is a capable coder, at times even better than opus, and that data folds into the model knowledge; but the fleet rule is an override: we do not use fable 5.2 for coding, because of the taxonomy and my plans. it is too expensive; given my inference volume, i would rather be economic and use opus 5.5 for all the tasks, to ship more.
PK-457:W38 (2026-11-19 18:49, dima): fable 5.2 for the designer still holds, although opus 5.5 draws very well too. it's a hard choice for me; let's go with fable 5.2.
PK-457:W39 (2026-11-19 18:49, dima): i'm confused by o5 and o8: print a clear, easy-to-read list of everything you propose to change: who, how it was, and how it will be.

PK-457:W40 (2026-11-19 19:01, dima): scout: no, medium is enough; it simply searches the filesystem, high is overkill. fresh-eyes: let's try high, we never tested medium vs high. the stray on sonnet high: okay, then the line between opus medium and sonnet high narrows; sonnet high can do more now.
PK-457:W41 (2026-11-19 19:01, dima): i still have two fable resets; for those resets my override that forbids coding with fable is lifted, by my word. i will remind you to summon everyone on fable 5.2 on monday; the roles most likely stay as on the previous run.
PK-457:W42 (2026-11-19 19:08, dima): set proper habits so you prefer sonnet 5.5 on high for the stray lane, because today main clio summoned the stray with opus 5.5 medium.
PK-457:W43 (2026-11-19 19:08, dima): the effort changes feel right; they could be made better, but they will use more of my inference. i want the numbers that confirm it is worth it: a precise measurement of how expensive it was for me and how much better everything was solved, ideally as weekly usage %. my plan is $200 now; after it ends i will most likely move to $100.
PK-457:W44 (2026-11-19 19:13, dima): let's measure for 7 days: a first round as a checkpoint where we see the numbers, then another 7 days, another read, then the verdict.

19:34 designer refresh, his 19:33 drop, folded:
PK-457:W45 (2026-11-19 19:33, dima): the designer refresh: the refresh-crew-designer recipe was made long ago, before we stabilized our recipe spec, and as far as i remember it ran only once. let's do it now; the designer is probably simpler, i don't have many new wishes about it.
PK-457:W46 (2026-11-19 19:33, dima): i just want to know how fable 5.2 is better at designing than fable 5.1 was, which effort is best for fable 5.2 as a designer, and how much better or worse fable 5.2 and opus 5.5 now are as designers.
PK-457:W47 (2026-11-19 19:33, dima): plus everything else the designer recipe describes. the recipe is old too, made before the recipe spec existed, so let's reshape it and groom it via /clio:shape-recipe.

19:42 designer recipe round 1 answers, his 19:41 drop, folded (q3 skipped = accepted):
PK-457:W48 (2026-11-19 19:41, dima): q1 yes, but i add another wish: better comms between me and the design phase. in the previous designer runs i had a lot of comms problems: a lot of context switching and back and forth, and we even built a design loop app to simplify my comms.
PK-457:W49 (2026-11-19 19:41, dima): research: unfold how bad my comms were in the previous design run, and propose how to search; how to query in the right way so it searches for the right thing; how to simplify the comms between the design phase and me, the operator; how to deliver the design flow to me as a smooth experience; how to translate my wishes to the designer properly.
PK-457:W50 (2026-11-19 19:41, dima): ❓ is design loop a correct solution for that or not?
PK-457:W51 (2026-11-19 19:41, dima): q2: we did a similar design arena last time; it was interesting, but i had a lot of comms issues, it was very effort-demanding from my side, i got tired very fast, and it took a whole day. i don't have a whole day for another arena run.
PK-457:W52 (2026-11-19 19:41, dima): to compare fable 5.2 and opus 5.5 for design, this time research only: search the internet for data on who designs better now, fable 5.2 or opus 5.5. keep the design arena idea for the future, not for this time.

20:04 kept: a0437f6 reshaped the designer recipe, one step of three; the item stays for its fable 5.2 and model-cards refresh and speak v2 (wing 1 f44)

20:21 wishkeeper siesta fold — his 20:07–20:11 herdr words and a W43 restore:
PK-457:W53 (2026-11-19 20:07, dima): let's probe design-loupe's replacement tomorrow, once you get summoned, via some cheap probe; not today, i'm tired.
PK-457:W54 (2026-11-19 20:08, dima, o11 steer): xhigh, no. high is most likely my pick for fable 5.2 as designer. i'm still in doubt, fable 5.2 high or opus 5.5 high; i think fable.
PK-457:W55 (2026-11-19 20:11, dima): inter is actually not a bad font, i think it's fine, but i'm also interested in other great fonts.
the 19:08 fold, restored: his raw text read «after it ends ~5 nov i most likely move to 100$ plan»; the date was dropped in the fold. inference: he means ~5 Dec (the $200 plan started ~5 Nov, habit-ctx-load-balancing); ask him at his next prompt.

20:58 o6: dima confirmed the plan move is ~5 Dec («yes, ~5 dec»); the effort-raise trial re-measures its rate then. o5: he kept the model-cards quote cut.

21:27 handed back at wing 1's halt: the three refreshes done (read-aloud, fable 5.2 and model cards, designer); left: the W-lines fold into FRM-288's re-sign at speak v2's shape-idea, the design-loupe probe and the W49 search/query tail (wing 1 flyway f46, f47).

16:20 close: verified on dima's 16:19 ask — wing 1 groomed and ran refresh-speak on 11-19 (42c673d9, 67ead9ef): W1 met (fresh data on practices, models and kokoro: unchanged upstream, af_heart safe, speak/docs/readaloud-playbook.md, 117 lines); W2 → the speak v2 lane, next on dima-fleet-priority; W3 met (the playbook is the fold); W4 printed by wing 1 at its run (inference, not re-read); W5 met (groomed 2026-11-19, the new recipe shape); W6 met (the recipe's want holds his wishes and vectors); W7 answered (the bar is wispr-grade on four axes, recipe line 57); W8 kept (recipe line 16)

close: PK-457:W1 done; PK-457:W2 moved to the speak v2 lane (dima-fleet-priority next); PK-457:W3 done; PK-457:W4 done (wing 1's run print, inference); PK-457:W5 done; PK-457:W6 done; PK-457:W7 done (answered: wispr-grade bar); PK-457:W8 done (kept in the recipe)

16:20 reopened: the close above covered W1–W8 only; the item holds W1–W55, each verified before any close

close: PK-457:W1 done; PK-457:W2 moved; PK-457:W3 done; PK-457:W4 done; PK-457:W5 done; PK-457:W6 done; PK-457:W7 answered; PK-457:W8 done; PK-457:W9 done; PK-457:W10 done; PK-457:W11 moved; PK-457:W12 answered; PK-457:W13 answered; PK-457:W14 done; PK-457:W15 answered; PK-457:W16 answered; PK-457:W17 answered; PK-457:W18 moved; PK-457:W19 done; PK-457:W20 moved; PK-457:W21 answered; PK-457:W22 done; PK-457:W23 answered; PK-457:W24 answered; PK-457:W25 answered; PK-457:W26 done; PK-457:W27 done; PK-457:W28 done; PK-457:W29 done; PK-457:W30 done; PK-457:W31 answered; PK-457:W32 done; PK-457:W33 done; PK-457:W34 done; PK-457:W35 done; PK-457:W36 done; PK-457:W37 done; PK-457:W38 done; PK-457:W39 done; PK-457:W40 done; PK-457:W41 moved; PK-457:W42 done; PK-457:W43 moved; PK-457:W44 moved; PK-457:W45 done; PK-457:W46 done; PK-457:W47 done; PK-457:W48 done; PK-457:W49 moved; PK-457:W50 answered; PK-457:W51 done; PK-457:W52 done; PK-457:W53 moved; PK-457:W54 done; PK-457:W55 done (verified line by line, /private/tmp/claude-501/-Users-dima-frame--clio/02e545e1-5d45-4b79-9c41-4a9066cbb71a/scratchpad/pk457-verify.md summary: 34 done, 12 answered, 9 moved: W49 tail and W53 live as wing 1 flyway f47, f46)

16:52 homes of the close (wishkeeper 16:50): PK-457:W2 → the speak v2 lane: FRM-288; PK-457:W7 → recipe.md:57 the bar is wispr-grade on four axes;  his own ideas are vectors 5-11; PK-457:W11 → FRM-668:W5; PK-457:W12 → playbook:91 «a launchd daemon plus a warm local server holds for one user», next step in-process CoreML :92; PK-457:W13 → playbook:47-56; PK-457:W15 → playbook:37-43; PK-457:W16 → wing 1's chat print 11-19 16:43 «How kokoro runs on your mac, plainly»;  chat only, no file holds the plain ; PK-457:W17 → same 16:43 print: 54 voices on disk, speak page shows 15, favourites live in speak's own settings, what an ; PK-457:W18 → FRM-669:W2; PK-457:W20 → FRM-669:W1; PK-457:W21 → grill 2 Q8 settled by W26;  recipe.md:37 «the name stays refresh-speak»; PK-457:W23 → grill 2 Q7 yes; PK-457:W24 → wing 1 chat 17:03: global uv tool, evergreen's `uv tool upgrade --all` moved it;  evergreen/SKILL.md:19, pla; PK-457:W25 → evergreen prints kokoro each run; PK-457:W31 → model-cards.md:34; PK-457:W41 → _clio/memory/_reminders.md:84; PK-457:W43 → docs/test-drive/effort-raise.md; PK-457:W44 → effort-raise.md:30-31 round 1 read 2026-11-26, round 2 and the verdict 2026-12-03; PK-457:W49 → recipe vector 2; PK-457:W50 → wing 1 chat 17:57: loupe is a retire candidate; PK-457:W53 → pk-346 #3 f46 «design-loupe probe: a cheap summon»;  not run yet
<!-- SECTION:NOTES:END -->
