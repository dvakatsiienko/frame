---
status: live
until: 2026-11-13
dies-when: the verdict line below is written
---

# gate-speed — one week of measuring the faster commit gate and red-proofs

Ticket: FRM-521 (PK-328 in clio's pocket holds his words)

PK-328:W12 (2026-11-06 19:58, dima): well, i read your reply. let's try. but i want everything measured for 1 week. ensure measures are present, so we don't do stuff blindly. and ideally nothing is broken.
PK-328:W15 (2026-11-06 20:49, dima, on the expected gains): ensure all these points, and think what else, to measure and compare after 1 week.

**test card:** we believe a fair queue, a long slot, related tests on `codie/*`, higher timeouts and stop-early red-proofs cut the time a coder waits, with no red reaching main · we test it by every real commit, push and red-proof of the week · we measure each row below against its baseline, per lane, with load beside it · we're right if the safety rows hold and at least the queue, red-proof and commit rows reach their targets
**kill rule:** any safety row breaks, or related tests cost more than they save (reds at push over 1 per 10 commits on `codie/*`, break-even is about 1 per 7: 12 s saved a commit against about 84 s a push; at load the whole test step is 28 to 32 s, so read the saving from `test-commit.log`): `lefthook.yaml`'s `test` goes back to the whole suite that day

## where the numbers come from

- `~/.local/state/x/gate-queue.log`: start, load, slot (`gate`, `long`, `none`), wait, run, exit, session (first 8 characters, or `-`), command; each commit, push, long round and wrapped run; rows before FRM-521's turn change have no session column. `x lane rebase-main` and the stack push take no turn and log no row
- `~/.local/state/x/gate-steps.log`: start, load, source (`commit` a real commit's hook, `push` a real push, `other` the rest, `x lane commit --dry` and `x mods edit test` included), branch or remote ref (`unnamed` on a hand twin), commit, seconds, exit, command; each gate run through `script/index-run.sh`, each twin's whole suite. rows before FRM-521's pr 3 say `commit` for any cc session and a sha for the ref from 2026-11-07 a whole test or mods step adds user + sys as a ninth column, any other step `-`; a `test:twin` row keeps 8. `~/.local/state/x/test-cpu-budget.log`: start, load, suite, user + sys, budget, exit; one row a whole go run.
- `~/.local/state/x/test-commit.log`: start, load, branch, mode (`whole`, `related`, `none`, pocket-only commits included), staged paths, commit, seconds, exit, source (as `gate-steps.log`); rows before FRM-521's pr 3 have no source
- `~/.local/state/x/mods-test.log`: each mods test run, its skips and timed-out reruns; under `--skip-tested`, each mod that ran says why: `<mod> ran: no record`, `other bytes`, `past its hour` or `a shared path`
- transcripts: `GATE_SPEED_DIR=<tmp> node docs/test-drive/gate-speed/collect.mjs`, then `analyze.mjs`, `slow-collect.mjs`, `slow-analyze.mjs`: the same scripts as the baseline, so the classes match
- an empty or missing log reads «unmeasured», never green; a row's load decides whether a slow day is the gate or the machine

## what is compared on 2026-11-13

baseline is 2026-10-30 to 2026-11-06, before the fixes, unless the row says otherwise. each row: baseline → target.

**the wait, read first and per lane, dima's weight (21:37)**
- the gate slot's wait per lane and per kind: 11-06 19:39 to 21:36, n=62: p50 95 s, p90 636 s, max 1,011 s, 189 min waited against 88 run → p90 under 60 s once FRM-521 lands; `gate-speed/queue-read.mjs`
- commits: wait p90 663 s against run p90 40 s; pushes: wait p90 562 s against run p90 56 s → wait p90 under one run
- share of the gate slot held by anything but a commit or push: 76 % → none
- a mod sitting uncommitted under the queue: up to 20 min, main's report → read from the mods lane's rows
- no «before» log exists: members' reports, 268 to 1,500 s; 21:00 on 11-06, with no long hold, read p90 66 s, one hour only

**the gains**
- commit call, mods lanes: p50 60 s, mean 74 s → p50 under 45 s
- commit call, other lanes: coding p50 51 s → under 30 s
- commit-call minutes per 10 commits, mods lanes: median 10.4, worst 24.6 → median under 7, worst under 15
- the same, other sessions: median 5.2, worst 11.5 → no worse
- wall time per 10 commits, mods lanes: median 65 min, 8 of 9 runs at 30+ min → read only: mostly edit and review between commits
- the commit's test step on `codie/*`: about 13 s whole → median under 5 s, from `test-commit.log`
- gate step seconds at commit, per gate: unknown → the first baseline, from `gate-steps.log`
- mods tests at commit: unknown per step → p50 from `gate-steps.log`; the skip share on tested bytes: 21 of the 61 `--skip-tested` runs in `mods-test.log` → all that follow a green overlay within its hour; FRM-521 builds it
- queue wait, gate slot: 18 to 1,500 s, one evening, 11-06 only → p90 under 120 s, none over 600 s
- gate slot held over 300 s: seen, 993 s at 20:08 on 11-06 → none; a long round in the long slot instead
- long rounds using `--long`: 0 before 11-06 → all
- false reds on a 5 s timeout: 7 of 19 logged reds on 11-06, 4 failed pushes and commits on one lane → none from vitest
- mods rows timing out and rerun: 38 of 229 runs in `mods-test.log`, 15 of them at commit → fewer; FRM-501 owns the retry
- go suite cpu: 308 cpu-s, sys 190 over user 117 → at least 25 % under, FRM-521's exit 5
- red-proofs: n=227, p50 32 s, p90 391 s, 468 min → p90 under 240 s
- red-proof per pair on vitest: 15 → 8 s on one mutant, load 38 → holds over real rounds
- red-proof per pair on `--cmd`: about 64 s, inferred → FRM-383's W3 and exit 11 build it; read after that lands
- the time budget, his FRM-521:W4: first read 2026-11-08, two days of `gate-steps.log` and `gate-queue.log` with load beside them; then a `siesta-checks` line reading p90 per step, an empty log reads unmeasured, never a red on a commit, since load would false-red it
- go mutant rounds: 17.5 min, void → with `GOFLAGS=-overlay`, each round's minutes and bugs found; no bug in a week reopens the default
- foreground commits: 466 of 490 → under 20 % once FRM-519's guard row lands; before that, read only
- gates in the foreground, share of active time: 8.3 %, per session p90 23.7 % → under 5 %, p90 under 15 %

**the load**
- load: peaks of 126 to 172 on 11-06 → peak under 60, from the logs' load field; a day with one lane is read apart from a day with four
- whole suites at the same load: vitest about 13 s, go tests about 45 s → no worse; `gate-bench.sh` at load under 5 once, for a clean number
- load per kind of run, `../knowledge/cpu-overload/cpu-load.md`, re-run at each merge: only a go gate or test, 51 with sys 52 % → under 35; only a commit, 19, idle's 21 → no worse; nothing queued, 21 → read only: the running sessions and the os
- whole suite cpu: mods 446 cpu-s, go 308, vitest 76, a `/usr/bin/time -p` row each → go per exit 5, mods read after FRM-489
- commits with no code: 70 of 167 still run the whole test step → read per class, `gate-speed/commit-classes.mjs`

**the safety rows, a break here kills the trial**
- reds on main from a commit whose test step was `related`: 0 → 0; `gh run list --branch main --status failure` joined on `test-commit.log`'s commit
- reds at push on `codie/*`: unknown, the push tested main's HEAD before 11-06 → at most 1 per 10 commits
- pr ci reds a push let through: `gh run list --event pull_request` → read per lane
- must-fix findings on a head with green gates: 6 in one round on 11-06 → read only: gates do not catch these, sixth sense does
- the real repo's config: `git -C ~/frame config --local core.bare` false, no `user.*` key → daily, at the siesta; one breach reopens the fixture guard. a test with its cwd inside the gate copy can still write the shared config: no sighting, left open
- gate-queue deadlines: exit 75 rows, 1 on 11-06 → none

**the outcome he wants**
- commits per active hour, per lane: mods 3.4, per-session p50 2.3 → no worse
- pr open to merge, per repo: `x fleet flow --days 7` → no worse

## a wing's side lane, a probe (PK-328:W21)

dima explores how to balance the load across clio main and her wings; FRM-521 is the first side lane a wing runs. at its landing, one line each: wing turns woken by its members, what needed main (a merge, a sign), what broke, and whether a member's note ever went astray.

## stress list

- first-come queue — the first evening with 3+ lanes committing — wait p90
- `--long` slot — a mutant round during commits — commit wait during it
- 30 s testTimeout — commits at load over 30 — timeout reds
- red-proof stopping at its first red — a vitest `--pairs` round — seconds per pair
- related tests — the first commits on a `codie/*` branch — mode row, seconds, whether its push went red
- the pushed-commit twin — the first lane push from a worktree — the tested commit is the branch's

## rounds

- 2026-11-07 · FRM-521 merged, its first read, `gate-queue.log` 14:04 to 15:40, n=60, 1 to 2 lanes, load p50 15, against the baseline's 4-5 lanes: not a fair comparison until a day with as many lanes · gate wait p90 636 → 39 s, max 1,011 → 89 s, held by anything but a commit or push 76 → 0 %; go suite: pr 139's protocol read 385 → 278 cpu-s, unreproduced since, today's runs read 351 to 357 with `LANG`, 405 without (`ab-lang.tsv`); a mods commit after a green overlay 294 s suite → 1 s, n=3; `refs/heads/main` in the first push row · better, the 11-13 read decides
- 2026-11-07 · a wing's side lane, the probe: what needed main, nothing past lane times; the merge ran on his sign's pre-approval; what broke, sixth sense's 3 breaks in pr 3, all fixed; a stale lock read as a live session at decamp; a member's note astray, none seen; wing turns woken: not counted
- 2026-11-07 · exit 16 for real on the merged script, load 60 · the 120 s script logs slot `none` and holds nothing; the peer's wait past the script's commit is 36 s against that commit's 39 s run; both still waited 424 and 460 s, behind a mods commit that held the turn 494 s, its `mods:test --skip-tested` 294 s, exit 1 · the wrapper is fixed; the next hold is the mods suite inside a commit's turn, pr 3's skip
- 2026-11-07 · exit 16 for real, first try, void: main's checkout still held the old script, so the wrapper took the turn: the peer waited 139 s of the script's 164 s · void, not a read of the fix
- 2026-11-06 · red-proof on one mutant, load 38 · 15 s → 8 s, base included · better
- 2026-11-06 · `vitest related` replay of 8 recent commits · 0, 0, 0, 0, 0, 3, 5, 23 s against about 13 s whole; catch rate unmeasured · better on speed
- 2026-11-06 · what loads the cpu, 27 min at 14 live worktrees · only a commit load 19, nothing queued 21, only a go run 51 with sys 52 %; `../knowledge/cpu-overload/cpu-load.md` · the baseline for the re-measures

## verdict
