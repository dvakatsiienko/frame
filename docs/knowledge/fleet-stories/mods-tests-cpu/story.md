---
status: open
dates: 2026-11-05 → 2026-11-23
tickets: [FRM-662, FRM-590, FRM-678, FRM-688, PK-463]
tags: [cpu, tests, mods, claude-plugin-test, silence, wrong-call]
fed-by: incidents
---

# the mods tests that roasted the cpu, silently — 2026-11-05 → 11-20

the cli twin of this, the go suite and git's start cost, is [cpu-overload](../cpu-overload/story.md); this one is the cc mods tests.

## the biggest problem: silence

the mac's cpu was roasted by the mods tests for about two weeks, and nobody said so. clio saw the load and only proposed moving or stretching the runs: a queue, fewer lanes, a later run. not once did clio ask whether the tests themselves were written wrong, until dima asked it on 20 Nov 20:16 («are you sure we write tests the right way? maybe some of our tests are redundant?»). meanwhile every codie kept adding tests in the same costly shape, and each one made the roast worse.

dima, 2026-11-20 20:48: the biggest problem in this whole incident is the silence: the cpu was silently roasted for a very long time, and clio only proposed postponing the tests or stretching them out, and said nothing about possible root issues in the tests themselves.

- the wrong call is clio's: on 11-07 this mac's own cpu story already read «the mods suite fills user cpu» (cpu-overload, its proven line), and the fixes that followed went to git and the go suite, never to how the mods tests are written
- what it cost: on 20 Nov one mods review waited 40 min, its verifier 20 min, and every lane crawled at load 35–44 for an hour

## what happened

- `~/.local/state/x/mods-test.log` holds 1,328 whole-suite runs from 5 Nov to 20 Nov, about 95 a day (read 20 Nov)
- the suite's size, the last whole run each day: 2,913 tests on 11-05, 3,800 on 11-07, 4,724 on 11-11; a cut to 2,330 on 11-12 (the guard's own cut, guard-lockout story), then back up to 2,781 by 11-19
- the first sign in the log: «timed-out files ran again» on 11-09, 11-11, 11-12, 11-13, 11-15, 11-16; a timeout under load reran the file, which added load. nobody read it as a signal
- 20 Nov 19:20–20:12: FRM-662's review ran `x mods edit test --range`, a verb built that day, which reran x-mod-stash's whole suite at each of 22 commits; beside it, the mods codie's own ~20 pushes each ran all 1,892 x-mod-stash tests (81–275 s each, load 26–108), and the other lanes' tests ran too; load 34–44 (`uptime`)

## the causes

