---
dies-when: the lane pace alarm lands and its 27 Nov remeasure is read
---

# lane pace — 20 Nov read across lanes

Ticket: FRM-672

# lane pace, 2026-11-20 (local, UTC+2)

## how it was measured

- window: each lane's own transcript span, herdr 13:06:39–15:03:13, stray 13:29:45–14:30:29, mods 13:07:32–15:09:45. Nothing is known about a lane outside its transcript.
- commits: `git log --since='2026-11-20 00:00' origin/main --numstat`, 75 commits today, the first at 13:01:49. A commit is a lane's if its subject is in a commit/push command of that transcript or in a `*msg*.txt` / `m<N>.txt` file in the lane's scratchpad. herdr 15, stray 9, mods 27. 24 commits matched no lane (pocket auto commits and clio-side 📜 commits) and are left out.
- cycle = one landed commit; it runs from the previous landing (or the transcript start, the "ramp") to this commit's git time. The push after a commit lands in the next cycle.
- wall time is cut into segments and each gets one state. A foreground tool call is its kind: tests (vitest, go test, `x mods edit test`), tsc (tsc, typecheck, herdr-mods-typecheck), commit+push (`x lane commit|push`, `x mods edit push`, `land.sh`, a script that runs those), land (`herdr-mods:land`), agent, other tools (Edit, Read, plain Bash, SendMessage, MCP). Between tool calls the model is thinking (next record is the model's) or idle (next record is an incoming message).
- background commands (`run_in_background`) run from the tool_use to the task-notification's queue time. Idle time while one runs is counted as waiting on it ("blocked"). Model time while one runs is counted as overlapped, outside the blocked share.
- fixed cost, blocked = tests + tsc + commit/push in the foreground + idle while a background test/commit/push runs. Tests and typecheck that run inside a commit chain are inside the commit/push figure and cannot be split out. `land` is not fixed cost here.
- in-flight = every minute any fixed-cost command was running, blocked or not. It is the upper bound.
- flag rule used: 🔴 if the cycle-weighted blocked share is over 50 % of cycle time, or a full hour landed nothing while working. 🟡 if 30–50 %, or a full hour over 50 % while the day is not. 🟢 below 30 %.

## control: mods, ~2.5 min a move

- the method recovers it. Landing-to-landing gaps from 14:20 to 14:58 (11 gaps) have median 2.65 min, 14:31 to 14:58 (9 gaps) 2.63 min.
- the whole-day median is 4.0 min (3.8 without the ramp, n=26). The 13:xx hour was slower, median 5.2 min.
- the control reads 100 % blocked fixed cost on every cycle from 14:20 to 14:57. It lands 14 commits in the 47 minutes of the one background run started 14:10:55 (ended 14:58:31) and moves hundreds of lines each. So blocked share alone cannot tell "stuck" from "fast but chain-bound": share plus lines per landing has to be read together. Median lines touched per commit: mods 324, herdr 75, stray 44.

## herdr — 🟢

- why: cycle-weighted blocked fixed cost 21 % (23 % without the ramp), median per-cycle 27 %; commit+push cycle is short, 5.2 min median; the big loss is idle, not fixed cost.
- totals: 15 commits, +1183 / −492. Wall 116.6 min: idle 52.4, model 35.2, other tools 2.7, land 1.7, tests 1.1, tsc 1.3, foreground commit+push 2.6, idle waiting on background commit/push 19.6. Blocked fixed 24.6 min (21 % of wall, 38 % of the 64 non-idle min). In-flight fixed 29.7 min.
- 13:xx (13:06:39–14:00, 53 min): 9 commits, +713 / −214. idle 15.4, model 17.6, other 1.8, land 1.1, tests 0.6, tsc 0.9, commit+push 1.1, waiting on background 14.7. Blocked fixed 17.4 min = 33 % of wall, 46 % of non-idle. Cycles landing here: median 5.1 min, blocked share 29 %, in-flight 38 %. Worst hour on fixed cost.
- 14:xx (60 min): 5 commits, +270 / −202. idle 36.4, model 15.2, other 0.9, land 0.6, tests 0.3, tsc 0.4, commit+push 1.5, waiting on background 4.8. Blocked fixed 6.9 min = 12 % of wall, 29 % of non-idle. Cycles: median 10.7 min, blocked 16 %. Worst hour on lost time: 36 of 60 min idle, mostly 14:15–14:37, ended by dima's answer on the focus question and clio's PK-459 message.
- 15:xx (15:00–15:03, 3 min only): 1 commit (f8dee06f at 15:02:08, +200 / −76). Too short to judge as an hour.
- idle gaps of 4 min or more: 13:07–13:13 (5.6, ended by clio's «your turn ended»), 13:30–13:35 (4.8, reviewer's round-1 message), 14:15–14:22 (6.9, dima), 14:24–14:32 (7.5), 14:32–14:37 (4.8). Idle in total 52.4 min, 45 % of the window.
- the commit chain: `x lane push --apply` in the background, 58–169 s each time (typecheck then push, one at a time). Waited on the commit gate queue 71 s in total (13:xx).
- loops: no file read 3+ times by the Read tool. Ranged `sed -n`/`cat` reads of the same file 3+ times per hour: main.js 23 (13:xx), 21 (14:xx), 7 (15:xx), quill-view.js 8 (14:xx), gpui-kit.d.ts 6, AGENTS.md 4, orbit.js 4, drag-view.js 3, s.json 3. They are ranged reads of ~1,400-line files, not whole rereads.
- loops: same test command 3+ times per hour. `node script/herdr-mods-typecheck.ts` 23 (13:xx), 12 (14:xx); `pnpm typecheck` 7, 3; `pnpm vitest run …x-herdr-deck` 5 and 4 (13:xx), `…/focus.test.ts` 3 (14:xx).
- loops: failing test/typecheck runs, `x verify red` excluded: 12 (13:xx), 4 (14:xx); some are intended TDD reds (not separated). Refused commit/push chains: 0. Tool calls refused by the "background command needs a deadline" hook: 2 (13:xx). Tool errors: 5 and 2.

## stray — 🔴

- why: 66 % of cycle time is blocked fixed cost (69 % without the ramp), median per-cycle 68–72 %, a median landing touches 44 lines, and 16.5 min of the commit chain was the shared commit-gate queue.
- totals: 9 commits, +611 / −75. Wall 60.7 min: idle 1.8, model 13.4, other tools 4.2, tests (foreground go test) 5.7, foreground commit+push 2.5, idle waiting on background commit/push 30.7, on a background test 2.3. Blocked fixed 41.2 min = 68 % of wall. In-flight fixed 44.1 min.
- 13:xx (13:29:45–14:00, 30 min): 3 commits, +419 / −44. model 7.3, other 2.2, tests 4.1, commit+push 2.5, waiting on background 14.1, idle 0. Blocked 20.8 min = 69 %. Cycles median 5.0 min, blocked 63 %. Gate queue wait 600 s. Two commits refused: 13:49 (x contract changed without a glossary line) and 13:56 (verify_red_test.go past its code-size cap). Worst hour: lowest landings per working minute and both refusals.
- 14:xx (14:00–14:30, 30 min): 6 commits, +192 / −31. model 6.1, other 2.0, tests 1.6, commit+push 0.0, waiting on background 16.6, on a test 2.3, idle 1.8. Blocked 20.5 min = 67 % of wall, 72 % of non-idle. Cycles median 5.6 min, blocked 68 %. Gate queue wait 391 s.
- cycles: median 5.0 min (n=9), 6.3 min without the ramp (n=8). Cycle blocked shares between 39 % and 95 %; no cycle under 39 %.
- loops: Read-tool rereads 3+ times in 13:xx: mods.go 3, mods_test.go 3; ranged Bash reads of mods.go 7 (13:xx), reply-check.test.ts 4 (14:xx).
- loops: same test command 3+ times in 13:xx: `go test -run 'TestModsEdit' ./...` 4 and a variant 3. Failing test/typecheck runs: 5 (13:xx), 1 (14:xx). Refused commits: 2 (13:xx), 0 (14:xx). Tool calls refused by the background-deadline hook: 1. Tool errors: 5 and 6.

## mods (control) — 🟡, 🔴 in 14:xx by the rule

- why: cycle-weighted blocked share 45 % (47 % without the ramp); median per-cycle 37 % (61 % without the ramp). 14:xx alone is 78 %, which the rule flags 🔴, but the hour lands 16 commits and moves +5399 / −5213 lines; read with the control paragraph above.
- totals: 27 commits, +8633 / −8101. Wall 122.2 min: idle 3.5, model 47.9, other tools 17.1, tests 2.7, tsc 0.4, foreground commit+push 1.2, idle waiting on background commit/push 49.4. Blocked fixed 53.7 min = 44 % of wall. In-flight fixed 97.1 min (80 % of wall), of which 28.8 min the model kept working under it.
- 13:xx (13:07:32–14:00, 52 min): 9 commits, +3172 / −2884. model 36.7, other 8.7, tests 2.1, tsc 0.4, commit+push 1.2, waiting on background 3.3, idle 0.1. Blocked 7.0 min = 13 %; in-flight 36.1 min, 22.5 of them overlapped with model work. Cycles median 5.2 min, blocked 14 %, in-flight 67 %. The hour had 6 refused or red chains (overlay type error on push, a commit gate failure at 13:30, a pull needing --over, two prechecks red, one overlay suite red), 14 tool errors.
- 14:xx (60 min): 16 commits, +5399 / −5213. model 7.8, other 5.5, tests 0.6, commit+push 0.0, waiting on the background chain 46.1. Blocked 46.6 min = 78 %; in-flight 57.5 min. Cycles median 3.3 min, blocked 73 %, in-flight 96 %. Worst hour.
- 15:xx (15:00–15:10, 10 min): 2 commits (module-map AGENTS.md and store-keys comments, +62 / −4); idle 3.5, blocked 0.1 min. One commit refused at 15:04:14 (AGENTS.md), landed at 15:04:54.
- the commit gate: no gate-queue wait line was seen in what its commands printed (not measured further). Load-average wait before the suite: 21 s (13:xx), 40 s (14:xx).
- loops: ranged Bash reads of register.tsx 44 times (13:xx), orbit-store.ts 4, quiet.ts 3. Read-tool rereads 3+ times: none. Same test command 3+ times: none (tests run inside the chain script). Failing test/typecheck runs: 5 (13:xx), 1 (14:xx). Refused or red chains: 6 (13:xx), 1 (15:xx). Tool calls refused by the background-deadline hook: 1.

## not measured

- tests vs commit/push inside one chain: the chain's own time is not split, only the total.
- which test failures were intended TDD reds; the 13:xx failures of herdr and mods are counted whole.
- who sent the message that ended each idle gap, except the five herdr gaps read above.
- the reason of mods' 13:30 commit gate failure.
- activity of any lane before its transcript's first record or after its last.
- whether a background task's queue time lags its real end: queue-operation enqueue time is used as the end.

## commands run

- `cd /Users/dima/frame && git log --since='2026-11-20 00:00' --format='C %h %ad %s' --date=iso --numstat origin/main > <scratchpad>/git.txt` (run twice, the second after origin/main moved at 15:02–15:06)
- `git -C /Users/dima/frame log --since='2026-11-20 14:57:34' --format='%h %ad %s' --date=iso main`; `git rev-parse origin/main main`
- `python3 <scratchpad>/pace.py herdr`, `… stray`, `… mods` (output in `<scratchpad>/out-herdr.txt`, `out-stray.txt`, `out-mods.txt`); the script reads the three jsonl files, the task output files under `/private/tmp/claude-501/-Users-dima-frame/<session>/tasks/`, and `<scratchpad>/git.txt`
- inline python reading the jsonl files for: record shapes, bash command lists (`herdr-bash.txt`), background-task notifications, refusal texts, the five herdr idle gaps and their ending messages, the mods landing gaps from 14:20, median lines per commit
- scratchpad = `/private/tmp/claude-501/-Users-dima-frame--clio/02e545e1-5d45-4b79-9c41-4a9066cbb71a/scratchpad`
