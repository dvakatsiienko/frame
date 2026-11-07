# cpu cases — every cpu overload case measured so far, and what each proves

Read this first on reopening the problem. Mac16,7, M4 Pro, 14 cores, 48 GB, macOS 27.2, about 15 sessions, cc 2.1.317. The prior art: [mac-agent-cpu-overload](../../research/mac-agent-cpu-overload.md). The raw sample: [cpu-load.md](cpu-load.md).

📌 **proven, two 10 s windows: go test runs spawn the git that fills the kernel; the mods suite fills user cpu; sessions at rest are cheap.** Every line below says what it proves.

## the spindump, 2026-11-07 01:43:54, 10 s, load about 30, a go run live

Read by `spindump-read.mjs` and `spindump-git.mjs` beside this file; the sampler itself took 11.7 cpu-s of the total.

- 125 cpu-s in 10 s, about 12.5 of 14 cores
- **6,612 distinct processes in 10 s**, 661/s; `ps` snapshots miss nearly all, which proves the «short-lived spawns» reading of the ps gap
- **git: 3,773 processes, 377/s, 36.2 cpu-s, 3.6 cores**, p50 9 ms each. The next user process is 5.7. git's samples are 65 % kernel
- the same window: x 850 processes 5.5 s, `x.test` 791 records 5.5 s, bash 1,076 processes 1.8 s, sleep 347. Daemons: fseventsd 4.65, cfprefsd 3.56, opendirectoryd 2.27, notifyd 1.6, syspolicyd 1.49, mds 1.22
- running kernel samples, idle and the sampler out: 5,965, 44 % of them in git. Module on the stack: **Sandbox 18 %, 26 % of git's** (`hook_vnode_check_open` → `sb_evaluate_internal`), apfs 11 %, EndpointSecurity 4 %, AMFI 3 %. No `sandbox` key in settings; whose profile applies is unread. Most of the kernel's own frames have no symbol
- entering the kernel: `__open` 693, `__execve` 307, `lstat` 230, `__getdirentries64` 209, `__fork` 178
- ruled out: 7 `git fsmonitor--daemon` processes at about 0 cpu

## the second spindump, 2026-11-07 02:04:57, 10 s, no go test live

The same scripts, `node spindump-read.mjs /tmp/spindump-quiet.txt`. Two windows, one each, so strong but not repeated; other work moved between them too.

- **git 3,773 → 35 processes, 36.2 → 0.3 cpu-s; x 850 → 5; `x.test` 791 → 0.** Go test runs are what spawns that git
- running kernel samples 5,965 → 1,603, so **go test is the kernel load**
- the machine stayed full: 138.6 cpu-s, about 13.9 cores. **`2.1.319` took 87 cpu-s, 8.7 cores, 95 % user**: 10 children at about one core each, 11 to 57 s old, under two parents. That binary is cc's own, so they read as `claude plugin test` workers from the mods suite, which ran then (`x mods edit test` 02:02:36 for 163 s). Parent commands are gone: inference
- **so two heavy shapes**: go tests burn the kernel through git, the mods suite burns user cpu through cc workers
- **sessions at rest are cheap**: long-lived `claude` 0.2 to 0.4 cpu-s per 10 s each. All the rest of the mac, sessions, app, WindowServer, Chrome and the OS: 138.6 − 87 − 10.7 for the sampler = about 41 cpu-s, about 4 cores. So about 15 sessions fit in 4 of 14 cores, and **lane count is not what fills the mac, heavy runs are**. That points at 16 lanes being possible if heavy runs stop stacking, inference until a ramp proves it
- Sandbox 10 % of kernel samples here against 18 %

Raw data, off `/tmp` so a reboot keeps it: `~/.local/state/x/lanes/frm-525/` holds both spindumps gzipped, the 30 min cpu sample, the measure scripts and exit 5's rows. codie's fuller cost list: `~/.local/state/x/lanes/frm-521/go-test-cost.md`.

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

- baseline sys with no go run: 2.8 cores, about 0.5 explained
- Spotlight: `mds_stores` 111 % and `mds` 37 % at 01:33 against a 0.19 core 10 min average; 417,249 files under 13 worktrees, none excluded. Bursty, unmeasured against commits
- `cfprefsd`, `opendirectoryd`, `notifyd`: high in cumulative syscalls since boot; nobody has published a cost for them
- thermal throttling at 106 °C: `pmset -g therm` reports nothing, which may not work on this chip
- whether a go suite's sys is its own or contention

## after pr 1, one window, 00:46 to 01:16, n=154

Peak load halved, 100 → 49; sys share unchanged, 33 → 35 %. Not the cpu's fix, as expected. Only a go run: load 51 → 29, sys 52 → 54 %. Fleets differ, codie's before/after go run sat inside it.

## next, cheapest first

1. the third piece: a `spindump` with neither a go run nor a mods suite, and whose sandbox profile hits git, the cheapest new lever if it can go
   - then, dima's tick: a research on git's process cost, all lanes: fewer git per fixture, a repo template, in-process libraries (gix, go-git), a long-lived `git cat-file --batch`, config and sandbox cost per start, jj's process count and hooks
2. the decisive A/B at a halt: the same go run with every session running, then with all stopped. sys stays near its number → the suite's own work; it falls far → contention
3. the leak: free the 24, compare spawn floor and sys; pr 2 stops new ones
4. Spotlight: exclude the worktrees dir through the Search Privacy pane, read commits and `mds_stores` before and after
5. hide the desktop window: `top` WindowServer, 2 min
6. fewer spawns per test, FRM-521's pr 2; exit 5 reads it
7. a Developer Tools A/B only with the gates run from a shell outside claude, since #104173 says the Bash tool is not covered
8. a Linux VM with the checkout on its own disk: one go suite against native, when the machine is quiet. Only then think of hardware
