# cpu cases — every cpu overload case measured so far, and what each proves

Read this first on reopening the problem. Mac16,7, M4 Pro, 14 cores, 48 GB, macOS 27.2, about 15 sessions, cc 2.1.317. The prior art: [mac-agent-cpu-overload](mac-agent-cpu-overload.md). The raw sample: [cpu-load.md](cpu-load.md). The dated history: [story.md](story.md).

📌 **proven, two 10 s windows: go test runs spawn the git that fills the kernel; the mods suite fills user cpu; sessions at rest are cheap.** Every line below says what it proves.

📌 **the number to beat: a lane ran about 1.8× slower at 4-5 lanes than at 2** (121 → 71 tool calls per lane-hour), and more lanes is the goal, so fewer lanes is not the fix. [fleet-pace-under-load](fleet-pace-under-load.md) holds it, with its lane-count recommendation out by dima's word, relayed by main at 02:27. One unplanned window, a correlation:

- queue wait is the main suspect: 892 min waited against 605 min run in 6.6 h, about 2.25 sessions stuck at any moment; no baseline exists before 11-06 19:39
- the same command slows little: ×1.15 p50, ×1.75 p90 same-workload, knee at load 30-40, steep at 60+; so cpu run time alone reads about +7 % wall at p50, +35 % at p90, inference
- mods tests grew 902 → 3,430, go `func Test` 368 → 703: part of what reads as load is suite growth
- its rows' scripts, off `/tmp`: `~/.local/state/x/lanes/frm-525/pace-under-load/`

## the dose test, 2026-11-07 14:05 to 14:27, only this wing running

Planned doses, `dose` and `ab-ram` rows in `~/.local/state/x/lanes/frm-525/`. At rest before it: 25 % busy, load 6. Wall s, then user + sys cpu-s per run:

- go ×1: 69 and 63 s, 168 + 253 and 165 + 258, 96 % busy, load peak 107
- go ×2: 123 s, 165 + 269 each
- go ×3: 167 s, 166 + 272 each
- go ×4: 219 s, 167 + 274 each
- vitest ×1: 33 s, 81 + 36, 94 % busy, load peak 78
- vitest ×2: 35 s, 79 + 36 each
- go + vitest: go 73 s, 151 + 249; vitest 43 s, 77 + 34
- mods ×1: 91 s, 429 + 38, 76 % busy
- mods + go: mods 151 s, 454 + 41; go 78 s, 161 + 255

**What it proves, doses of 1 to 4, one run each above 1:**

- 🚫 **contention is not the sys**: 4 suites at once cost 5 % more cpu each than one. The old question «the suite's own, or contention» is answered: its own
- **one go suite alone is the 100 %**: the 03:52 case needs no second cause
- go's wall grows about 55 s per suite stacked, so the mac's rate is about one go suite a minute. A queue moves the wait and frees nothing; only a cheaper run helps
- a go run accounts for about 6.4 cores of its 13.4 busy; rest of the mac at idle is 3.5; about 3.5 sit in other processes the run wakes (inference, daemons by the spindump)
- go is 60 % sys, mods 8 %, vitest 31 %: two different diets, as the spindumps said

**RAM disk A/B, the go suite with `TMPDIR` on a ram disk, 4 runs in abba:** apfs 248 and 244 sys; ram 233 and 234; wall 67, 69, 55, 53, no pattern. 🚫 **the disk is not the sys: 5 % at most.**

## `LANG`, 2026-11-07 14:40 to 14:51, the answer to the process tree below

500 `git --version` from the Bash tool, one env key flipped, `tree.tsv`: none 4.34 s, `LANG=en_US.UTF-8` 2.62, `LC_ALL=C` 2.41, `TERM` 4.37, a pty 4.32. A launchd job, which has no `LANG`, read 4.17, so the tree was never the cause.

- go suite, abba, `ab-lang.tsv`: none 55.9 and 55.7 s, 162 + 245 and 156 + 249 cpu-s; `LANG` 46.1 and 47.8 s, 134 + 223 and 133 + 218. **13 % less cpu, 16 % less wall**
- vitest, abba: none 86.6 and 86.9 cpu-s; `LANG` 83.1 and 83.1; wall 14 s either way
- why, inference: `otool -L` shows git linking homebrew's `libintl` and CoreFoundation, so with no locale it asks macOS for the language on every start. It fits `cfprefsd`, `opendirectoryd` and `notifyd` running high in the spindump; a spindump with `LANG` set would prove it
- fix: `"LANG"` in `settings.json`'s env; a session started before it keeps none

## the process tree, 2026-11-07 14:33 to 14:38, its reading corrected by `LANG` above

The same go suite and spawn loops, from a rex tab against the Bash tool, abba, `spawn-bench.tsv`, `spawn-matrix.tsv`, `lineage-*.txt` in `~/.local/state/x/lanes/frm-525/`.

- go suite: rex 42.5 and 43.1 s, 130 + 200 and 132 + 205 cpu-s; tool 51.0 and 52.2 s, 152 + 237 and 151 + 239
- 500 `git --version`: rex 2.25 s, tool 4.13 s. `/usr/bin/true`: 1.4 against 1.9 ms wall. A pure compute loop: 2.29 s in both, so it is no slow core and no QoS clamp
- 🚫 not the gap: cwd, env (`env -i` from the tool stays slow), `PATH`, open-files limit (`ulimit -n 256` stays slow), the bash sandbox flag
- assumed then, wrong: that left the tree under `Claude.app`. `env -i` had hidden it, since a clean env also has no `LANG`
- 📌 the go-suite cost here, 330 to 391 cpu-s, beats the dose runs' 420, with other work running then too; pr 139's 278 stays unreproduced, cause unread

