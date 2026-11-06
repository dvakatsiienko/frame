# what the sys time is, measured on this mac, 2026-11-07 01:16 to 01:33

Mac16,7, M4 Pro, 14 cores, macOS 27.2, 15 live cc sessions, about 1,130 processes, 6,900 threads. All no sudo, one window, so a direction. Scripts and raw output: `/private/tmp/claude-501/-Users-dima-frame--clio/2e3b8126-f001-4480-a935-bbdb57f89b89/scratchpad/m/`.

## the verdicts

- ⚠️ **proven, live: 24 orphaned test hooks poll forever**, each spawning `sleep 0.1` at 10/s. It explains the machine's constant ~290 spawns/s floor. It is real but small: about 0.5 core direct. **Not the main cause.**
- **proven: spawn rate tracks go runs**: ~290/s with none, 760 to 940/s with one.
- **partly explained: go's extra sys**, direct spawn cost about 2 of its 4.8 extra sys cores. The rest is inference.
- **disproven as a main cpu cost**: Gatekeeper or XProtect, 1Password, Spotlight, each under 0.2 core sustained.
- **proven as latency, not cpu: a fresh script's or binary's first exec** is 30× slower.
- **not proven: where the kernel time goes**. That takes the sudo tools at the end.

## 1. the leak

`until [ -e <release> ]; do sleep 0.1; done`, a fixture `pre-commit` from `x/go/gate_turn_test.go` (lines 183, 306, 388, 488), landed on main in #132, this lane's own pr 1.

- 24 live, each `/bin/sh .git/hooks/pre-commit` under a `git commit` in a `TMPDIR/Test…` fixture, whose release file will never appear
- by test: `TestGateTurnIsFreedWhenXDies` 16, `TestTwoCommitsInOneCheckoutBothLand` 3, `TestAHungHookFreesTheTurnAtItsCap` 3, `TestGateTurnRunsEachHookAlone` 2
- age: 1.5 to 3.2 h, so born about 22:00 to 23:58, none younger in the 1.5 h since, though go suites ran. So normal green runs do not seem to leak; red runs and mutants do (inference: the ages match pr 1's build and sixth sense's rounds, not proven)
- also left: 9 `x lane commit`, 5 `gate-queue.sh --hold`, 1 wrapped `sh -c` under the same dead tests; about 0 cpu
- one minute caught by back-to-back `ps` (57 ms each): pid rate 497/s, 12,857 `sleep` parented by `sh`, under `git`: about 214/s, at least 43 % of all spawns that minute. Next: `x.test` children 1,151, git 1,777 in zombie form
- cost: `sh` 0.5 % of a core each, 0.12 core in all (1,122 cpu-s over their ages); 240 `sleep`/s × about 1.2 ms u+s for a floor spawn = 0.3 core. Direct about **0.4 to 0.5 core**, 3 % of the machine. Indirect cost (logd, notifyd, pid wrap every 3 to 5 min) unmeasured
- the same loop stays in codie's branch at the same lines; a red run there can leak the same way (inference)
- 📌 PIDs: `scratchpad/m/leaked-pids.tsv`. Not killed: the brief forbids it, dima's word. Killing them is also the cheapest A/B: spawn floor and sys before and after
- fix, out of this directive: give the fixture hook a cap, or kill its process group in `t.Cleanup`

## 2. spawn rate and the go link

Pids move by what was spawned: 51 spawned, pid moved 60, so the control holds. Rate, pid delta per ~32 s, wraps at 99,999 corrected by hand:

- no go run live: 282 to 302/s, 6 rows, very flat. The leak is 240 of it
- go run, by `gate-queue.log` or `x.test` seen: 762 to 938/s
- 📌 rows at 01:23:54 to 01:24:59 read «nothing queued» yet ran 870 to 890/s: **a go run outside the queue**. So «nothing queued» in `cpu-load.md` is not nothing; pr 1's no-turn wrap (`pnpm x-go:gate` logs slot `none`) makes this more common. Its read of load 21 is weaker than it looks

## 3. cpu per spawn, children's rusage at load 11, 50 serial and 48 at 8 parallel

user + sys ms each; the parallel row matches, so **no contention showed at load 11**, it was not tried at load 40:

- `/usr/bin/true` 1.2 (0.4 + 0.8)
- go hello 2.2 (0.8 + 1.4)
- `sh -c :` 2.8 (1 + 1.8)
- `zsh -c :` 2.8 (1 + 1.8)
- `git --version` 6.6 (3.4 + 3.2)
- `git rev-parse` 7.0 (3.6 + 3.4)
- `node -e 0` 25 (19.4 + 5.6)

The join, an estimate: a go run's extra ~600 spawns/s, mostly git and x, × 3.3 ms sys = **2 cores of sys**. Observed: only go, sys 54 %, against nothing queued 20 %, +4.8 cores. So **direct spawns explain about 40 % of go's extra sys** at `--version` cost. A fixture `git commit` or `git push` does much more file work, so 40 % is a floor (inference). Today's spec line said 17 %, computed on the test process only.

## 4. fresh executables: the theory holds for latency, fails for cpu

First against second exec, p50 ms, 20 to 40 rounds:

