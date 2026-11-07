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
- Sessions at rest are cheap: about 15 sessions, the app and the os fit in about 4 of 14 cores (two 10 s windows)
- `ps` and activity monitor miss the load: a go run makes 661 short-lived processes a second, so the app list sums to 15 % at a real 100 %. A `spindump` sees them

## lane count rows, 2026-11-07

One row per lane count, from `scripts/lane-count-read.mjs`. A lane here is a codie and its sixth sense; main's and the wings' commits run beside it. The number to beat is 1.8× at 4-5 lanes, in [cases.md](cpu-overload/cases.md).

- 1 lane, FRM-521 pr 3, 15:07 to 15:30, 140 samples at 10 s: 9.2 cores, load p50 20 p90 35, kernel 45 %, 40 % of samples at 95 %+, spotlight 0.4 cores, git start 7.1 ms (n=27), no clean go suite row: the one match was a chain with typecheck and vitest. Its codie started before `LANG` landed
- 2 lanes, FRM-521 pr 3 + FRM-524, 15:30 to 15:40, 52 samples: 10.0 cores, load p50 20 p90 30, kernel 50 %, 50 % of samples at 95 %+, spotlight 0.2 cores, git start 8.1 ms (n=10), no go suite in the window: too thin to compare, lane 1 merged at 15:39
- 1 lane, FRM-524, 15:40 to 15:46, 32 samples: 6.7 cores, load p50 14 p90 20, kernel 44 %, 13 % of samples at 95 %+, git start 5.8 ms (n=6): too thin
- 2 lanes, FRM-524 + BYT-132, 15:46 to 16:22, 189 samples: 8.7 cores, load p50 15 p90 30, kernel 42 %, 29 % of samples at 95 %+, spotlight 0.1 cores, git start 6.2 ms (n=35), go suite run p50 56 s, wait p50 0 s (n=6): `LANG`-era codies
- 3 lanes, FRM-524 + BYT-132 + FRM-528, 16:22 to 16:29, 32 samples: 13.5 cores, load p50 41 p90 50, kernel 48 %, 84 % of samples at 95 %+, spotlight 0.2 cores, git start 8.9 ms (n=7), no go suite in the window: too thin, but the first row near full
- 2 lanes, FRM-524 + FRM-528, from 16:29, 33 min read so far, 168 samples: 9.8 cores, load p50 21 p90 46, kernel 48 %, 46 % of samples at 95 %+, spotlight 0.2 cores, git start 6.6 ms (n=33), go suite rows only filtered runs (n=3): still open

## the go suite after FRM-528's fixture cut, 2026-11-07

- Head 300.7 and 290.3 cpu-s, wall 41.6 and 39.3 s, load 20 to 23, against a quiet 351 to 357: about 16 % off, no same-hour base run yet. Sys stayed 60 %, so spawning less did not cut sys per spawn
- About 280 is this lever's floor; about 170 of what is left is `x` running as a real child, kept real on purpose. Dima accepted about 295 over 200 (FRM-528:W6)

## the files

- [story.md](cpu-overload/story.md): the dated history, oldest first: seen, checked, assumed, verdict, tried, cost. Append a day when a round ends
- [cases.md](cpu-overload/cases.md): every measured case and what it proves, plus the ladder of what to try next
- [cpu-load.md](cpu-overload/cpu-load.md): the first long sample, what loads the cpu per kind of run
- [fleet-pace-under-load.md](cpu-overload/fleet-pace-under-load.md): a lane's pace by lane count
- [mac-agent-cpu-overload.md](cpu-overload/mac-agent-cpu-overload.md): prior art, who else hit this, its raw lanes beside it

Scripts: [scripts/](cpu-overload/scripts/) (`cpu-sample.mjs`, `cpu-read.mjs`, `cpu-load-join.mjs`, `lane-count-read.mjs`, `git-start-sample.sh`, `spindump-read.mjs`, `spindump-git.mjs`). Raw data stays out of git, `~/.local/state/x/lanes/frm-525/`, except the first sample, `scripts/cpu-2026-11-06.jsonl`.
