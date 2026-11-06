# Commit gate stats

- generated 2026-11-06 19:01:55 local time; logs found: 608; pre-commit runs parsed: 19; commit-msg runs skipped: 2
- logs with NO lefthook header (no `hook:` line): 589; these hold test-fixture text such as `some-check (skip)`, `(1 seconds)`, `a row [5002.31ms]`, not real runs; mtime range 2026-11-06 15:35:25 to 2026-11-06 19:01:40; excluded from every number below (names: `ls x-commit-*.log` minus the ones with `hook:`)
- real logs with a header whose run the parser could not read: 0
- parser: ANSI stripped, runs split on `hook:`; gates read only from lines after the last `summary:` line, strict shape `(✔️|🥊) name (N seconds)`; the minute shape `N minute(s) M seconds` is supported, none seen
- time of a commit = file mtime (end of the whole log, so mtime - total is slightly late for pre-commit logs that also hold a commit-msg run)

## 1. Range and failures
- range: 2026-11-06 15:39:24 to 2026-11-06 19:01:07
- pre-commit runs 19, failed 17
- failed gate counts (a run can fail more than one gate):
  - memory-lint: 11
  - test: 8
  - mods: 1

## 2 and 3. All runs: total and per gate
- runs 19, failed 17 (89.5%)
- total wall: p50 0.26 min, p90 1.40, p99 2.22, max 2.22, sum 11.01 (seconds: p50 15.8, p90 84.0, p99 133.2, max 133.2)
- gate seconds summed 16.29 min vs wall sum 11.01 min: lefthook runs gates in parallel, so the total is wall time and gate sums exceed it
- per gate, by sum:
  - test: count 19, red 8, p50 15.85s, p90 64.84s, max 84.00s, sum 8.27 min, share 50.8%
  - mods-test: count 4, red 0, p50 42.74s, p90 133.21s, max 133.21s, sum 4.41 min, share 27.1%
  - mods: count 4, red 1, p50 24.88s, p90 27.48s, max 27.48s, sum 1.48 min, share 9.1%
  - typecheck: count 19, red 0, p50 2.19s, p90 15.57s, max 16.79s, sum 1.32 min, share 8.1%
  - replaced-doors: count 2, red 0, p50 7.51s, p90 8.49s, max 8.49s, sum 0.27 min, share 1.6%
  - format: count 11, red 0, p50 0.83s, p90 1.64s, max 2.17s, sum 0.18 min, share 1.1%
  - retired-names: count 19, red 0, p50 0.38s, p90 1.60s, max 1.96s, sum 0.15 min, share 0.9%
  - memory-lint: count 19, red 11, p50 0.25s, p90 1.20s, max 1.32s, sum 0.13 min, share 0.8%
  - git-crypt-rename: count 19, red 0, p50 0.11s, p90 0.76s, max 0.79s, sum 0.06 min, share 0.4%

## 4a. Last 24 hours
- runs 19, failed 17 (89.5%)
- total wall: p50 0.26 min, p90 1.40, p99 2.22, max 2.22, sum 11.01 (seconds: p50 15.8, p90 84.0, p99 133.2, max 133.2)
- gate seconds summed 16.29 min vs wall sum 11.01 min: lefthook runs gates in parallel, so the total is wall time and gate sums exceed it
- per gate, by sum:
  - test: count 19, red 8, p50 15.85s, p90 64.84s, max 84.00s, sum 8.27 min, share 50.8%
  - mods-test: count 4, red 0, p50 42.74s, p90 133.21s, max 133.21s, sum 4.41 min, share 27.1%
  - mods: count 4, red 1, p50 24.88s, p90 27.48s, max 27.48s, sum 1.48 min, share 9.1%
  - typecheck: count 19, red 0, p50 2.19s, p90 15.57s, max 16.79s, sum 1.32 min, share 8.1%
  - replaced-doors: count 2, red 0, p50 7.51s, p90 8.49s, max 8.49s, sum 0.27 min, share 1.6%
  - format: count 11, red 0, p50 0.83s, p90 1.64s, max 2.17s, sum 0.18 min, share 1.1%
  - retired-names: count 19, red 0, p50 0.38s, p90 1.60s, max 1.96s, sum 0.15 min, share 0.9%
  - memory-lint: count 19, red 11, p50 0.25s, p90 1.20s, max 1.32s, sum 0.13 min, share 0.8%
  - git-crypt-rename: count 19, red 0, p50 0.11s, p90 0.76s, max 0.79s, sum 0.06 min, share 0.4%

## 4b. Last 7 days
- runs 19, failed 17 (89.5%)
- total wall: p50 0.26 min, p90 1.40, p99 2.22, max 2.22, sum 11.01 (seconds: p50 15.8, p90 84.0, p99 133.2, max 133.2)
- gate seconds summed 16.29 min vs wall sum 11.01 min: lefthook runs gates in parallel, so the total is wall time and gate sums exceed it
- per gate, by sum:
  - test: count 19, red 8, p50 15.85s, p90 64.84s, max 84.00s, sum 8.27 min, share 50.8%
  - mods-test: count 4, red 0, p50 42.74s, p90 133.21s, max 133.21s, sum 4.41 min, share 27.1%
  - mods: count 4, red 1, p50 24.88s, p90 27.48s, max 27.48s, sum 1.48 min, share 9.1%
  - typecheck: count 19, red 0, p50 2.19s, p90 15.57s, max 16.79s, sum 1.32 min, share 8.1%
  - replaced-doors: count 2, red 0, p50 7.51s, p90 8.49s, max 8.49s, sum 0.27 min, share 1.6%
  - format: count 11, red 0, p50 0.83s, p90 1.64s, max 2.17s, sum 0.18 min, share 1.1%
  - retired-names: count 19, red 0, p50 0.38s, p90 1.60s, max 1.96s, sum 0.15 min, share 0.9%
  - memory-lint: count 19, red 11, p50 0.25s, p90 1.20s, max 1.32s, sum 0.13 min, share 0.8%
  - git-crypt-rename: count 19, red 0, p50 0.11s, p90 0.76s, max 0.79s, sum 0.06 min, share 0.4%