- freshly built go binary 200 → 5.5
- a fresh copy of it 87 → 5.5
- **a fresh `#!/bin/sh` script 170 to 189 → 3.5 to 6**
- `git --version`, not fresh, 14 → 14
- `sh <fresh file>`, no exec of it: the run was cut by my timeout, no number

Daemon cpu around 40 fresh copies against 20 s idle, 3 rounds: `syspolicyd` +1.0 s, `XprotectService` +0.73 s, `trustd` +0.23 s, so **about 48 ms of daemon cpu per fresh binary**. The same read on fresh scripts drowned in fleet noise, so it is unmeasured.

Sustained over 10 min all assessment daemons took **0.15 core**. So this costs waiting, not cores. It bites anything that writes then runs an executable: 26 fixture executable sites in `x/go` tests, plus unknown others. `DevToolsSecurity -status`: disabled. Gatekeeper assessments on. The Developer Tools grant is not readable (TCC.db refused), so an A/B needs his click, unproven whether it removes this.

## 5. who burns cpu, cores over 629 s

`top`: busy 10.4 cores, user 6.3, sys 4.1. `ps -o time` deltas, only for processes alive at a snapshot 160 s apart, sum to 4.1 cores, 39 % of busy:

- other 0.70, of it NotificationCenter 0.07, Wispr 0.06, Vorssaint 0.05
- claude cli 0.66, 15 sessions, active ones about 0.1 each, parked 0.02 to 0.05
- other os daemons 0.48
- claude desktop 0.48, one renderer 0.25
- WindowServer 0.47
- chrome 0.34
- fseventsd 0.28
- spotlight 0.19
- assessment daemons 0.15
- shell 0.14
- js tools 0.11
- 1Password 0.03: its 61 % at 01:08 was a spike

📌 The other 6.3 cores are processes that lived and died between snapshots, which here includes whole test suites (go test binary reads 0.02 core though it ran). So this proves the gap's size, and does **not** prove that gap is tiny spawns: the earlier «short-lived spawns» reading stays inference. The `%CPU` sample in item 7 does catch suites: `plugin-test` 193 %.

## 6. the rest

- Sessions at rest: claude cli + desktop + WindowServer about 1.6 cores. Tool calls across transcripts about 20/min, 20 hook entries in settings, so hook spawns are a few per second at most (inference, no log). Explains under a fifth of «nothing queued» busy 8.7 cores; the rest is mostly unqueued runs, item 2 (inference)
- Spotlight: indexing on, the worktrees dir not excluded (no `.metadata_never_index`), 417,249 files under 13 worktrees, 32,467 without `node_modules`. Cost 0.19 to 0.20 core, spiking: `mds_stores` read 11 s in one 20 s window. fseventsd 0.25 to 0.28, 0.5 at peak. Cheap to cut, small
- Thermal: `pmset -g therm` says no warning recorded, three lines. That's not proof of no throttling: may not report on this chip (inference). His 106 °C stands, speed limit unproven
- System extensions: only ClearVPN's network ones. No EDR or Endpoint Security product listed (`endpointsecurityd` 0 cpu)

## 7. after pr 1, 30 min sample, 00:46 to 01:16, n=154, with codie's go A/B inside it

Against the baseline in `cpu-load.md`, 22:09 to 22:36, n=136, where **24 leaked hooks were mostly not yet born**. Fleet: load p50 26.7 vs 24, p90 37.8 vs 73, max 48.8 vs 100. user 43 vs 41, sys 35 vs 33, idle 21 vs 27.

- only go: load 29 vs 51, sys 54 vs 52, idle 4 vs 7, n=32 vs 24
- only mutant: 29 vs 27, sys 43 vs 35, idle 16 vs 30, n=21
- only mods suite: 24 vs 21, sys 23 vs 24, idle 34 vs 27, n=50
- nothing queued: 23 vs 21, sys 20 vs 21, idle 38 vs 54, n=24
- only commit: 15 vs 19, sys 25 vs 25, idle 42 vs 43, n=3, thin
- `%CPU`: plugin-test 32 % of what `ps` sees (193 %), other 67, claude-cli 50, os-daemons 45, WindowServer 41, chrome 36, claude-desktop 34, fseventsd 25, go-test-binary 21, spotlight 20

Read: peak load halved, sys share unchanged, idle lower. pr 1 is not the cpu's fix, as expected. One window, not comparable fleets.

## sudo commands that would prove it, for a Rex tab, only if worth it

Spawns and file ops per process, 30 s, during a go run:

```bash
sudo fs_usage -w -f filesys -t 30 | awk '{print $NF}' | sort | uniq -c | sort -rn | head -30
```

Per-process cpu with sys split, and real thermal and frequency state, 30 s:

```bash
sudo powermetrics --samplers tasks,cpu_power,thermal -i 5000 -n 6 --show-process-coalition
```

Where the kernel and every process spends its time, 10 s, the one that answers «what is the sys»:

```bash
sudo spindump -notarget 10 -file /tmp/spindump-go.txt
```

Which syscalls a go test makes (SIP may block dtrace):

```bash
sudo dtrace -n 'syscall:::entry { @[execname, probefunc] = count(); } tick-30s { trunc(@, 30); exit(0); }'
```
