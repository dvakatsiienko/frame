# what loads the cpu, measured

Ticket: FRM-521. PK-328:W24 (2026-11-06 22:03, dima): we test a lot of lanes at once, at least 14 from what i saw, and the commit gate seems the main reason for cpu overload and fleet hangs, so everyone slows down.

**verdict, one evening: the commit gate's own run is not the overload; its wait is the commit's pain, and the go suite is the cpu's.** one window, a correlation, so re-read it after each merge.

## the run

- `scripts/cpu-sample.mjs <out> 1800 10`: load, `top`'s user, sys and idle, `ps` %cpu per process family, every 10 s
- `scripts/cpu-read.mjs <out> <from utc>`, `scripts/cpu-load-join.mjs <out> <from utc>`, `gate-speed/queue-budget.mjs <from> <to>`, `gate-speed/commit-classes.mjs <from>`
- the raw sample: `scripts/cpu-2026-11-06.jsonl`. read from 20:09:10 UTC, past a mods bench of mine. 22:09:11 to 22:36:42 local, n=136, 14 worktrees live

## the machine

- 14 cores, load p50 24, p90 73, max 100
- user 41 %, sys 33 %, idle 27 %; idle under 5 % in 61 of 136 samples
- `ps` sums to 557 of 1,400, against about 1,020 busy: nearly half the busy cpu is unseen, short-lived spawns plus the kernel (inference: `ps` reads a decaying average and misses what exits between ticks)

## load per what was running

mean over the samples where that kind of queued run was live; `only` means no other queued kind.

- only a go gate or go test: load 51, sys 52 %, idle 7 %, n=24
- only a mutant or red-proof round: load 27, sys 35 %, idle 30 %, n=33
- only a mods suite: load 21, sys 24 %, idle 27 %, n=30
- only a push: load 21, sys 24 %, idle 45 %, n=9
- nothing queued: load 21, sys 21 %, idle 54 %, n=8
- only a commit: load 19, sys 25 %, idle 43 %, n=10
- any commit, overlaps in: load 47, sys 35 %, idle 20 %, n=23: what shares its time, read beside `only`

so about half the machine is busy with nothing queued: the running sessions and the os. n=8, thin.

## what one run costs

- go suite: 308 cpu-s, 45 s wall, sys 190 over user 117, one bench
- mods suite: 446 cpu-s, 135 s wall, sys 37 over user 409, 11-06 22:06, load 50
- vitest: 76 cpu-s, 14.7 s wall, one bench

## the budget, 20:00 to 22:05

queue seconds per family, `queue-budget.mjs`:

- commits: ran 16 min, waited 76 min, n=34
- wrapped scripts in the gate slot: ran 44 min, n=7: pr 1 ends these holds
- mutant or red-proof rounds in the long slot: ran 62 min, n=21

## commits by what they hold, 16:00 to about 22:37

`commit-classes.mjs`, 167 commits on all branches: 97 touch code, 70 none: 35 pocket only, 3 `_clio/` only, 32 docs, skills or rules. each still runs the whole test step, 28 to 32 s and 76 cpu-s: of the 43 test-step rows joined to a commit since 20:07, 22 had no code, 10 of them pocket only. 38 test files read `.md`, so only pocket-only looks safe to skip

## re-measure

a merge reaches a peer only once main's checkout holds it: a lane's script is read from there. read a row's column count to tell which script wrote it.

the same run at pr 1's merge, at each later merge, and on 2026-11-13, at a comparable fleet load, read beside this file; a mods suite row and a go row from `/usr/bin/time -p` each time.
