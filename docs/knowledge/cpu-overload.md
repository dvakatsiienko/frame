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
- **A shell with no `LANG` makes every git start 1.7× slower**: 500 `git --version` 4.34 → 2.62 s, the go suite 13 % less cpu and 16 % less wall, vitest 3 % less cpu (abba). `settings.json` now sets it for cc's shells; a new launchd job or bare `env -i` shell has none. Check a shell with `echo $LANG`
- Sessions at rest are cheap: about 15 sessions, the app and the os fit in about 4 of 14 cores (two 10 s windows)
- `ps` and activity monitor miss the load: a go run makes 661 short-lived processes a second, so the app list sums to 15 % at a real 100 %. A `spindump` sees them

## the files

- [story.md](cpu-overload/story.md): the dated history, oldest first: seen, checked, assumed, verdict, tried, cost. Append a day when a round ends
- [cases.md](cpu-overload/cases.md): every measured case and what it proves, plus the ladder of what to try next
- [cpu-load.md](cpu-overload/cpu-load.md): the first long sample, what loads the cpu per kind of run
- [fleet-pace-under-load.md](cpu-overload/fleet-pace-under-load.md): a lane's pace by lane count
- [mac-agent-cpu-overload.md](cpu-overload/mac-agent-cpu-overload.md): prior art, who else hit this, its raw lanes beside it

Scripts: [scripts/](cpu-overload/scripts/) (`cpu-sample.mjs`, `cpu-load-join.mjs`, `spindump-read.mjs`, `spindump-git.mjs`). Raw data stays out of git: `~/.local/state/x/lanes/frm-525/`.
