# siesta + wishkeeper — the proposal (wing 1, 2026-11-11 22:16)

wish: FRM-491. sources: census.jsonl + census-summary.md (helper), grades.md (researcher), consults from main clio and crow (22:14).

- FRM-491:W1759 (2026-11-11 21:55, dima): why I raised the siestas question: I spotted that wishkeeper Flow and siestas started to happen too often. before, there was the other side of the problem: you kept forgetting to siesta and wishkeeper Flow, but now it's too often in my mind. (context, not dima's words: "wishkeeper Flow" and "siestas" as written in the raw.)
- FRM-491:W1760 (2026-11-11 21:55, dima): I can be mistaken, though, because from what I saw wishkeeper Flow keeps finding a lot of issues for you, which is useful. are those findings that wishkeeper Flow finds truly useful, or are they just cosmetics? ❓
- FRM-491:W1763 (2026-11-11 21:55, dima): what I want the list to do is make siesta flip back again. currently it flips too often, but I don't want it to flip into a state where you forget it again.
- FRM-491:W1769 (2026-11-11 22:01, dima): for example, imagine we keep the current cadence because we consider it useful. how then do we sharpen the instructions to get the most out of it, given the frequent cadence of wishkeeper Flow? how do we write the instructions so that, with such frequent siestas, each wishkeeper run gives the maximum gains? ❓

## what the numbers say

- 252 siestas in 12 days (10-30 → 11-11), 23–46 a day since 11-03, main ~78 %; 195 wishkeeper runs, 26.8M tokens
- 1,946 findings: 293 high, 711 medium, 942 low
- highs are real: 33 of 42 graded highs caught a real defect (a bent or dropped wish of dima's, a false «done» told to him, a signed pick changed); most would have reached him wrong
- lows are noise: 0 of 24 caught anything; clio dropped 20 of 24 of them unacted
- weighted, all findings: caught 19 %, hygiene 58 %, cosmetic 12 %, false 5 %, duplicate 6 %
- catches per run barely move with the trigger (~2.5–3.2); the outlier is the second read of a chunk already read: 0.6 catches a run, ~177k tokens a catch, 4 of the 5 worst runs
- the «unknown trigger» rows (33) are big batches: 582 commits across them, ~18 each, and the most highs per run (3.5): batch weight predicts yield
- surfaces: wishes, claims, tracker and edits catch; loose ends caught nothing

so: wishkeeper is worth its runs on highs; the waste is in lows, re-reads and small windows.

## the cadence (siesta-gate.ts)

- keep: the Stop-hook block as the floor, so siestas are never forgotten again
- keep: a member's `[done]` or `final`; drop: a progress ping
- a skill's code file stops counting as «a skill file»; memory and rule text still count
- wishkeeper skips a window with no reply to dima and no commit (pure member traffic): nothing of his to read against
- batch weight: 15 files stays; a big batch is where the highs live

## the card (_clio/.claude/agents/wishkeeper.md), effort stays medium

1. claims first, sharpened: a «done / fixed / works» claim passes only if its proof touches the exact failure reported, not just any command that ran (tonight's two highs failed exactly so); the brief hands it the list of claims made to dima since the stamp
2. delta only: commits and transcript since the stamp; a W-line graded clean before is re-read only when its ticket body, pocket item or chunk changed since
3. no second read of a chunk already read, unless it is a big chunk with signed W-lines sixth sense never quoted
4. loose ends cut; «an old name after a rename» folds into edits
5. lows as one count line, never listed; once a week «N lows dropped» joins the weekly retro card
6. the brief also passes crow's notes since the stamp, so wishkeeper skips what crow said (the 6 % duplicates)
7. the fixed reads (the invariant excerpt, craft-pm § wishes, the reply rules) move into the card's own text, a cached prefix instead of tool calls on every run; measured on one run before and after
8. output budget: top 5 + one count line, ≤2k tokens out
9. measure: one row per siesta in grades.md (highs real y/n, tokens), so the next cut reads off numbers

## dropped from the drafts

- ordering the six checks by yield (crow: every run does all six, so order saves nothing)

## build

- FRM-491 re-signed with this shape; built by hand in `_clio/` (siesta-gate.ts, the card, clio:siesta's brief step), red-first fixture tests on each trigger branch

## final, after the web research (22:33)

sources: `web-lanes/exa.md`, `web-lanes/parallel.md`, `web-source-lane.md` (researcher, primary sources), the recipe `recipes/refresh-crew-coordinator` (its per-card vector), dima's wishkeeper wishes (pk-103 W450–W459, pk-288 W729–W730, PK-363:W886–W889).

### the cadence

1. the floor stays and gets a receipt: a due siesta always opens; a wishkeeper skip is logged with its reason by the gate, so «forgotten» stays impossible (source lane: «turn it into a hook»; parallel: a fail-closed receipt)
2. the work scales with the batch, the pause never does (exa, parallel: «mandatory checkpoint, adaptive effort»): due on a member's [done]/final, a ticket close or sign, 15 files, or 3+ memory/rule text files; never a skill code file or a progress ping; a window with no reply to dima and no commit skips wishkeeper, logged
3. a full read stays as the backstop: after an instruction change to the card itself, and at the halt

### the card

4. a review ledger: wishkeeper reads only since the last read head, gets the open findings and answers each «fixed» or «still open»; a chunk's fix round resumes the same agent instead of a fresh read (CodeRabbit's incremental review, cc's subagent resume)
5. claims first, judged by state: a «done / fixed / verified» claim is checked at HEAD on the exact path it names, never by the reply's wording (LLM judges reach only AUROC 0.65 on false «done» claims, arXiv 2606.09863; tonight's two highs were this)
6. three checks, each with its own evidence rule: his words (wishes, signed lines), claims against state, rule breaks in clio's edits; loose ends cut, the rename check folds into edits
7. the output contract: zero findings is a valid result; a finding needs a concrete counterexample and its consequence; highs and mediums in full, top 5; lows one count line; a short «never a finding» list (cosmetics, wording)
8. a cached prefix: the fixed reads move into the card's text, with a 1 h cache ttl so a siesta 20 min later reads it warm (not verified: whether a preloaded skill sits in the cached prefix; measured on one run before and after)
9. crow's notes since the stamp ride the brief, so wishkeeper skips what crow said
10. effort stays medium; a big batch (a chunk read, 15+ files) passes `effort: high` per call

### the measure

11. one row per run: highs real y/n, acted or dropped, tokens; and a small regression set of tonight's real highs, replayed whenever the card changes, so a sharper card provably keeps its catches (exa: calibrate against hard negatives)

### build

- FRM-491 re-signed to this; main clio and wing 1 build it (dima 22:25): the gate and the brief step in `_clio/`, the card, red-first fixture tests per trigger branch, the regression replay
- the recipe `refresh-crew-coordinator` gets a «wishkeeper yield» vector reading the per-run rows