1. **every host test reloads the whole mod.** `claude plugin test` starts each test with the mod freshly loaded, about 0.2 s of cpu per test, more as the mod grows ([cc docs](https://code.claude.com/docs/en/plugins/mods/test.md), [claude-code#106331](https://github.com/anthropics/claude-code/issues/106331), open). 1,537 of our 1,668 `test(` calls take the kit's `$`, so almost every test pays it
2. **our own rule banned the cheap runner.** `mods/AGENTS.md:11` said «tests run through `claude plugin test`, never vitest», so pure logic (`parse.ts`, `look.ts`, `tree.ts`, `orbit.ts`) was tested through the host too
3. **whole suites everywhere.** every mods push, every commit hook and every review step ran the whole suite, whatever the change touched
4. **no cap.** `claude plugin test` runs ~10–15 files at once with no flag to limit it ([claude-code#108931](https://github.com/anthropics/claude-code/issues/108931), open), and nothing on the mac stopped two heavy suites from running together
5. **waste in the suite.** the guard's 24 files test one hook with near-copies of one world; `slow.test.ts` guards a deleted feature; two tests run 360–1,440 fake poll ticks of hooks

## how we found it

- dima saw it first, 20 Nov 20:03: «why mods codie parked for 40m? and verifier for 20m? … it now looks like a bigger problem»
- clio read the load (`uptime`, `ps`): ~10–15 `claude plugin test` children at once, the sixth sense's range walk behind them
- clio's first answer was a queue and the per-commit walk cut, the same postpone-shaped fix as before; dima, 20:16: «I think the problem isn't solved because you just postponed the problem»

## how the solution was found

- dima set the door at 20:32: a cpu roast from tests is a critical failure, and its fix door is the external search first (similar symptoms, existing solutions, gh issues)
- three research lanes ran on one brief (`.scratch/mods-tests-cpu/brief.md`): exa and parallel on the web, a researcher on cc's own docs, binary and issues. they found the per-test reload (#106331) and the missing cap (#108931), both open upstream with others hitting the same wall; one test file timed at 0.75 s wall, 0.66 s cpu
- a messhunter read our 76 test files from a tester's angle: the guard's 24 files, the 7 pure stash files on the host, the dead test, the long polls; about half the host boots could go
- the fleet weighed it, on dima's ask: crow, wing 1, the mods codie, its sixth sense and the stray each answered the draft; the mods codie's data moved the weights most (the push door, not the range walk, was the steady burner)
- our numbers went upstream as comments on #108931 and #106331

## what changed (20 Nov)

- `x mods edit test --range` runs the whole suite at the head only, each earlier commit its touched files (the stray, 49700466); a 3-commit range on one mod costs 7.8 cpu-s
- the sixth sense's skill: a mods suite runs whole at the head only
- `rules/fleet-hazards.md` § test cpu: a cpu roast from tests is a critical failure, the outside search first
- the plan, ticked by dima for the mods lane's next chunk: `.scratch/mods-tests-cpu/plan.md` — a push runs the tests its diff reaches, pure logic on vitest, the dead tests gone, a fixed cpu cap per mod that only his tick raises, and four `mods/AGENTS.md` test lines whose checks land in the same chunk (`.scratch/mods-tests-cpu/agents-md-proposal.md`)

## what landed (23 Nov, FRM-678 and FRM-688)

- one whole x-mod-stash run: 447.67 → 169.85 cpu-s (user + sys, one run each inside `gate-queue.sh --long`, 10:33 and 13:19), −62 %; all 1,901 rows of the first run still present by name, 23 new
- the cause 1 fix: the rows of one test file share one host start (`tests/shared-boot.ts`), so x-mod-stash starts the host 52 times a whole run, where almost every one of its ~1,900 rows did before
- the caps, in `script/test-cpu-budget.tsv`: x-mod-stash 187 cpu-s, x-mod-guard 15, x-mod-holds 2, x-mod-redact 2; a whole run past its row is red
- `boots.tsv` counts host starts per test file and per mod with no run; the commit reds a file past its row, a file with no row, a start in a loop
- a raise of either table stands only on dima's tick (4fd1c3f2, after clio let a cap rise 187 → 195 unasked the same day)
- a commit runs no mods suite; a whole suite takes the long turn alone, at a 1-minute load of 14 or under
- not read yet: a day of lane work under the new shape (FRM-678's exit 7, 24 Nov)
- not covered: the caps hold the four mods and x's go suite; frame's and bytes' vitest suites have no cpu row

## the gains (23 Nov)

- 🟢 −277.8 cpu-s a whole stash run, 447.7 → 169.9, and its wall 59.9 → 30.1 s
- 🟢 a commit runs no mods suite; before, a commit could run all four mods whole (2,805 rows, seen 23 Nov 11:08)
- 🟢 the cost can no longer grow unseen: a run past its cpu row is red, a test file past its host starts is refused at commit
- 🟡 the mac under a mods lane: load 4.6 with five members alive at 23 Nov 15:01 against 34–44 on 20 Nov; one moment, the day read is FRM-678's exit 7

## why it appeared, in one breath

a tool default nobody questioned (one fresh host per test), a rule of ours that sent even pure logic through that tool, whole suites at every door, and no number anywhere that would turn red. each new test was cheap alone and the sum was never read.

## lessons

1. **a cost with no red number grows until dima feels it.** every whole suite that can fill the mac carries a fixed cpu row that reds on its own; a raise is his tick
2. **when a load is seen, ask first whether the work is shaped wrong**, before any queue, stagger or later run. moving a cost is not a fix; clio proposed moving it for two weeks
3. **a cpu roast's fix door is the outside first**: the per-test reload and the missing cap were both open upstream issues, found in one evening once looked for
4. **a log line that repeats is a signal.** «timed-out files ran again» stood in the log on six days and was read by nobody
5. **a new verb that runs a suite carries its cost line at the sign.** the range walk was signed with none and ran 22 whole suites
6. **the shape is counted without a run**: host starts per test file are read from the files, so a wrongly shaped test is refused at its first commit, before it costs anything

## the line that keeps it away

a cost that grows without anyone saying so is the failure, more than the cost itself: a whole test suite has a fixed cpu cap that reds on its own, so the next creep is named the day it starts, never found by dima two weeks later.
