---
id: PK-370
title: 'perf: tests off pre-commit, to ci or pre-push'
status: done
assignee: []
created_date: '2026-11-09T12:39:00Z'
updated_date: '2026-11-09T19:26:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 52000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-370:W1 (2026-11-09 inbox, dima): move tests to ci only? how much faster would it be to run tests only on ci? e.g. disconnect tests from pre-commit entirely, run tests by hand only when writing tests, and when all is done, slay and wait for tests on ci: saves a large amount of test runs during commit gates, runs tests once or a few times on ci

PK-370:W2 (2026-11-09 inbox, dima): or move to pre-push? would this work? ❓

PK-370:W3 (2026-11-09 inbox, dima): i think running tests on each commit is overkill. or does this approach act as an enforcement lever to get codies to actually write tests? propose how to rebalance, to reduce test-run occasions; test runs are expensive on my machine

raw drop (2026-11-09 inbox, dima): **wing1: roasted cpu idea**

raw drop (2026-11-09 inbox, dima): move tests to ci only? test, how much faster it would be by only running tests on ci? for example: disconnect test from pre-commit entirely. run tests by hand only when writing tests. when all done — slay — and wait for tests on CI. (saves time of a large qty and time of test runs during cmt gates, run tests single/few times on ci instead)? or move to pre-push? would this work?

raw drop (2026-11-09 inbox, dima): i think running tests on each commit is overkill. or this approach acts as enforcement lever for codies to actually write tests? propose how to rebalance, to reduce test run occasions. tests runs are expensive on my machine.

PK-370:W4 (2026-11-09 inbox, dima): how much faster would tests on ci only be, and would pre-push work? ❓

PK-370:W5 (2026-11-09 21:17, dima): then-#11 (FRM-525) yank #10 (speak app v2 from wing 2 to your flyway)

PK-370:W6 (2026-11-09 21:17, dima): q3. maybe vm lane can fully finish its part, then codie SW and start PK-370? ❓

PK-370:W7 (2026-11-09 21:17, dima): so, fully offloading this test question to push hook isn't the solution because push hook itself is very long, right? ❓

PK-370:W8 (2026-11-09 21:17, dima): how many numbers did you print in seconds? print in minutes and seconds. ❓

PK-370:W9 (2026-11-09 21:17, dima): what do you think about removing tests from push and pre-commit at all, fully, and only running tests in CI, or is it unreliable and will just cause more back and forth? ❓

PK-370:W10 (2026-11-09 21:17, dima): what i was thinking: remove tests from pre-commit and pre-push entirely, then slay and wait for CI. then the coder sees if CI fails and fixes, patches, and tests locally. rule: if the CI tests fail, the coder may run tests locally by hand while adjusting them and fixing tests or code. then slay again and have a green CI.

PK-370:W11 (2026-11-09 21:17, dima): in this setup no tests run locally via hooks at all, only manually when CI tests fail to fix them. how do you think it will work, or does it not make sense and is impossible because more stuff gets skipped and more back and forth? ❓

PK-370:W12 (2026-11-09 21:17, dima): think especially well on this. i know moving tests out of hooks is a risky move because it removes a guard in an important place. i also don't like the time the hooks and tests take. it slows everyone down a lot, so i am evaluating the trade-offs.

PK-370:W13 (2026-11-09 21:17, dima): turbo repo caching: i asked before if it can help or if another caching solution fits better, because you said it is tricky and does not connect directly to what we have now. revisit it and think twice: could turbo repo also save on tests? by caching them and replaying the turbo repo cache for tests, will it help? ❓

2026-11-09 21:20 wing 1: W6 settled — PK-370 joins the vm lane after FRM-551, codie second-winds between (o69 changed). W7–W13 answered in thread 21:20: ci-only take (main's ci red 3 of 6, direct main pushes spread a red), turbo adds nothing past FRM-533 step 2; the pick is orbit o70. W5 asked as o71.

ticket: FRM-557

close: PK-370:W1–W3 → FRM-557:W1–W3; PK-370:W4 answered in FRM-557 why; PK-370:W5 done on PK-346 (flyway); PK-370:W6 → FRM-557 decided (vm lane after FRM-551); PK-370:W7–W11 answered 21:20, decided b/b (o70); PK-370:W12 → FRM-557:W4; PK-370:W13 → FRM-557 decided (turbo)
<!-- SECTION:NOTES:END -->
