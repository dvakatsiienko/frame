<!-- kept as the record of what dima read at 19:43 on 11-06. stale: the go cache miss (it was my own probe's env), «the wait is the real cost» and «fixed» (the queue is younger than his complaint; waits of 989 and 1,011 s came after), the habit line for background commits (FRM-519's guard row instead), «capping saves no cpu» (go saved 15 % at more than twice the wall). what holds now: ../gate-speed.md and FRM-521. -->

# PK-328: faster commit gate and red-proofs

wish: PK-328

PK-328:W3 (2026-11-06 18:15, dima): maybe rethink this approach at all: why do we have pre-commit, and all these checks on the commits? maybe move them to the push event. commits get much faster, and the gate is still there, just later on push instead of on each commit. i think it would make coders much faster. ❓
PK-328:W5 (2026-11-06 18:32, dima): i thought our tests via Go and vitest are fast tools. why do they overload my CPU? maybe our testing tools are not properly configured. add this to the scope, identify the bottlenecks and fix them. maybe vitest or Go tests need to be parallelized, maybe they use one core instead of many. ❓
PK-328:W7 (2026-11-06 18:32, dima): i assume this CPU overloading was only partially related to the finder issues, most likely caused by gate commits.
PK-328:W8 (2026-11-06 18:36, dima): good ideas, fold and consider to implement: reuse the «already tested these bytes» record for typecheck and tests, not just mods; run only the tests related to the staged paths at commit, with the full set at push; commit in the background, so a coder keeps working during the gate; give each gate a time budget that goes red when exceeded, so slowness can't creep back.

## the verdict

the slowest thing is not the gate: it is the wait in front of it. a 15–40 s commit waited up to 1,500 s behind mutant rounds and newcomers, by each member's own numbers. that is fixed in this batch. moving gates to push does not get the 21 min, since the wait moves with them; related tests at commit on branches do get about 12 s a commit.

## measured

- 7 days of transcripts, 95 sessions: coding-session commits n=490, p50 51 s, mean 60 s, so 10 commits is about 10 min, not 30
- per session the spread is wide: gates in the foreground p50 3.9 %, p90 23.7 %, max 38.7 % of active time; 8.3 % overall, plus 5.7 % in the background
- red-proof n=227, 468 min, p90 390 s, about 64 s per pair (per-pair inferred from tab counts). in coding sessions as long as commits: 457 min against 486
- queue waits today: clio 1116, 1084, ~690 s; lane 6 874 s; ci 948 s; lane 5 268, 248 s; wing 1 1500 s, died; a holder was usually a mutant round
- 19 real hook logs, thin and biased to reds: p50 16 s, p90 84 s, max 133 s; test 51 % of gate seconds, mods-test 27 %. successful commits leave no log, so the 51 s p50 cannot be split yet; gate-queue.log can from today
- bench, one run each, load 20–37, so a direction, not a precise number: index copy 0.9 s; typecheck 0.5 s; vitest 14.7 s wall, 76 cpu-s; go test 45 s wall, 308 cpu-s, sys 190 > user 117
- vitest with 4 workers 35 s, same cpu; go -parallel 4 98 s, 263 cpu-s; a ram disk TMPDIR changes nothing, A/B/A/B; threads 11 s and no-isolate 16 s sit within noise of the default's 12–15 s
- go test's cache misses on an unchanged tree; `GODEBUG=gocachetest=1` says only «not found», the cause is unread
- the go test binary looks up git about 5,940 times over 539 tests
- 8 recent ts commits replayed through `vitest related`: 0, 0, 0, 0, 0, 3, 5, 23 s. replay ran no known red, so its catch rate is unmeasured
- sixth sense, one round: go mutants 21 of 28 in 17.5 min, one run 143 s, void because TestMain builds x without the overlay; gates green on 6 must-fix breaks; hostile lines plus a wisphunter read (394 s) caught them
- mods probe: x-mod-stash 76 s, guard 31 s, holds 5 s, redact 5 s

## answer to W5

- not misconfigured on cores: vitest uses about 5 of 14, go about 7. capping saves no cpu and doubles the wall
- go's real waste: sys 190 s against user 117 s is process spawn, mostly git fixtures (inference from the 5,940 lookups), plus the cache miss
- what made load 140: crow counted 14 go test, mutant and red-proof runs plus 2+ plugin tests at the 18:02 spike. 14 runs × 5–7 cores is 70–100 busy threads, so that is the order of it (inference). commits rarely overlap: 7 of 19 logs, at most 2
- so W7 is partly right: gate runs drive it, long rounds in parallel far more than commits, and the queue already stopped the pile-up

## landed in this batch

- first-come tickets in gate-queue: a newcomer never jumps a waiter
- gate-queue --long: long rounds get their own slot, callers must pass it
- gate-queue.log: load, slot, wait, run, exit per run
- vitest testTimeout 5 s → 30 s
- red-proof stops a swap at its first failed test: 15 s → 8 s on one mutant, base included, vitest path only

## proposals, each his call

1. `codie/*` branches: at commit `vitest related` on the staged paths, the whole suite stays at push through the runner-twin
   - gain: about 12 s a commit, a 15 s suite to a median near 0
   - tradeoffs: tests that read md, tsv or spawn scripts by path are invisible to the import graph, so those reds land at push, costing 44–124 s per rerun; red commits on a branch, hidden by the squash
   - main and wings keep the whole suite: a red local main reds every peer, and main refuses to give that up
   - read after a day of gate-queue.log: reds at push per 10 commits
2. fix the go mutant overlay first, then measure 3 mutants on the lines of those 6 breaks; keep or drop the default on that result
   - today's rounds prove nothing and burn the most cpu, so they stop until the overlay is fixed
   - tradeoff: no mutant check meanwhile, hand-picked red-proofs stay
3. a time budget: no threshold yet. two days of gate-queue.log with load beside each row first; then a siesta-checks line that treats an empty log as «unmeasured», never green

## W8 verdicts

- tested-bytes: typecheck no, 0.5 s; test no, a fix changes the bytes so it hits only a commit-msg retry; mods has it, its one bug gates.go:414 goes to the cli lane
- related tests: yes on branches, proposal 1
- background commit: it exists, the guard hints it, coding sessions still ran 466 foreground against 24; a crew-codie habit line, and the notification is clio's read-back
- time budget: yes, proposal 3, after data

## for the lanes

- mods: most of the 64 s a pair sits in `--cmd` runs, bail cannot reach them: read the `--only` path
- cli: FRM-383 carries bail and one-test runs; a fixture template over git init per test (inference); go's cache miss; 589 of 606 x-commit logs are fixture leaks in the user temp dir
- all: the wait line in each lane's brief: mutants and suites by hand pass --long
