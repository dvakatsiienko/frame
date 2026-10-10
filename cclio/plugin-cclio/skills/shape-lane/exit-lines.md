# exit lines — what a sealed line holds

read at step 4 of `shape-lane`, before the first line is drafted. each rule is a round some coder or verifier once lost.

## it names real things

- every file, script, verb and term a line names is **grepped in the target repo** before the seal; a miss is rewritten. drafted from memory, 3 lines missed in one day: a 16 px piece atelier never had, a «manual» no file is called, «png» where atelier writes webp (BYT-113, BYT-114)
- a line names **behaviour, real commands and glossary words** (`pnpm typecheck`, `⇧F4`), never a file path: lines feed matt's spec, which bans paths as stale-prone
- a line is **checked against main at prep time**: «ignoreBuildErrors gone» was already true there
- a line that **rests on a fact about the world** (who refuses, which file outranks which, a count) carries the command and its output from seal time: «a repo top's shared settings outrank a subfolder's» was false, and FRM-366's line 2 was fixed after Done
- every **literal command** in a line is run once at seal (dry where it writes) and its exit code noted beside the line
- a line is **checked against the real surface**: `del` on a board with no del key, «no scroll» on a page with a footer, each cost a decision round
- a browser line names only **Chrome**, never Safari «for coverage»: `safaridriver` opened real windows on dima's screen. a check that cannot run headless warns first and asks before each run (BYT-116)

## it states a rule, never an example

- a line covers **every case it means**: one example string, «any bake» for a surface, a standing list with no line per item, each cost a round (BYT-103/104/105)
- a line that says «any», «new», «a path» or «a lint» **lists its hostile twins**: file and dir, rename and move, quotes and «», one character (FRM-356, 359, 367 each lost a round to a twin)
- a **cross-view claim is an equality**: «the same number on every view», never «the count is the headline everywhere» — the equality is where the bug was
- a **rate bar names its minimum n**: «recall ≥ 95 %» on 9 prompts meant 9 of 9 (FRM-305)
- a **baseline names its repo pairing and its filter**; a time window says today-inclusive and local (FRM-316)
- a line **built on a data field carries its one-command live count** in the ticket, and a parser line is tried against shapes counted from real data: «-dirty build» held literally while 665 of 665 trace lines were dirty (FRM-346)

## it says what it depends on

- a line that holds only after **another pr** merges names that pr
- a **cross-repo** line names where each half lands and which merges first: a hook calling the other repo's verb cannot push before the verb is on main (FRM-344)
- a **rename of stored data** says «migrate» or «read both», or two lines pull against each other
- a line that writes under `cclio/` is cclio's own, never the coder's: frame `AGENTS.md` bars a coder from that dir
- **one owner and one gradeable surface per line**: a hand-off to cclio or dima goes to `out` or a pocket item, never an exit line — the verifier cannot read the other half (FRM-355, 359, 372)

## once sealed, it changes in the open

- a changed sealed line keeps the old text struck through, with the date and the reason, and the change counts as a miss in that lane's retro — FRM-366's line 2 was edited in place after Done, and FRM-380's line 2 was reworded in a pr body while the ticket held the original
