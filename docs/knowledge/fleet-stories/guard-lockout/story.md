---
status: open
dates: 2026-11-08 → 2026-11-12
tickets: [FRM-581, FRM-566, FRM-580, FRM-519]
tags: [guard, permissions, x-mod-guard, override, lockout, wrong-call]
fed-by: incidents
---

# the guard that locked us out — 2026-11-08 → 11-12

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

## what changed

- FRM-581 (re-signed 11-12 16:31): the guard keeps only the destructive floor, one tick unlocks each; every other refusal is deleted; a break-glass override that fails open and always ends; x-mod-stash stays whole
- one clio owns the guard and the cli together (the cli lane moved to main, 11-12)
- the picture of the mess: `~/frame/_clio/.scratch/guard/guard-today.png`; the analysis: `~/frame/_clio/.scratch/guard/revisit-1.md`

## the line that keeps it from coming back

a new refusal needs a real incident and a kill date; a guard that guards us from ourselves is the smell.

📌 still to write before the 11-12 halt (dima's o42): the whole arc from its birth, every decision with who made it (clio initiated, dima agreed silently, his read), and the days, hours and commits it cost.