## 100 % with one lane left, 2026-11-07 about 03:52, dima's screenshot

PK-328:W37 and W38: tomorrow opens with this lane alone, and catches this first.

- his screen: cpu 99 % on all 14 cores, 109 °C, gpu 57 %, memory normal. The app list sums to about 15 %, the same gap `ps` showed, so short-lived processes hold the rest (inference)
- the queue log: ci's lane ran the whole go gate at 03:50:14 for 69 s and 03:51:43 for 116 s, load 24; other rows that minute were commits and pushes. The spike's own clock is unread, so tying it to the gate is inference
- 03:54:59, after it: 15 % user, 9 % sys, 75 % idle, load 11: `~/.local/state/x/lanes/frm-525/snapshot-1-lane-20261107-0355.txt`. wing 1's 17 pocket label edits ran near it too, each with its hook
- **what it would mean**: a suite parallels over every core, so one heavy run reads 100 % by itself. 100 % says a heavy run is live, never how many lanes. It fits «lane count is not the load»
- a leak still alive: pid 91919 and child 92094, a `gate-queue.sh` landing fixture from `verify-pr-132`, orphaned since 22:25, polling `sleep 0.1`, about 0.6 % of a core and 10 spawns/s. Left alive for dima's word

## the spindump, 2026-11-07 01:43:54, 10 s, load about 30, a go run live

Read by `spindump-read.mjs` and `spindump-git.mjs` in `scripts/`; the sampler itself took 11.7 cpu-s of the total.

- 125 cpu-s in 10 s, about 12.5 of 14 cores
- **6,612 distinct processes in 10 s**, 661/s; `ps` snapshots miss nearly all, which proves the «short-lived spawns» reading of the ps gap
- **git: 3,773 processes, 377/s, 36.2 cpu-s, 3.6 cores**, p50 9 ms each. The next user process is 5.7. git's samples are 65 % kernel
- the same window: x 850 processes 5.5 s, `x.test` 791 records 5.5 s, bash 1,076 processes 1.8 s, sleep 347. Daemons: fseventsd 4.65, cfprefsd 3.56, opendirectoryd 2.27, notifyd 1.6, syspolicyd 1.49, mds 1.22
- running kernel samples, idle and the sampler out: 5,965, 44 % of them in git. Module on the stack: **Sandbox 18 %, 26 % of git's** (`hook_vnode_check_open` → `sb_evaluate_internal`), apfs 11 %, EndpointSecurity 4 %, AMFI 3 %. No `sandbox` key in settings; whose profile applies is unread. Most of the kernel's own frames have no symbol
- entering the kernel: `__open` 693, `__execve` 307, `lstat` 230, `__getdirentries64` 209, `__fork` 178
- ruled out: 7 `git fsmonitor--daemon` processes at about 0 cpu

## the second spindump, 2026-11-07 02:04:57, 10 s, no go test live

The same scripts, `node scripts/spindump-read.mjs /tmp/spindump-quiet.txt`. Two windows, one each, so strong but not repeated; other work moved between them too.

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
- a commit's test step: about 13 s alone, 35 s at load, read as about 2.5×. Corrected by [fleet-pace-under-load](fleet-pace-under-load.md): most of that gap is `4739e4ed` at 11-06 19:25, which added the sleeping `gate-queue.test.ts`, and 26 to 28 s still shows at load 7 to 11. Same suite after it: ×1.14 p50, ×1.43 p90 at load 16+
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

0. first, one lane alone: start `cpu-sample.mjs` and catch a 100 % with a spindump at minimal activity, naming the run behind it
0. the queue and the sleep: split queue wait from cpu wait first, since lanes stuck on one turn is a lever beside cpu; cut the sleeps `4739e4ed` added to every commit's test step; a planned ramp replays one fixed chunk set per dose, its design in the research doc § what would make this causal, doses raised to 16
1. the third piece: a `spindump` with neither a go run nor a mods suite, and whose sandbox profile hits git, the cheapest new lever if it can go
   - then, dima's tick: a research on git's process cost, all lanes: fewer git per fixture, a repo template, in-process libraries (gix, go-git), a long-lived `git cat-file --batch`, config and sandbox cost per start, jj's process count and hooks
2. the decisive A/B at a halt: the same go run with every session running, then with all stopped. sys stays near its number → the suite's own work; it falls far → contention
3. the leak: free the 24, compare spawn floor and sys; pr 2 stops new ones
4. Spotlight: exclude the worktrees dir through the Search Privacy pane, read commits and `mds_stores` before and after
5. hide the desktop window: `top` WindowServer, 2 min
6. fewer spawns per test, FRM-521's pr 2; exit 5 reads it
7. a Developer Tools A/B only with the gates run from a shell outside claude, since #104173 says the Bash tool is not covered
8. a Linux VM with the checkout on its own disk: one go suite against native, when the machine is quiet. Only then think of hardware
