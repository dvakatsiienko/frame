# cpu cases — every cpu overload case measured so far, and what each proves

Read this first on reopening the problem. Mac16,7, M4 Pro, 14 cores, 48 GB, macOS 27.2, about 15 sessions, cc 2.1.317. The prior art: [mac-agent-cpu-overload](../../research/mac-agent-cpu-overload.md). The raw sample: [cpu-load.md](cpu-load.md).

📌 **the cause of the sys time stays unproven.** Every line below says what it proves.

## the symptom

- 2026-11-07 01:08: load 47, `top` 40.6 % user, 59.4 % sys, 0.0 % idle; `ps` totals about 6 of 14 cores. CPU 106 °C on dima's screen
- 2026-11-06: load peaks 126 to 172, 247 once at 00:12, codie's `measure.sh`
- a commit's test step: about 13 s alone, 35 s at load, so about 2.5×
- dima's screenshot: a commit at 7m57s, 201 s by the transcript, the rest unexplained

## proven

- **a leak of ours**: 24 `/bin/sh .git/hooks/pre-commit` fixtures from `x/go/gate_turn_test.go` (#132), alive 1.5 to 3.2 h after their tests died, each polling `sleep 0.1`: about 240 of the machine's 290 spawns/s floor, but about 0.5 core direct. Small, indirect cost unmeasured. Their pids at the 01:32 read went to wing 1's scratchpad
- **spawn rate follows go runs**: about 290/s with none, 760 to 940/s with one. `x.test` is a heavy spawner
- **"nothing queued" is not nothing**: go runs ran outside the queue at 870 to 890/s while the log read nothing queued; pr 1's no-turn wraps make this more common
- **a fresh executable's first exec is 30× slower**: go binary 200 → 5.5 ms, script 170 to 189 → 3.5 to 6 ms. It costs waiting: about 48 ms of daemon cpu each. 566 `not exempt` scans in the 2 min to 01:33. `DevToolsSecurity`: disabled
- **per spawn**: `/usr/bin/true` 1.2 ms user + sys, `git --version` 6.6, `node -e 0` 25, at load 11, no contention at 8 parallel

## ruled out as the main cost, one window each

- memory: swap 0, swapouts 0
- `fseventsd` runaway: 6 MB, 0.25 to 0.28 core, top of cumulative bsd syscalls all the same
- 1Password: 0.03 core sustained; its 61 % was a spike
- Gatekeeper and XProtect as cpu: 0.15 core
- EDR: none listed. OTEL exporter: unset
- idle claude spin, [#107009](https://github.com/anthropics/claude-code/issues/107009): parked sessions 0.02 to 0.05 core here. That bug flips, so re-read it at other hours

## open

- **where the kernel time goes.** Direct spawns explain about 40 % of a go run's extra sys, a floor. Baseline sys is 2.8 cores, about 0.5 explained
- 6.3 of 10.4 busy cores are invisible to `ps` deltas, whole test suites included, so "tiny spawns" stays inference
- Spotlight: `mds_stores` 111 % and `mds` 37 % at 01:33 against a 0.19 core 10 min average; 417,249 files under 13 worktrees, none excluded. Bursty, unmeasured against commits
- `cfprefsd`, `opendirectoryd`, `notifyd`: high in cumulative syscalls since boot; nobody has published a cost for them
- thermal throttling at 106 °C: `pmset -g therm` reports nothing, which may not work on this chip
- whether a go suite's sys is its own or contention

## after pr 1, one window, 00:46 to 01:16, n=154

Peak load halved, 100 → 49; sys share unchanged, 33 → 35 %. Not the cpu's fix, as expected. Only a go run: load 51 → 29, sys 52 → 54 %. Fleets differ, codie's before/after go run sat inside it.

## next, cheapest first

1. the sudo read that answers it, during a go run: `sudo spindump -notarget 10 -file /tmp/spindump-go.txt`
2. the decisive A/B at a halt: the same go run with every session running, then with all stopped. sys stays near its number → the suite's own work; it falls far → contention
3. the leak: free the 24, compare spawn floor and sys; pr 2 stops new ones
4. Spotlight: exclude the worktrees dir through the Search Privacy pane, read commits and `mds_stores` before and after
5. hide the desktop window: `top` WindowServer, 2 min
6. fewer spawns per test, FRM-521's pr 2; exit 5 reads it
7. a Developer Tools A/B only with the gates run from a shell outside claude, since #104173 says the Bash tool is not covered
8. a Linux VM with the checkout on its own disk: one go suite against native, when the machine is quiet. Only then think of hardware
