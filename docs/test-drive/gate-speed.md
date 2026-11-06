---
status: live
until: 2026-11-13
dies-when: the verdict line below is written
---

# gate-speed — one week of measuring the faster commit gate and red-proofs

Ticket: none (PK-328 in clio's pocket)

PK-328:W12 (2026-11-06 19:58, dima): well, i read your reply. let's try. but i want everything measured for 1 week. ensure measures are present, so we don't do stuff blindly. and ideally nothing is broken.
PK-328:W15 (2026-11-06 20:49, dima, on the expected gains): ensure all these points, and think what else, to measure and compare after 1 week.

**test card:** we believe a fair queue, a long slot, related tests on `codie/*`, higher timeouts and stop-early red-proofs cut the time a coder waits, with no red reaching main · we test it by every real commit, push and red-proof of the week · we measure each row below against its baseline, per lane, with load beside it · we're right if the safety rows hold and at least the queue, red-proof and commit rows reach their targets
**kill rule:** any safety row breaks, or related tests cost more than they save (reds at push over 1 per 10 commits on `codie/*`, break-even is about 1 per 7: 12 s saved a commit against about 84 s a push): `lefthook.yaml`'s `test` goes back to the whole suite that day

## where the numbers come from

- `~/.local/state/x/gate-queue.log`: start, load, slot, wait, run, exit, command; each queued commit, push and long round
- `~/.local/state/x/gate-steps.log`: start, load, source (`commit`, `push`, `other`), branch or ref, commit, seconds, exit, command; each gate run through `script/index-run.sh`, each push's whole suite
- `~/.local/state/x/test-commit.log`: start, load, branch, mode (`whole`, `related`, `none`), staged paths, commit, seconds, exit
- `~/.local/state/x/mods-test.log`: each mods test run, its skips and timed-out reruns
- transcripts: `GATE_SPEED_DIR=<tmp> node docs/test-drive/gate-speed/collect.mjs`, then `analyze.mjs`, `slow-collect.mjs`, `slow-analyze.mjs`: the same scripts as the baseline, so the classes match
- an empty or missing log reads «unmeasured», never green; a row's load decides whether a slow day is the gate or the machine

## what is compared on 2026-11-13

baseline is 2026-10-30 to 2026-11-06, before the fixes, unless the row says otherwise. each row: baseline → target.

**the gains**
- commit call, mods lanes: p50 60 s, mean 74 s → p50 under 45 s
- commit call, other lanes: coding p50 51 s → under 30 s
- commit-call minutes per 10 commits, mods lanes: median 10.4, worst 24.6 → median under 7, worst under 15
- the same, other sessions: median 5.2, worst 11.5 → no worse
- wall time per 10 commits, mods lanes: median 65 min, 8 of 9 runs at 30+ min → read only: mostly edit and review between commits
- the commit's test step on `codie/*`: about 13 s whole → median under 5 s, from `test-commit.log`
- gate step seconds at commit, per gate: unknown → the first baseline, from `gate-steps.log`
- mods tests at commit: unknown per step → p50 from `gate-steps.log`; the skip share on tested bytes: 21 of 229 runs in `mods-test.log` → over half; this is the likely saver for his 3-minute case
- queue wait, gate slot: 18 to 1,500 s, one evening, 11-06 only → p90 under 120 s, none over 600 s
- gate slot held over 300 s: seen, 993 s at 20:08 on 11-06 → none; a long round in the long slot instead
- long rounds using `--long`: 0 before 11-06 → all
- false reds on a 5 s timeout: 7 of 19 logged reds on 11-06, 4 failed pushes and commits on one lane → none from vitest
- mods rows timing out and rerun: 38 of 229 runs in `mods-test.log` → fewer; FRM-501 owns the retry
- red-proofs: n=227, p50 32 s, p90 391 s, 468 min → p90 under 240 s
- red-proof per pair on vitest: 15 → 8 s on one mutant, load 38 → holds over real rounds
- red-proof per pair on `--cmd`: about 64 s, inferred → read only: nothing built, it names the next fix
- go mutant rounds: 17.5 min, void → with `GOFLAGS=-overlay`, each round's minutes and bugs found; no bug in a week reopens the default
- foreground commits: 466 of 490 → under 20 % once FRM-519's guard row lands; before that, read only
- gates in the foreground, share of active time: 8.3 %, per session p90 23.7 % → under 5 %, p90 under 15 %

**the load**
- load: peaks of 126 to 172 on 11-06 → peak under 60, from the logs' load field; a day with one lane is read apart from a day with four
- whole suites at the same load: vitest about 13 s, go tests about 45 s → no worse; `gate-bench.sh` at load under 5 once, for a clean number

**the safety rows, a break here kills the trial**
- reds on main from a commit whose test step was `related`: 0 → 0; `gh run list --branch main --status failure` joined on `test-commit.log`'s commit
- reds at push on `codie/*`: unknown, the push tested main's HEAD before 11-06 → at most 1 per 10 commits
- pr ci reds a push let through: `gh run list --event pull_request` → read per lane
- must-fix findings on a head with green gates: 6 in one round on 11-06 → read only: gates do not catch these, sixth sense does
- the real repo's config: `git -C ~/frame config --local core.bare` false, no `user.*` key → daily, at the siesta; one breach reopens the fixture guard
- gate-queue deadlines: exit 75 rows, 1 on 11-06 → none

**the outcome he wants**
- commits per active hour, per lane: mods 3.4, per-session p50 2.3 → no worse
- pr open to merge, per repo: `x fleet flow --days 7` → no worse

## stress list

- first-come queue — the first evening with 3+ lanes committing — wait p90
- `--long` slot — a mutant round during commits — commit wait during it
- 30 s testTimeout — commits at load over 30 — timeout reds
- red-proof stopping at its first red — a vitest `--pairs` round — seconds per pair
- related tests — the first commits on a `codie/*` branch — mode row, seconds, whether its push went red
- the pushed-commit twin — the first lane push from a worktree — the tested commit is the branch's

## rounds

- 2026-11-06 · red-proof on one mutant, load 38 · 15 s → 8 s, base included · better
- 2026-11-06 · `vitest related` replay of 8 recent commits · 0, 0, 0, 0, 0, 3, 5, 23 s against about 13 s whole; catch rate unmeasured · better on speed

## verdict
