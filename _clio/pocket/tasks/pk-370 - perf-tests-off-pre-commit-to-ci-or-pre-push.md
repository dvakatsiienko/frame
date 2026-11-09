---
id: PK-370
title: 'perf: tests off pre-commit, to ci or pre-push'
status: open
assignee: []
created_date: '2026-11-09T12:39:00Z'
updated_date: '2026-11-09T12:39:00Z'
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
<!-- SECTION:NOTES:END -->
