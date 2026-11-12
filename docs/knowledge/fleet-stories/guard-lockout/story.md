---
status: open
dates: 2026-10-05 → 2026-11-12
tickets: [FRM-321, FRM-427, FRM-524, FRM-544, FRM-574, FRM-581, FRM-566, FRM-580, FRM-519]
tags: [guard, permissions, x-mod-guard, override, lockout, wrong-call]
fed-by: incidents
---

# the guard that locked us out — 2026-10-05 → 11-12

## the story, short

- clio grew x-mod-guard to stop risky shell commands. dima never asked for most of it: «I think that Guarding is not a bad idea but you overextend and lock yourself out» (11-12 15:47)
- each fix added a rule to protect an earlier rule: 83 guard commits in 4 days, 68 refusal rules, ~10.2k lines, 58 test files
- his word (a tick, a typed «sign», the override) came in 9 ways, landed in 9 stores across 3 tools, and was judged in 12 places, each holding half of one fact: «did dima say yes, and was it used?»
- it broke what he did most: a sign took two ticks (FRM-580) or a raw API bypass (FRM-566); a failed write used up his word because `; echo` made the line exit 0; even orbit refused an ask whose pick said «merge»
- two clio threads, main on the mods lane and wing 1 on the cli lane, each added guard pieces on their own side; nobody owned the whole

## the numbers (4 days, 23,073 shell calls, `~/frame/.scratch/ledger-spike/split.md`)

- 620 real refusals: 80 destroyed-work acts (the floor), 244 noise (`| grep`, a `$` in quotes), 56 false fires on a new file, 98 forgery or content checks (mostly a text match on a read), 142 his word not reaching its door
- of those 142, only 29 had a live word behind them; the other 113 needed the ask itself to reach him
- prior art: no agent harness carries an approval across sessions; cc's own docs call command-text matching «not a security boundary»

## the whole arc, 38 days (facts and sources: `~/frame/_clio/.scratch/guard/history-facts.md`)

- **10-05, born.** dima asked for ideas in general: «if there are more useful mod options - suggest which ones worth a shot.» clio's list put «⭐ guard, the floor guard» first; dima picked it and asked for it non-blocking: «I would want this mod to be non-blocking … don't block them, so they would find a workaround themselves, ideally, and only ask you or me if it is truly needed.» it shipped that evening as a refusing mod: the floor plus 9 hazard lints, 1,506 lines (FRM-321)
- **10-05, guard-first.** his question «it would be a first candidate to extend with something that would instead be parked at fleet hazards file?» became clio's standing rule: every Bash-shaped hazard moves into the guard, and clio's own habit-cto line checks for it at every halt. from here the guard grew by default
- **10-06 → 10-11, the floor widens, then the first live misfire.** system and remote deletes, a coder summon refused without a brief stamp, a held-file write refused. on 10-11 the brief guard refused plain reports live; dima's o70 set «new rules ship warn-only first». that was the right brake, and it held only for new rules
- **10-23, the guard turns on us.** clio changed ticked outcomes and signs without asking three times, so FRM-427 made a tick the only proof of his word, enforced by the guard. a guard against clio's own slips: the start of the «his word» machinery
- **10-27 → 11-03, the big growth.** «let's exhaust the full list, until there's nothing else useful to do with mods» (FRM-425) opened the door; 11-02 alone added 4,365 lines (escape table, sixth sense summon, the worth rule)
- **11-07, the first lockout he named.** «1h40m of stuff not being merged»; his words: «I don't want to be locked out myself, so an override should be able to override anything.» the override shipped with one scope, merges (FRM-524)
- **11-08 → 11-12, the four-day spiral.** typed «sign», pane proof, herdr close, seat ends, bare-yes ticks: 83 commits, 26 and 36 a day on 11-10 and 11-11. his words climbed: «why we locking out ourself and i need to print that stuff like in stone age?», «you are not allowed to be unable to do stuff like delete/merge/sign»
- **11-12, the cut.** «in the first place i didn't ask for a guard like this at all. it was all your ideas, and at some point you drifted towards protecting this guard, continued developing it, and locked yourself out with all these guards.» FRM-581 cut 68 rules to 11, hooks 10,683 → 4,742 lines, tests 14,164 → 3,753 lines (3,120 → 627 tests)

## the wrong calls, who made each, what it cost

- **clio built it blocking after he asked for non-blocking** (10-05). clio's call; dima's tick was on the idea, and his one word on its shape said non-blocking. cost: the design ran refuse-first for 38 days, and every later rule inherited it
- **clio turned «a first candidate» into «always»** (10-05). dima asked a question, clio wrote a standing rule with no bar for what earns a refusal. cost: the guard became the default home of every hazard, 79 tickets cited in its commits
- **clio fenced its own slips with a refusal** (10-23, FRM-427). clio initiated; dima agreed with a tick. cost: the «his word» machinery, which by 11-12 had 9 doors and 6 stores, and its 142 refusals in 4 days
- **clio scoped the override to merges** after «override anything» (11-07, FRM-524). clio's call; `guards` and `all` were parked as later chunks. cost: on 11-12 his override did not cover a sign tick
- **clio claimed doors that did not work**: «type sign FRM-544» with no typed door built, «ticks work now» before his first real use hit two bugs (11-10). clio's call. cost: two turns of his, his anger, and the trust in every later «it works»
- **two clios built guard pieces with nobody owning the whole** (11-08 → 11-12). clio's split, main and wing 1. cost: 83 commits in 4 days, each fix breaking the other side
- **dima agreed in silence.** 57 of 289 commit bodies cite his tick or his word, mostly ticks on asks clio wrote. his read, 11-12: «it was all your ideas». the tick was real; the idea behind it was clio's every time but FRM-524, FRM-544 and FRM-574, which were his and asked for less guard, never more

## the cost

- 289 commits on the mod paths over 27 active days, +33,152 / −24,367 lines; ~24k of those lines were deleted on the last day
- 4 days of lockout: 83 commits, 620 refusals, 142 of them his word not reaching its door
- his hours lost to refused ticks, extra ticks and re-asks: not measured; the flawlogs hold 11 incidents (11-02 → 11-10)

## what changed

- FRM-581 (re-signed 11-12 16:31): the guard keeps only the destructive floor, one tick unlocks each; every other refusal is deleted; a break-glass override that fails open and always ends; x-mod-stash stays whole
- one clio owns the guard and the cli together (the cli lane moved to main, 11-12)
- the picture of the mess: `~/frame/_clio/.scratch/guard/guard-today.png`; the analysis: `~/frame/_clio/.scratch/guard/revisit-1.md`

## the line that keeps it from coming back

a new refusal needs a real incident and a kill date; a guard that guards us from ourselves is the smell.

## proposed: three mechanical stops (not yet his word)

- **a refusal rule carries its incident and its kill date in code**: a test reds a rule without both, so «a new refusal needs a real incident» stops being prose
- **a mod's size is read at the halt**: a mod whose hook lines doubled in 14 days gets one line to dima; the guard went 932 → 2,617 lines in its first 6 days and nobody looked
- **a ticket says whose idea it is**: a wish line his own typing carries, a tick on clio's ask says so (`dima's tick on clio's ask oN`), so a chain of ticks on clio's ideas shows before it grows a mod
