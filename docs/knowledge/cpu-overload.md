---
fed-by: incidents
when:
  - { kind: command, value: spindump }
  - { kind: basename, value: gate-queue.sh }
---

# cpu overload — why this mac hits 100 %, what we tried, what held

Standing: read this before chasing a red cpu, and add to it when a round ends, solved or not. Ticket: [FRM-525](https://linear.app/x-com/issue/FRM-525).

## core

- **100 % says a heavy run is live, never how many lanes.** One go suite alone holds 96 % busy, load 107 (2026-11-07, one quiet mac, 2 runs)
- **The go suite's sys is its own, not contention.** 1, 2, 3, 4 suites at once cost 420, 433, 439, 441 cpu-s each, so wall grows with the count: 66, 123, 167, 219 s. A queue only moves the wait; only a cheaper run helps
- **About one go suite a minute is the mac's rate**, however they are arranged, with about 6 to 8 cores of the 14 in the suite's own accounting and the rest in other processes (inference on who)
- **The disk is not the sys**: a ram disk `TMPDIR` cuts it 5 % at most
- **A shell with no `LANG` makes every git start 1.7× slower**: 500 `git --version` 4.34 → 2.62 s, the go suite 13 % less cpu and 16 % less wall, vitest 4 % less cpu (abba, all four runs exited 1). A spindump proves why: with `LANG`, `cfprefsd` 3.56 → 0.00 cpu-s per 10 s, `opendirectoryd` 2.27 → 0.01, `notifyd` 1.60 → 0.13. `settings.json` now sets it for cc's shells; a new launchd job or bare `env -i` shell has none. Check a shell with `echo $LANG`
- **A slim git cuts the whole go suite 16.4 %, 326.7 → 273.0 cpu-s, with no code change**: 85 libraries against brew's 706. Every new agent shell and cc's bash hooks run it, his terminal stays on brew's, the boot reds a broken one; a session older than the door stays on brew's until it restarts. [FRM-532](https://linear.app/x-com/issue/FRM-532), the numbers in [git-process-cost.md](fleet-stories/cpu-overload/git-process-cost.md)
- **FRM-528's fixture cut took the go suite from 386 to 308 cpu-s, the same hour.** 200 was missed and closed on dima's tick; a budget at 385 now holds that line at the go doors
- **Fewer go test workers cost less cpu and keep the mac responsive, at a longer wall.** `go test -parallel 5` against the default 14, slim git, abba, one suite, load 13 to 28: 226 against 270 cpu-s, wall 74 against 48 s, a tiny spawn's p90 3 ms against 120 to 219. `taskpolicy -c utility` holds the same 4 ms p90 but costs more cpu, 303, wall 75. 3 suites at once, abba, the longer wall is gone: 263 against 277 cpu-s each, wall 129 against 128 s, a tiny spawn's p90 22 ms against 100. `script/test-cpu-budget.sh` sets it on every whole go run on this mac, ci keeps its default. Raw: `~/.local/state/x/lanes/frm-525/cap-ab.tsv`, `cap-many.tsv`
- **The same cap does not fit the other two runners.** Vitest at `--maxWorkers=5` read 98 against 105 cpu-s, wall 35 against 15 to 29 s, mixed on load, so it stays on its default. Mods cost the most, 527 cpu-s and 86 % user, but run one mod at a time at 99 s wall, and the mac stays responsive beside them, p90 7 ms; `taskpolicy -c utility` doubled them to 1,041 cpu-s and 368 s and went red. Raw: `cap-others.tsv`
- Sessions at rest are cheap: about 15 sessions, the app and the os fit in about 4 of 14 cores (two 10 s windows)
- `ps` and activity monitor miss the load: a go run makes 661 short-lived processes a second, so the app list sums to 15 % at a real 100 %. A `spindump` sees them

## sealed, 2026-11-11 — each problem, its fix, the guard that keeps it fixed

perf work stops here until a real slowdown (dima, 2026-11-11 15:13: «it is not an infinite scope»); FRM-525 and FRM-537 sit in Backlog. a new slowdown reopens with its own numbers, never from this list.

- a whole vitest suite on every commit → related tests only (FRM-534, FRM-557); guard: `script/test-commit.sh` runs none when it can't judge, the suite stays at push and ci
- the push twin on every push → only a main push carrying code (FRM-557); guard: `script/runner-twin.sh`
- a hung test child holding a commit 18 min → every test spawn carries a timeout; guard: `script/lib/git-fixture.test.ts` reds a spawn with none, and one spawning git without `gitEnv()`
- the go suite at 386 cpu-s on the mac → fewer git ops per fixture, a slim git, `LANG` set, `-parallel 5`, the run in the linux vm (FRM-528, FRM-532, FRM-551; about 140 cpu-s a run on 11-11); guard: `script/test-cpu-budget.sh`'s line, and the siesta's «vm down» check when a run falls back to the mac
- a slowdown found only when dima felt it → every siesta names a gate step past its budget (FRM-539, `_clio/script/gate-budgets.tsv`)
- reusing a passed go run → not built: real repeats are 13 % of go cpu on the full key (FRM-533, its kill gate)
- measured on 11-10, the day after: hook tests 80 min against 118–155 before

## lane count rows, 2026-11-07

One row per lane count, from `scripts/lane-count-read.mjs`. A lane here is a codie and its sixth sense; main's and the wings' commits run beside it. The number to beat is 1.8× at 4-5 lanes, in [cases.md](fleet-stories/cpu-overload/cases.md).

- 1 lane, FRM-521 pr 3, 15:07 to 15:30, 140 samples at 10 s: 9.2 cores, load p50 20 p90 35, kernel 45 %, 40 % of samples at 95 %+, spotlight 0.4 cores, git start 7.1 ms (n=27), no clean go suite row: the one match was a chain with typecheck and vitest. Its codie started before `LANG` landed
- 2 lanes, FRM-521 pr 3 + FRM-524, 15:30 to 15:40, 52 samples: 10.0 cores, load p50 20 p90 30, kernel 50 %, 50 % of samples at 95 %+, spotlight 0.2 cores, git start 8.1 ms (n=10), no go suite in the window: too thin to compare, lane 1 merged at 15:39
- 1 lane, FRM-524, 15:40 to 15:46, 32 samples: 6.7 cores, load p50 14 p90 20, kernel 44 %, 13 % of samples at 95 %+, git start 5.8 ms (n=6): too thin
- 2 lanes, FRM-524 + BYT-132, 15:46 to 16:22, 189 samples: 8.7 cores, load p50 15 p90 30, kernel 42 %, 29 % of samples at 95 %+, spotlight 0.1 cores, git start 6.2 ms (n=35), go suite run p50 56 s, wait p50 0 s (n=6): `LANG`-era codies
- 3 lanes, FRM-524 + BYT-132 + FRM-528, 16:22 to 16:29, 32 samples: 13.5 cores, load p50 41 p90 50, kernel 48 %, 84 % of samples at 95 %+, spotlight 0.2 cores, git start 8.9 ms (n=7), no go suite in the window: too thin, but the first row near full
- 2 lanes, FRM-524 + FRM-528, 16:29 to 17:59, 445 samples: 10.8 cores, load p50 23 p90 49, kernel 50 %, 55 % of samples at 95 %+, spotlight 0.2 cores, git start 7.5 ms (n=90), go suite run p50 50 s, wait p50 51 s (n=10)
- 3 lanes, FRM-524 + FRM-528 + BYT-106, 17:59 to 18:06, 34 samples: 12.8 cores, load p50 34 p90 81, kernel 50 %, 79 % at 95 %+, git start 6.9 ms (n=7), no go suite: too thin
- 2 lanes, FRM-528 + BYT-106, 18:06 to 18:14, 29 samples: 13.8 cores, load p50 62 p90 109, kernel 52 %, 93 % at 95 %+, git start 11.3 ms (n=8), go suite run p50 71 s (n=5): my own slim git suites ran beside them, so not a lane number
- 1 lane, FRM-528, 18:14 to 18:29, 73 samples: 9.4 cores, load p50 20 p90 66, kernel 44 %, 49 % at 95 %+, git start 8.2 ms (n=14), a slim git rebuild beside it
- 2 lanes, FRM-528 + FRM-531, 18:29 to 18:35, 32 samples: 8.0 cores, load p50 15 p90 22, kernel 36 %, 28 % at 95 %+, git start 6.4 ms (n=6), no go suite: too thin

## the go suite after FRM-528's fixture cut, 2026-11-07

- Head 300.7 and 290.3 cpu-s, wall 41.6 and 39.3 s, load 20 to 23, against a quiet 351 to 357: about 16 % off, no same-hour base run yet. Sys stayed 60 %, so spawning less did not cut sys per spawn
- About 280 is this lever's floor; about 170 of what is left is `x` running as a real child, kept real on purpose. Dima accepted about 295 over 200 (FRM-528:W6)

## the files

- [story.md](fleet-stories/cpu-overload/story.md): the dated history, oldest first: seen, checked, assumed, verdict, tried, cost. Append a day when a round ends
- [cases.md](fleet-stories/cpu-overload/cases.md): every measured case and what it proves, plus the ladder of what to try next
- [cpu-load.md](fleet-stories/cpu-overload/cpu-load.md): the first long sample, what loads the cpu per kind of run
- [fleet-pace-under-load.md](fleet-stories/cpu-overload/fleet-pace-under-load.md): a lane's pace by lane count
- [mac-agent-cpu-overload.md](fleet-stories/cpu-overload/mac-agent-cpu-overload.md): prior art, who else hit this, its raw lanes beside it
- [doors-left.md](fleet-stories/cpu-overload/doors-left.md): every way left to more fast lanes, ranked, git alternatives included; read before choosing the next cpu step
- [git-process-cost.md](fleet-stories/cpu-overload/git-process-cost.md): what a git start costs on macOS, the `LANG` chain read frame by frame, the cheap trials left

Scripts: [scripts/](fleet-stories/cpu-overload/scripts/) (`cpu-sample.mjs`, `cpu-read.mjs`, `cpu-load-join.mjs`, `lane-count-read.mjs`, `git-start-sample.sh`, `spindump-read.mjs`, `spindump-git.mjs`). Raw data stays out of git, `~/.local/state/x/lanes/frm-525/`, except the first sample, `scripts/cpu-2026-11-06.jsonl`.