## 5. 15 slowest pre-commit runs
- 2026-11-06 16:51:31: 133.2s (2.22 min) FAILED; top: mods-test 133.2s, mods 24.9s, test 23.7s (red); biome checked 3 files
- 2026-11-06 18:00:24: 84.0s (1.40 min) FAILED; top: test 84.0s (red), typecheck 8.8s, memory-lint 1.2s; staged area not shown in log
- 2026-11-06 18:01:02: 64.8s (1.08 min) FAILED; top: test 64.8s (red), typecheck 16.8s, format 2.2s; biome checked 1 files
- 2026-11-06 17:57:18: 62.8s (1.05 min) FAILED; top: test 62.8s (red), typecheck 15.6s, retired-names 2.0s; biome checked 1 files
- 2026-11-06 17:06:40: 52.3s (0.87 min); top: mods-test 52.3s, test 29.7s, mods 27.5s; biome checked 7 files
- 2026-11-06 19:01:07: 42.7s (0.71 min) FAILED; top: mods-test 42.7s, mods 27.0s, test 26.0s (red); biome checked 5 files
- 2026-11-06 16:32:26: 36.6s (0.61 min) FAILED; top: mods-test 36.6s, test 21.3s, mods 9.4s (red); biome checked 3 files
- 2026-11-06 15:52:49: 21.9s (0.37 min) FAILED; top: test 21.9s (red), typecheck 4.0s, format 1.3s; biome checked 2 files
- 2026-11-06 18:15:28: 17.1s (0.29 min) FAILED; top: test 17.1s, typecheck 2.1s, memory-lint 0.3s (red); staged area not shown in log
- 2026-11-06 16:51:25: 15.8s (0.26 min) FAILED; top: test 15.8s, replaced-doors 7.5s, typecheck 2.2s; staged area not shown in log
- 2026-11-06 18:15:36: 15.6s (0.26 min) FAILED; top: test 15.6s (red), typecheck 3.7s, format 0.7s; biome checked 1 files
- 2026-11-06 15:39:24: 15.5s (0.26 min) FAILED; top: test 15.5s (red), typecheck 2.6s, memory-lint 0.9s (red); biome checked 3 files
- 2026-11-06 16:50:57: 15.4s (0.26 min) FAILED; top: test 15.4s, replaced-doors 8.5s, typecheck 2.1s; staged area not shown in log
- 2026-11-06 16:42:23: 14.6s (0.24 min) FAILED; top: test 14.6s, typecheck 1.8s, memory-lint 0.1s (red); staged area not shown in log
- 2026-11-06 18:53:16: 14.0s (0.23 min); top: test 14.0s, typecheck 2.1s, retired-names 0.5s; biome checked 1 files

## 6. Commits per hour (local time) and overlap
- runs overlapping at least one other run (mtime-total to mtime): 7 of 19
- max simultaneous runs: 2
- busiest 5 hours:
  - 2026-11-06 16:00: 8 runs, 3 overlapped another run
  - 2026-11-06 18:00: 6 runs, 4 overlapped another run
  - 2026-11-06 15:00: 2 runs, 0 overlapped another run
  - 2026-11-06 17:00: 2 runs, 0 overlapped another run
  - 2026-11-06 19:00: 1 runs, 0 overlapped another run

## 7. Test timeouts (case-insensitive "timed out", all logs)
- logs containing it: 7; matching lines: 12
- lines with no test file nearby (bun-style "timed out after 5000 ms"): 0
- test files named:
  - script/lib/clio-watch.test.ts: 6
  - script/lib/index-run.test.ts: 4
  - _clio/script/siesta-checks.test.ts: 1
  - _clio/script/wish-cover-on-write.test.ts: 1

## 8. mods-test.log
- rows 192, rows with fewer than 4 columns: 0
- rows whose result mentions a duration: 0 (0 means the log holds no durations)
- range: 2026-11-05T16:59:23.608Z to 2026-11-06T17:01:06.979Z
- per day (UTC date): runs, red:
  - 2026-11-05: 80 runs, 14 red
  - 2026-11-06: 112 runs, 31 red
- total red 45 of 192
- result shapes seen:
  - 103x mods:test: N mods green, N pass, N fail
  - 26x mods:test: red in x-mod-guard, N pass, N fail
  - 23x mods:test: N mods green, N pass, N fail (timed-out files ran again)
  - 16x mods:test: N mods green, N pass, N fail, N skipped on tested bytes
  - 7x mods:test: red in x-mod-stash, N pass, N fail (timed-out files ran again)
  - 6x mods:test: red in x-mod-stash, N pass, N fail
  - 2x mods:test: red in x-mod-redact (no tally), N pass, N fail
  - 2x mods:test: red in x-mod-redact, N pass, N fail (timed-out files ran again)
