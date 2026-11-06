# Gate wait from session transcripts

Window: transcripts under ~/.claude/projects/*/*.jsonl modified in the last 7 days (top-level session files only, subagent files excluded): 95 sessions with Bash calls, 20869 Bash calls, 3799 classified as gates.
Groups: coordinator = project dir -Users-dima-frame--clio; probe = dirs containing claude-jobs (scratch probes); coding = everything else. Group is inferred from the project dir, not measured.
Classification (heuristic, inferred): each command is split on && || ; | newline and a class matches only when the segment opens with the command words, so prose mentions in commit messages or greps do not count. A call with several classes is counted once under the first of: commit, push, red-proof, mods-edit, mods-test, mutants, go-test, vitest/test, typecheck (red-proof is ahead of mods-edit/mods-test, because it wraps them). A compound call's whole duration lands on that one class.
Durations: foreground = tool_result timestamp minus tool_use timestamp (includes any permission prompt wait). Background = task-notification timestamp (matched on tool-use-id, then task id) minus tool_use timestamp. Calls with no end are untimed.

## Pairing
- all: 3799 gate calls; foreground 3619 (untimed 1); background 180, paired to a notification 102, not paired 78
- coding: 2575 gate calls; foreground 2434 (untimed 1); background 141, paired to a notification 82, not paired 59
- coordinator: 1224 gate calls; foreground 1185 (untimed 0); background 39, paired to a notification 20, not paired 19
- probe: 0 gate calls; foreground 0 (untimed 0); background 0, paired to a notification 0, not paired 0

## 1. Per class (foreground and background together)
### all
- commit: n=1179 (timed 1169), p50 37.0s, p90 72.6s, max 1729.6s, sum 814.8 min
  - of which foreground 1128 (n=1128 (timed 1128), p50 36.8s, p90 69.5s, max 246.4s, sum 686.9 min); background 51 (n=51 (timed 41), p50 77.5s, p90 436.8s, max 1729.6s, sum 127.9 min)
- push: n=240 (timed 236), p50 31.6s, p90 42.7s, max 575.7s, sum 157.4 min
  - of which foreground 222 (n=222 (timed 222), p50 31.6s, p90 40.1s, max 177.2s, sum 111.1 min); background 18 (n=18 (timed 14), p50 57.4s, p90 574.8s, max 575.7s, sum 46.3 min)
- red-proof: n=227 (timed 217), p50 31.5s, p90 390.8s, max 1620.7s, sum 467.9 min
  - of which foreground 184 (n=184 (timed 184), p50 21.9s, p90 272.0s, max 590.8s, sum 273.6 min); background 43 (n=43 (timed 33), p50 283.4s, p90 659.4s, max 1620.7s, sum 194.2 min)
- mods-edit: n=1309 (timed 1306), p50 17.0s, p90 34.5s, max 352.6s, sum 371.2 min
  - of which foreground 1299 (n=1299 (timed 1299), p50 16.9s, p90 34.2s, max 352.6s, sum 359.0 min); background 10 (n=10 (timed 7), p50 99.9s, p90 242.3s, max 242.3s, sum 12.2 min)
- mods-test: n=326 (timed 310), p50 14.3s, p90 83.6s, max 1041.0s, sum 182.6 min
  - of which foreground 278 (n=278 (timed 278), p50 10.4s, p90 62.1s, max 601.2s, sum 118.5 min); background 48 (n=48 (timed 32), p50 84.5s, p90 243.0s, max 1041.0s, sum 64.1 min)
- mutants: n=27 (timed 24), p50 0.4s, p90 2.0s, max 16.8s, sum 0.5 min
  - of which foreground 23 (n=23 (timed 23), p50 0.4s, p90 2.0s, max 16.8s, sum 0.5 min); background 4 (n=4 (timed 1), p50 0.1s, p90 0.1s, max 0.1s, sum 0.0 min)
- go-test: n=74 (timed 74), p50 8.9s, p90 37.5s, max 585.2s, sum 31.3 min
  - of which foreground 73 (n=73 (timed 73), p50 8.4s, p90 33.2s, max 167.2s, sum 21.6 min); background 1 (n=1 (timed 1), p50 585.2s, p90 585.2s, max 585.2s, sum 9.8 min)
- vitest/test: n=398 (timed 395), p50 1.5s, p90 11.2s, max 104.8s, sum 41.7 min
  - of which foreground 394 (n=394 (timed 393), p50 1.5s, p90 10.7s, max 104.8s, sum 39.9 min); background 4 (n=4 (timed 2), p50 93.3s, p90 93.3s, max 93.3s, sum 1.8 min)
- typecheck: n=19 (timed 19), p50 1.1s, p90 19.9s, max 86.4s, sum 2.9 min
  - of which foreground 18 (n=18 (timed 18), p50 1.1s, p90 19.9s, max 19.9s, sum 1.5 min); background 1 (n=1 (timed 1), p50 86.4s, p90 86.4s, max 86.4s, sum 1.4 min)
### coding
- commit: n=490 (timed 487), p50 51.1s, p90 97.7s, max 1729.6s, sum 485.6 min
  - of which foreground 466 (n=466 (timed 466), p50 49.2s, p90 84.8s, max 246.4s, sum 368.1 min); background 24 (n=24 (timed 21), p50 177.0s, p90 1000.9s, max 1729.6s, sum 117.5 min)
- push: n=37 (timed 34), p50 28.0s, p90 526.7s, max 575.7s, sum 56.9 min
  - of which foreground 22 (n=22 (timed 22), p50 12.7s, p90 59.8s, max 177.2s, sum 11.1 min); background 15 (n=15 (timed 12), p50 177.9s, p90 574.8s, max 575.7s, sum 45.8 min)
- red-proof: n=213 (timed 203), p50 31.9s, p90 393.0s, max 1620.7s, sum 456.8 min
  - of which foreground 170 (n=170 (timed 170), p50 21.7s, p90 280.6s, max 590.8s, sum 262.5 min); background 43 (n=43 (timed 33), p50 283.4s, p90 659.4s, max 1620.7s, sum 194.2 min)
- mods-edit: n=1283 (timed 1280), p50 17.1s, p90 34.2s, max 352.6s, sum 363.3 min
  - of which foreground 1273 (n=1273 (timed 1273), p50 17.1s, p90 34.0s, max 352.6s, sum 351.1 min); background 10 (n=10 (timed 7), p50 99.9s, p90 242.3s, max 242.3s, sum 12.2 min)
- mods-test: n=298 (timed 282), p50 17.0s, p90 74.2s, max 601.2s, sum 147.4 min
  - of which foreground 258 (n=258 (timed 258), p50 13.5s, p90 62.2s, max 601.2s, sum 114.0 min); background 40 (n=40 (timed 24), p50 98.3s, p90 174.9s, max 284.6s, sum 33.4 min)
- mutants: n=7 (timed 4), p50 0.2s, p90 1.4s, max 1.4s, sum 0.0 min
  - of which foreground 3 (n=3 (timed 3), p50 0.2s, p90 1.4s, max 1.4s, sum 0.0 min); background 4 (n=4 (timed 1), p50 0.1s, p90 0.1s, max 0.1s, sum 0.0 min)
- go-test: n=70 (timed 70), p50 9.3s, p90 39.7s, max 585.2s, sum 30.9 min
  - of which foreground 69 (n=69 (timed 69), p50 8.9s, p90 37.5s, max 167.2s, sum 21.2 min); background 1 (n=1 (timed 1), p50 585.2s, p90 585.2s, max 585.2s, sum 9.8 min)
- vitest/test: n=167 (timed 164), p50 3.3s, p90 20.0s, max 93.3s, sum 25.4 min
  - of which foreground 163 (n=163 (timed 162), p50 3.3s, p90 18.5s, max 88.4s, sum 23.6 min); background 4 (n=4 (timed 2), p50 93.3s, p90 93.3s, max 93.3s, sum 1.8 min)
- typecheck: n=10 (timed 10), p50 2.1s, p90 19.9s, max 19.9s, sum 1.1 min
### coordinator
- commit: n=689 (timed 682), p50 25.7s, p90 57.5s, max 183.7s, sum 329.2 min
  - of which foreground 662 (n=662 (timed 662), p50 24.5s, p90 57.5s, max 183.7s, sum 318.8 min); background 27 (n=27 (timed 20), p50 27.3s, p90 77.5s, max 88.0s, sum 10.4 min)
- push: n=203 (timed 202), p50 31.6s, p90 39.2s, max 78.6s, sum 100.6 min
  - of which foreground 200 (n=200 (timed 200), p50 31.6s, p90 39.3s, max 78.6s, sum 100.0 min); background 3 (n=3 (timed 2), p50 30.5s, p90 30.5s, max 30.5s, sum 0.5 min)
- red-proof: n=14 (timed 14), p50 26.9s, p90 154.7s, max 231.0s, sum 11.1 min
- mods-edit: n=26 (timed 26), p50 1.4s, p90 76.6s, max 114.1s, sum 7.9 min
- mods-test: n=28 (timed 28), p50 2.6s, p90 243.0s, max 1041.0s, sum 35.1 min
  - of which foreground 20 (n=20 (timed 20), p50 2.3s, p90 20.5s, max 191.8s, sum 4.5 min); background 8 (n=8 (timed 8), p50 84.5s, p90 1041.0s, max 1041.0s, sum 30.7 min)
- mutants: n=20 (timed 20), p50 0.4s, p90 3.2s, max 16.8s, sum 0.5 min
- go-test: n=4 (timed 4), p50 6.5s, p90 11.8s, max 11.8s, sum 0.4 min
- vitest/test: n=231 (timed 231), p50 1.3s, p90 6.0s, max 104.8s, sum 16.3 min
- typecheck: n=9 (timed 9), p50 1.1s, p90 86.4s, max 86.4s, sum 1.8 min
  - of which foreground 8 (n=8 (timed 8), p50 1.1s, p90 11.1s, max 11.1s, sum 0.3 min); background 1 (n=1 (timed 1), p50 86.4s, p90 86.4s, max 86.4s, sum 1.4 min)
### probe

## Gate queue
- all: 11 of 3799 gate commands name gate-queue in the command; 2 show a gate-queue line in the result; 1 show a wait (sum 4.0 min, p50 238.0s, max 238.0s)
- coding: 6 of 2575 gate commands name gate-queue in the command; 2 show a gate-queue line in the result; 1 show a wait (sum 4.0 min, p50 238.0s, max 238.0s)
- coordinator: 5 of 1224 gate commands name gate-queue in the command; 0 show a gate-queue line in the result; 0 show a wait (sum 0.0 min, p50 n/as, max n/as)
- probe: 0 of 0 gate commands name gate-queue in the command; 0 show a gate-queue line in the result; 0 show a wait (sum 0.0 min, p50 n/as, max n/as)
- all Bash calls, any class: 95 name gate-queue, 18 show a wait; wait seconds: 18, 18, 24, 28, 40, 44, 50, 78, 78, 112, 158, 238, 248, 248, 268, 506, 948, 1116
- Background results are not in the transcript (the output sits in a task file), so a queue wait inside a background call is invisible here: the wait count is a floor.

## 2. 15 longest commits (all groups)
- d7eef112 11-05 18:43Z 1730s bg [coding] S=/private/tmp/claude-501/-Users-dima-frame/d7eef112-7cfe-4392-8e37-7b22a7426153
- d7eef112 11-05 19:22Z 1073s bg [coding] S=/private/tmp/claude-501/-Users-dima-frame/d7eef112-7cfe-4392-8e37-7b22a7426153
- d7eef112 11-05 17:53Z 1001s bg [coding] S=/private/tmp/claude-501/-Users-dima-frame/d7eef112-7cfe-4392-8e37-7b22a7426153
- d7eef112 11-05 21:10Z 482s bg [coding] # deadline: 4 min, red-proof, then a 7 min commit gate S=/private/tmp/claude-501
- d7eef112 11-05 19:12Z 437s bg [coding] S=/private/tmp/claude-501/-Users-dima-frame/d7eef112-7cfe-4392-8e37-7b22a7426153
- d7eef112 11-05 20:45Z 319s bg [coding] # deadline: 7 min, the gate runs in the commit S=/private/tmp/claude-501/-Users-
- d7eef112 11-05 18:17Z 284s bg [coding] S=/private/tmp/claude-501/-Users-dima-frame/d7eef112-7cfe-4392-8e37-7b22a7426153
- c7a7ba63 11-04 13:59Z 246s fg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-
- c7a7ba63 11-04 14:12Z 242s bg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-
- c7a7ba63 11-04 13:49Z 242s fg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-
- d7eef112 11-05 21:20Z 240s bg [coding] # deadline: 2 min red-proof, then a 7 min commit gate S=/private/tmp/claude-501/
- c7a7ba63 11-04 13:28Z 233s fg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-
- c7a7ba63 11-04 13:44Z 212s fg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-
- d7eef112 11-05 17:49Z 207s bg [coding] S=/private/tmp/claude-501/-Users-dima-frame/d7eef112-7cfe-4392-8e37-7b22a7426153
- c7a7ba63 11-04 13:20Z 188s fg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-

## 2. 15 longest red-proofs (all groups)
- 0f9b420c 11-06 13:06Z 1621s bg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/0f9b420c-8c31-
- 0f9b420c 11-06 13:44Z 1319s bg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/0f9b420c-8c31-
- 0f9b420c 11-06 15:42Z 842s bg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/0f9b420c-8c31-
- 0f9b420c 11-06 14:20Z 659s bg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/0f9b420c-8c31-
- 0cf56902 11-04 13:27Z 611s bg [coding] cd ~/frame/.claude/worktrees/verify-d380f5f; F=home/.claude/plugin-x/mods/x-mod-
- 0cf56902 11-04 09:25Z 591s fg [coding] F=home/.claude/plugin-x/mods/x-mod-stash; rm_probe() { :; }; mv $F/tests/zzprobe
- 8cfae24d 11-03 11:39Z 590s fg [coding] S=/private/tmp/claude-501/-Users-dima-frame/8cfae24d-2a54-46c7-bafa-09f38f49157c
- 8cfae24d 11-03 11:39Z 590s fg [coding] S=/private/tmp/claude-501/-Users-dima-frame/8cfae24d-2a54-46c7-bafa-09f38f49157c
- 8cfae24d 11-03 11:39Z 590s fg [coding] S=/private/tmp/claude-501/-Users-dima-frame/8cfae24d-2a54-46c7-bafa-09f38f49157c
- 8cfae24d 11-03 11:39Z 590s fg [coding] S=/private/tmp/claude-501/-Users-dima-frame/8cfae24d-2a54-46c7-bafa-09f38f49157c
- 8cfae24d 11-03 11:39Z 590s fg [coding] S=/private/tmp/claude-501/-Users-dima-frame/8cfae24d-2a54-46c7-bafa-09f38f49157c
- 0f9b420c 11-06 14:49Z 519s bg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/0f9b420c-8c31-
- d7eef112 11-05 19:58Z 507s bg [coding] # deadline: 15 min, two red-proof runs S=/private/tmp/claude-501/-Users-dima-fra
- 0f9b420c 11-06 13:36Z 478s bg [coding] cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/0f9b420c-8c31-
- 8cfae24d 11-03 10:22Z 444s fg [coding] S=/private/tmp/claude-501/-Users-dima-frame/8cfae24d-2a54-46c7-bafa-09f38f49157c

## 3. Ten sessions with the most gate time
Span = first to last message timestamp minus every gap longer than 30 min. Gate minutes = union of call intervals (parallel calls counted once). fg = the agent was blocked; bg = it could work on. A background interval may cross a removed gap, so percent can pass 100.
- d7eef112 [coding] span 575.6 min; fg gates 52.5 min (9.1%); bg gates 201.5 min (35.0%)
- 0f9b420c [coding] span 268.0 min; fg gates 18.9 min (7.1%); bg gates 123.4 min (46.0%)
- 6aa1af14 [coding] span 425.2 min; fg gates 123.7 min (29.1%); bg gates 15.1 min (3.5%)
- c7a7ba63 [coding] span 317.8 min; fg gates 123.1 min (38.7%); bg gates 10.1 min (3.2%)
- 8cfae24d [coding] span 494.5 min; fg gates 117.0 min (23.7%); bg gates 0.0 min (0.0%)
- 96392cd0 [coordinator] span 529.5 min; fg gates 80.0 min (15.1%); bg gates 0.0 min (0.0%)
- 668daff8 [coordinator] span 602.8 min; fg gates 62.9 min (10.4%); bg gates 0.0 min (0.0%)
- 9939ff19 [coordinator] span 645.2 min; fg gates 17.8 min (2.8%); bg gates 42.4 min (6.6%)
- e1ac9b71 [coordinator] span 539.9 min; fg gates 55.3 min (10.2%); bg gates 0.0 min (0.0%)
- 0cf56902 [coding] span 217.5 min; fg gates 19.9 min (9.1%); bg gates 22.5 min (10.4%)
- Coding sessions with a gate and span >= 30 min (28): fg gate 584.8 min of 7015.3 min span = 8.3%; bg gate 397.4 min = 5.7%
  - per-session fg percent: p50 3.9, p90 23.7, max 38.7

## 4. Red-proof runs
- timed red-proof calls: 217 (33 background); single plain invocations 122; with --pairs 59; compound (more than one red-proof invocation) 59
- single invocations naming a test file: 30, mean 19.3s, p50 8.0s, p90 56.7s
  - script/siesta-gate.test.ts: 4 runs, mean 10.0s
  - probe.test.ts: 3 runs, mean 0.2s
  - tests/waker.test.ts: 2 runs, mean 21.1s
  - reply-check.test.ts: 2 runs, mean 5.0s
  - script/helga-receipt.test.ts: 2 runs, mean 5.0s
  - script/siesta-checks.test.ts: 2 runs, mean 9.4s
  - tests/fields.test.ts: 1 runs, mean 0.4s
  - tests/orbit.test.ts: 1 runs, mean 0.5s
- --pairs single-invocation calls: 36; pair count recoverable for 31 (inferred: tab characters in the command, or lines of the pairs file when it still exists)
  - pairs per run: p50 1, max 14; mean run 168.4s; seconds per pair: p50 33.3, p90 154.4
  - 1-2 pairs: 24 runs, mean 82.2s, mean per pair 64.0s
  - 3-5 pairs: 1 runs, mean 170.3s, mean per pair 56.8s
  - 6-100 pairs: 6 runs, mean 513.1s, mean per pair 63.8s

## 5. Commits per active hour (coding sessions)
- coding sessions with active span >= 30 min: total 485 commit calls in 165.5 active hours = 2.9 per hour overall
- among those with at least one commit (17): per-session p50 2.3, p90 13.5, max 25.0 per hour
- operator claim check: coding commit mean 59.8s (p50 51.1s) so 10 commits = 10.0 min measured against the claimed 30 min

## Pairing sanity check (3 hand-picked calls)
Each call was re-found by grepping the raw jsonl for its tool_use id and reading the timestamps of the matching lines directly, independent of the pairing code.
- 38d42581 commit fg "x lane commit .scratch/msg-merge.txt -- ": script 72.8s; raw lines with the id: message@2026-11-05T16:38:28.034Z, user@2026-11-05T16:39:40.810Z, tool_result@undefined
- f8e65f81 mods-test bg "J=/Users/dima/.claude/jobs/f8e65f81/tmp;": script 98.3s; raw lines with the id: message@2026-11-03T12:02:29.768Z, user@2026-11-03T12:02:29.842Z, tool_use@undefined, tool_result@undefined, undefined@2026-11-03T12:04:08.053Z, user@2026-11-03T12:04:08.062Z, undefined@undefined
- 6ea41d80 typecheck fg "T=$CLAUDE_JOB_DIR/tmp; cut -c1-200 $T/mu": script 2.1s; raw lines with the id: message@2026-11-06T16:24:19.767Z, user@2026-11-06T16:24:21.917Z, hook_additional_context@2026-11-06T16:24:21.941Z
