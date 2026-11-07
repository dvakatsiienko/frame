# cpu overload — the story, oldest day first

Append a day when a round ends. Labels: seen, checked, assumed, verdict, tried, cost. `[read]` means the source was opened, `[recalled]` that a later document tells it. Line numbers in sources date from 2026-11-07, before the files moved here.

first sighting: 2026-08-26, a spinning fan and sticky typing in warp, one 86 min session; the cause of the WindowServer part stayed open (session-meta f12cf6d2, facets f12cf6d2:22).
turning point: 2026-11-06, a kernel freeze at 15:22, then load 126 to 140 at 18:02 with four lanes' gates at once; from there it became a measured problem (pk-328:35, gazette 2026-11-06-two-lanes-to-merge.md:73).
wrong turns: 240 hz (08-26), «red for seconds is normal» (11-05), finder as the cause (11-03 to 11-06), the commit gate as the main load (11-06), «fixed» (11-06), 2.5× at load (11-07), fewer lanes (11-07) (facets f12cf6d2:20, tr 9939ff19, pk-310:33, cpu-load.md:5, pk-328:76, cpu-cases.md:7, :53).
proven: go test runs spawn the git that fills the kernel, on two windows, one each; the mods suite fills user cpu; one go suite alone reads 96 % busy on a quiet mac, one dose run (cpu-cases.md:40-43, doses.tsv:2).
open: why a go suite costs what it costs at the kernel, whose sandbox profile hits git, spotlight, what wedged the kernel on 11-06, and whether 16 lanes can run (cpu-cases.md:32, :73-79, firelink AGENTS.md:7, FRM-525 done test).

key to short sources, all read 2026-11-07. clock is local, UTC+2, except a time marked Z; a day is the local day.
- `cpu-cases.md` is now `cases.md`, `cpu-load.md` sits beside it; `proposal-superseded.md`, `slow-commits.md`: `/Users/dima/frame/docs/test-drive/gate-speed/`; `gate-speed.md`: `/Users/dima/frame/docs/test-drive/gate-speed.md`
- `research`: `mac-agent-cpu-overload.md`; `pace`: `fleet-pace-under-load.md`, both beside this file
- `pk-N`: the item's file in `/Users/dima/frame/_clio/pocket/tasks/`, or `pocket/archive/tasks/` for pk-321 and pk-325
- `gazette`: `/Users/dima/frame/_clio/gazette/`; `flawlog`: `/Users/dima/frame/home/.claude/shelf/flawlog/`
- `session-meta` and `facets`: `/Users/dima/.claude/usage-data/`; `tr <id>`: a transcript under `/Users/dima/.claude/projects/`, in `-Users-dima-frame-cclio` before 10-30, `-Users-dima-frame--clio` after, read by `rg` only
- `queue log`: `/Users/dima/.local/state/x/gate-queue.log`, starts 11-06 19:38; `doses.tsv`, `ab-ram rows`: `/Users/dima/.local/state/x/lanes/frm-525/dose-20261107/doses.tsv`, `.../ab-ram-20261107/rows.tsv`
- searched, nothing found: his typed lines with «red cpu» in the clio, old clio, frame and home transcript dirs; cpu in `gazette` before 11-06 as a machine problem; `/Users/dima/frame/_clio/memory/dima-stories.md`. not searched: lane worktree transcript dirs, screenshots. nothing found between 10-13 and 11-03, which is not proof of nothing, since he says red cpu came and went for a long while

## 2026-08-26

- seen [read]: his words, «yo. my laptop's fan spins. why? something is running? also typing into warp feels slow and sticky». the earliest line found on this problem (session-meta f12cf6d2, start_time 2026-08-26T10:30:16Z)
- checked [recalled]: a process read named steam, figma and chrome as cpu hogs; WindowServer kept a remaining load (facets f12cf6d2:22)
- assumed [recalled]: claude called the machine «overloaded», then took it back; later it proposed a 240 hz refresh theory. corrected the same session, its own measure disproved 240 hz (facets f12cf6d2:20)
- verdict [recalled]: stickiness fixed; the WindowServer cause stayed unresolved, outcome «partially achieved» (facets f12cf6d2:8, :22)
- tried [recalled]: dealing with steam, figma and chrome fixed the stickiness; the exact steps are unknown, the transcript is not on disk under `~/.claude/projects` at depth 2 (facets f12cf6d2:22)
- cost [read]: 86 min, 16 of his messages (session-meta f12cf6d2:5, :6)

## 2026-09-05

- verdict [read]: the insights report still listed the «Mac fan investigation» as ending with WindowServer unresolved; no new look that day is known (tr 3705a0f1, 2026-09-05T18:11:44Z; `/Users/dima/.claude/usage-data/report-2026-09-05-192556.html`)

## 2026-09-26

- seen [read]: a 100 % cpu relayed by «homerow», who that is unknown; the BYT-105 coder traced it to its own two motion-loop bakes, about 71 s of one full core each (tr 462e6a1a, 2026-09-26T16:33:48Z)
- verdict [read]: not a runaway, the server read 0.0 % after; one process on one core, not the fleet shape (tr 462e6a1a, 2026-09-26T16:33:48Z)

## 2026-10-10

- seen [read]: `biome __run_server` at about 95 % cpu for 21 h, pid 99840, under the editor's biome extension; WindowServer 48 %, chrome about 18 % per helper, claude.app 15 %, vorssaint 13 % read as normal (tr 15b80e3c, 2026-10-10T16:17:49Z)
- assumed [read]: a stuck file watcher, marked inference then, log not checked; no later correction found (tr 15b80e3c, 2026-10-10T16:17:49Z)
- seen [read]: his words on it, «why is it overloading my CPU? I didn't know about it» (tr 15b80e3c, 2026-10-10, line time not read)
- verdict [read]: reported as an info line with no fix asked, a flaw he caught; the lesson went to comms, not to the cpu (flawlog 2026-10-10-memory-sweep.md:14)

## 2026-10-11

- seen [read]: his words, «q: what currently loads my cpu so hard?», clock not read, the recap puts it before 18:20 (tr 6c42a1db, recap 2026-10-11T15:27:13Z)

## 2026-10-13

- verdict [recalled]: a session summary records «Mac CPU: Cursor's Biome LSP (PID 17945, bytes window) at 105 % — not ours; he rebooted»; the event's own date is unknown, 10-11 to 10-13 (tr 5b50cffe, 2026-10-13T13:26:29Z)

## 2026-11-03

- seen [read]: finder bursts to 98-99 %, 907 MB after 6 days up; a relaunch did not stop them, 16:00 to 16:05 max 98 %, 8 of 75 polls at or over 15 % (pk-310:20)
- seen [read]: x-speak idle at 13-16 % in every top sample, 72:37 h of cpu in 6 days, about half a core, its mic engine live while idle; his ask at 15:48 (tr 668daff8, 2026-11-03T13:52:11Z)
- checked [read]: finder's stack read TFSInfo icon and tag fetch, TNode sync, FileProvider, iCloud (pk-310:20)
- assumed [read]: a restart would clear it, iCloud desktop and documents sync next. the restart did not settle it, and sync was not the trigger alone in one window (pk-310:20, :28)
- tried [read]: his restart put off to after the halt, «ill try later after halt», pk-310 filed (pk-310:20; commit 45d53ad2)

## 2026-11-04

- seen [read]: 5 min watch with no restart, 7 of 75 polls at or over 15 %, max 99 %, 450 MB; macOS report at 15:39, finder 97 % for 93 s, 2,376 MB, after a disk eject at 15:36 (pk-310:26, :31)

## 2026-11-05

- seen [read]: mods-verify's commit hit 5 s timeouts at load 25, his «how to fix?»; the earliest load number tied to gates that was found (pk-321:59, :69, 19:11)
- seen [read]: a commit preceded by a wait loop on load average, up to 80 × `sleep 15`, so stagger by hand already existed (slow-commits.md:205, session 9939ff19, 19:08)
- seen [recalled]: a handoff saw finder at 100 %, 3 GB, 35 h up on the night of 11-05; where the 3 GB sat was not checked (pk-310:28)
- checked [read]: after the restart at about 13:53 (his note says «rebooted yesterday», uptime says today; both reported): idle watch 0 of 75, max 4.4 %, 125 MB (pk-310:28, :44; tr 9939ff19, 2026-11-05T14:51:30Z)
- assumed [read]: 16:57 closed pk-310 as «bursts gone». corrected at 17:13 on his tick: 5 of 75, max 115 % under a lane, the close was an idle window (pk-310:29, :31, :33)
- assumed [read]: «Finder reports 0 windows». corrected at 17:14: a bad instrument, system events named one window on `~/frame` (pk-310:33, :35)
- checked [read]: controlled runs, 5 min, same churn: window open with sizes on 4 of 75 max 160 %; closed 1 of 75 max 19 %; open with global sizes off 0 of 75 max 9.2 % (pk-310:40)
- verdict [read]: finder's list-view «calculate all sizes» re-walked the 8.3 GB, 252k-file repo while a window sat on it; one run on a fresh finder, the 11-04 burst and the 2.4-3 GB growth stay unsolved (pk-310:40)
- tried [read]: calculateAllSizes set false on his tick, finder relaunched 17:54; the 11-06 runs below still show bursts (pk-310:40, :50)
- assumed [read]: the side channel told him red for a few seconds during a commit or test is normal, «my read, no baseline»; red with no lane running would not be. 11-07 03:54 is the case he then questioned, and one heavy run does fill the mac (tr 9939ff19, 2026-11-05T16:15:09Z; pk-328:121; doses.tsv:2)

## 2026-11-06

- seen [read]: 00:23 his ask to measure and optimize the commit and red-proof gates, then framed as speed, not cpu (pk-328:26)
- seen [read]: 01:08 a commit at 88 s at load 38 (pk-328:29, :31)
- checked [read]: finder under two side lanes: 14:29 window open 8 of 75, max 51.5 %, load 16-19; 14:36 closed 5 of 75, max 38.4 %, load 22-37; 15:05 settled and closed 0 of 75, max 10.8 %, load 30.7 (pk-310:50, :52, :56)
- verdict [read]: bursts follow an open window or a recent touch, a settled closed finder is quiet, one run each, the side channel's inference. that finder stayed quiet at load 30.7 is the only reading here of finder against load (pk-310:56)
- seen [read]: the freeze. his words, «my mac overloaded and froze, then black screens on both laptop and monitor». steam fx resumed while clicking highball's steam, lanes running; login about 2-3 min after (pk-337:22)
- checked [read]: the trace: vm woke about 15:22:26, a lane's bash never left the kernel from 15:22:37, the watchdog killed WindowServer 15:25:38, force reset 15:29 to 15:31; no kernel lines for 15:15 to 15:26:40 (tr 2e3b8126, 2026-11-06T13:54:25Z; pk-310:58)
- verdict [read]: a kernel-level wedge outlived force-quitting the vm and highball, confidence medium; the vm as trigger is inference from one sample, the lock holder and memory state unverified, cause unknown (tr 2e3b8126, 2026-11-06T13:54:25Z; `/Users/dima/frame/firelink/AGENTS.md:7`)
- checked [read]: slow login: 17,275 temp entries, 400 MB, at 15:54, and `dirhelper` the only worker for 137.7 s before WindowServer, inference; a link to the leak unmeasured (FRM-517 description)
- tried [read]: apple report FB25461148, firelink vm rules in 44673e1c, FRM-517's one `TMPDIR` per test run in fd8d5d8e: new temp names per `pnpm test` 840 → 0 (pk-337:28; FRM-517 comment)
- seen [read]: 17:59 three commit-hook tests timed out at 5 s on main; 18:02 load 126 by crow's and clio's read, 140 by clio's broadcast and the gazette, 14 go test, mutant and red-proof runs plus 2+ plugin tests (pk-328:35, :37; tr 0f9b420c, 2026-11-06T16:03:20Z; gazette 2026-11-06-two-lanes-to-merge.md:73)
- seen [read]: four lanes at once by the 18:20 gazette update (gazette 2026-11-06-two-lanes-to-merge.md:72)
- tried [read]: 18:03 stagger line to all four lanes, wait under load 18 before a gate, mutants last; its effect was not measured (pk-328:35; tr 0f9b420c, 2026-11-06T16:03:20Z)
- tried [read]: 18:16 `script/gate-queue.sh`, one heavy run at a time machine-wide; a commit then waited behind mutant rounds, 590 s and died (commit 6db891df; pk-328:44)
- assumed [read]: his words, 18:32, «i assume this CPU overloading was only partially related to the finder issues, most likely caused by gate commits». partly corrected at 19:43, then by the 22:09 sample (pk-328:49; proposal-superseded.md:36; cpu-load.md:5)
- assumed [read]: his words, 18:32, «i thought our tests via Go and vitest are fast tools. why do they overload my CPU?» his worry of a bad config came back no: vitest about 5 cores, go about 7, capping doubles the wall (pk-328:47; proposal-superseded.md:33)
- checked [read]: a one-run bench at load 20-37: go 45 s, 308 cpu-s, sys 190 over user 117; vitest 14.7 s, 76 cpu-s; a ram disk `TMPDIR` changes nothing; about 5,940 git lookups over 539 tests (proposal-superseded.md:23, :24, :26)
- assumed [read]: go's test cache misses on an unchanged tree. retracted, it was the prober's own env (proposal-superseded.md:25, :1)
- assumed [read]: «capping saves no cpu». corrected: go saved 15 % at more than twice the wall, and he called it a poor tradeoff, no cap built (proposal-superseded.md:33, :1; pk-328:79)
- verdict [read]: 19:43 «the wait is the real cost» and «fixed». both retracted by 20:33: the queue is younger than his complaint, waits of 989 and 1,011 s came at 20:08 after the fix (proposal-superseded.md:14, :1; pk-328:76)
- tried [read]: 19:25 commit 4739e4ed, a long slot and higher test timeouts. side effect found 11-07: its sleeping `gate-queue.test.ts` took the commit's test step from about 13 s to 26-28 s, even at load 7 to 11 (commit 4739e4ed; cpu-cases.md:53; pace:39)
- tried [read]: 21:01 related tests at commit on `codie/*`, 8 commits replayed at 0 to 23 s against about 13 s; catch rate unmeasured (commit c002618c; gate-speed.md:97)
- seen [read]: 20:14 his words, «clicking a SW (band) is lagged», «maybe 100 % cpu load, maybe not» (pk-325:72)
- assumed [read]: his words, 22:03, «the commit gate seems the main reason for cpu overload and fleet hangs», with at least 14 lanes seen; corrected the same evening (pk-328:100; cpu-load.md:3, :5)
- seen [read]: 22:03 his words, «your commit just took 8 minutes»; his screenshot 7m57s, 201 s by the transcript, the rest unexplained (pk-328:103; cpu-cases.md:54)
- checked [read]: 22:09 to 22:36, n=136, 14 worktrees: load p50 24, p90 73, max 100; user 41 %, sys 33 %; `ps` sums 557 of about 1,020 busy; only a go run load 51 with sys 52 %, only a commit 19, nothing queued 21 (cpu-load.md:11-17, :23-28)
- verdict [read]: «the commit gate's own run is not the overload; its wait is the commit's pain, and the go suite is the cpu's», one window, a correlation (cpu-load.md:5, commit 6673076e)
- seen [read]: load 133.66 at 23:28:40 and 152.97 at 23:28:51, the highest logged rows that day; the logs start 19:38, so 18:02 has no row (queue log, 2026-11-06T23:28:40; `/Users/dima/.local/state/x/gate-steps.log`, 2026-11-06T23:28:51)
- seen [recalled]: «peaks of 126 to 172» written at 21:01; no log row reads 172, its source unknown (gate-speed.md:61, commit c002618c; rg of the three logs)
- assumed [read]: 23:36 his words, «i thought go is fast, and my mac is pretty strong. why then the bottleneck?» owed an answer on 11-07 (pk-328:117; pk-346:26)
- cost [read]: 20:00 to 22:05, commits ran 16 min and waited 76, n=34 (cpu-load.md:43)
- cost [read]: from 19:39 for 6.6 h, 892 min waited against 605 run, about 2.25 sessions stuck at any moment (cpu-cases.md:9)
- cost [read]: 4 lanes 24 sessions at 20:00, 5 lanes 25 at 21:00, load p50 30 to 36 per hour (pace:89, :90)

## 2026-11-07

- seen [read]: 00:02 load 213.76, 00:12 load 247.81 while `measure.sh` ran; `cpu-cases.md` lists 247 under 11-06, the log's row is 11-07 (`gate-steps.log`, 2026-11-07T00:02:36; queue log, 2026-11-07T00:12:06; cpu-cases.md:52)
- tried [read]: 00:13 pr 132, the gate owns its turn; 00:46 to 01:16, n=154: peak load 100 → 49, sys share 33 → 35 %, so not the cpu's fix, one window (commit 4afa0cd0; cpu-cases.md:83)
- seen [read]: 01:08 load 47, 40.6 % user, 59.4 % sys, 0 % idle, `ps` about 6 of 14 cores, 106 °C on his screen (cpu-cases.md:51)
- verdict [read]: 01:15 his words, «i did not see any surely proven verdict about the real cause of the cpu overload»; FRM-525 opened (pk-328:112; FRM-525 W1)
- assumed [read]: 01:15 his words, «using fewer threads is not a solution», 14 against others' 64; 01:38 the 64 was the bun migration's author, how he balanced gear unknown. no first-hand report of 64 local sessions found (pk-328:113, :118; research:25)
- seen [read]: 01:29 his words, «cpu bottleneck slows down fleet very a lot», and «the most lanes at once during all fleet history» (tr 89a213e9, 2026-11-06T23:29:46Z)
- checked [read]: 01:32 a leak of ours: 24 fixture pre-commit hooks from pr 132, alive 1.5 to 3.2 h, about 240 of the 290 spawns/s floor, about 0.5 core direct (cpu-cases.md:58)
- checked [read]: first exec of a fresh binary 30× slower, 200 → 5.5 ms, waiting more than cpu; per spawn `true` 1.2 ms, `git --version` 6.6, `node -e 0` 25 (cpu-cases.md:61, :62)
- checked [read]: ruled out as the main cost, one window each: memory, fseventsd, 1password, gatekeeper as cpu, edr, otel, idle claude spin, 7 fsmonitor daemons (cpu-cases.md:34, :66-71)
- checked [read]: research, exa, parallel, a source lane and a local measure: cause of the sys time unproven and no public source measures it; pelton, same machine, load 172 with two test runs overlapping, solved by a queue, a 45 % cap and module-scoped tests; linux and mac mini no evidence (research:13, :17, :25-27; commit 777abdb3, 01:36)
- checked [read]: 01:43:54 spindump, 10 s, load about 30, go run live: 6,612 processes in 10 s; git 3,773, 36.2 cpu-s, 3.6 cores, 65 % kernel; sandbox 26 % of git's kernel samples (cpu-cases.md:28-32; commit 0100babf)
- seen [read]: 01:52 his words, «if git is guilty, how is that even possible?» and a target of at least 16 lanes (FRM-525 W4, W5)
- seen [read]: 02:04 his words, «cpu roasting», on 14-15 threads with 4 lanes, and he asks how much slower the fleet is (tr 89a213e9, 2026-11-07T00:04:31Z; FRM-525 W6)
- checked [read]: 02:04:57 second spindump, no go test: git 3,773 → 35, kernel samples 5,965 → 1,603; `2.1.319` workers took 8.7 cores, read as the mods suite, inference; about 15 sessions at rest fit about 4 of 14 cores (cpu-cases.md:40-44; commit 594f703e)
- verdict [read]: «proven, two 10 s windows» go tests fill the kernel through git, the mods suite fills user cpu; the same file calls it «strong but not repeated», and the research doc's «unproven» was written before these windows and still stands in it (cpu-cases.md:5, :38; research:13)
- assumed [read]: a commit's test step 13 s alone, 35 s at load, about 2.5×. corrected at 02:28: mostly `4739e4ed`; same suite ×1.14 p50, ×1.43 p90 at load 16+ (cpu-cases.md:53; commit 72e0be7a; pace:40, :69)
- tried [read]: 02:13 pr 139, go fixtures from a template, pocket-only commits skip the test step; pr rows user + sys median 385.1 → 277.7 cpu-s, 27.9 %, wall 62.8 → 44.3 s; effect on machine load not checked (commit 6243007a; FRM-521 comments)
- tried [read]: 01:36 fixture hook wait bounded, `markerWait`; 02:15 test-cost rules in `x/go/AGENTS.md`; the 24 live hooks left alone (commit 69803346; commit f9b26989; `/Users/dima/frame/x/go/AGENTS.md:28-35`; FRM-521 comment)
- verdict [read]: 02:24 a lane ran about 1.8× slower at 4-5 lanes than at 2, 121 → 71 tool calls per lane-hour; the same command only ×1.15 p50, ×1.75 p90; queue wait the main suspect; one unplanned window, a correlation (pace:12, :14, :19; cpu-cases.md:7-10; commit e01226a5)
- assumed [read]: pace recommended 2 lanes as default. out by his words, 02:27, «simply using fewer lanes does not work. i want more lanes at once, and all of them fast» (pace:18; FRM-525 W7; cpu-cases.md:7)
- seen [read]: 03:54 his words, «i just saw another 100 % cpu load while only one lane is left active»; 99 % on 14 cores, 109 °C, gpu 57 %, app list sums about 15 % (pk-328:121, :123; cpu-cases.md:18)
- checked [read]: ci's lane ran the whole go gate 03:50:14 for 69 s and 03:51:43 for 116 s, load 24; 03:54:59 after it, 15 % user, 9 % sys, 75 % idle, load 11; another leaked fixture, pid 91919, about 10 spawns/s. the spike's own clock is unread (cpu-cases.md:19, :20, :22; `/Users/dima/.local/state/x/lanes/frm-525/snapshot-1-lane-20261107-0355.txt`)
- assumed [read]: his words, «i thought the load came from lots of threads at once». corrected by this case and by the 14:06 dose: a heavy run fills the mac alone (pk-328:121; cpu-cases.md:21; doses.tsv:2)
- seen [read]: 04:46 his words, «i don't like bad git stuff in our setup, especially given lots of cpu issues», core.bare is to be rethought; no cost measured yet (pk-328:125; FRM-525 W10)
- tried [read]: about 04:55 a reboot, 59 s from pressing reboot, his stopwatch; FRM-517's own clock, kernel line to WindowServer, was not read, and 147 s included sign-in, so the two do not compare yet (pk-347:19; FRM-517 description)
- checked [read]: 14:06 to 14:25 dose run on a quiet mac, raw, no reading written yet: rest busy 25 %, load 6; one go suite busy 95-96 %, sys 51-53 %, at or over 95 % in 47 of 55 samples, load up to 107; 4 at once busy 99 %, load 109; vitest alone 94 %; mods alone 76 % (doses.tsv:1-3, :6, :7, :10)
- verdict [read]: my arithmetic on those rows: go copies run nearly in series, 66 s alone → 219 s at 4, and cpu per copy barely rises, about 422 → 441 cpu-s, sys about 255 → 274. this reads as the suite's own cost, not contention, one run per dose, inference; `cpu-cases.md`:79 still lists it open (`/Users/dima/.local/state/x/lanes/frm-525/dose-20261107/rows.tsv`)
- seen [read]: my arithmetic: one suite's own rows are about 6 cores, 421 cpu-s in 69 s, rest about 3.5, while `top` reads about 13.4 busy. the gap is unread (go1a time row in `dose-20261107`; doses.tsv:1, :2)
- seen [read]: the quiet runs cost 391 to 441 cpu-s on a tree holding pr 139, against the 278 pr 139 and `x/go/AGENTS.md` report. the cause is unknown; `dose.sh` sets `GIT_CONFIG_GLOBAL=/dev/null` and no other difference was read (ab-ram rows; rows.tsv; `/Users/dima/frame/x/go/AGENTS.md:30`; `/Users/dima/frame/.claude/worktrees/fork-483eb11c/.scratch/frm-525/dose.sh:10`)
- tried [read]: to 14:31 ram disk against apfs, abba: wall 69.2, 54.6 against 66.7, 53.0 s; sys 233, 234 against 248, 244. no wall gain, about 5 % less sys, one run each (ab-ram rows)
- tried [read]: 14:08 twin and wish-cover keep their dirs out of temp and trash (commit 65f2c51c)
- cost [read]: exit 5 of FRM-521, 16 runs at about 390 cpu-s, about 6,240 cpu-s on a saturated mac and up to 3.2 h of queue wait, a spec miss by wing 1 (pk-345:49)
- cost [read]: lane retros: `gate-queue.test.ts` red twice on unrelated pushes under load, commit gates load-red twice at load 40+ (FRM-525 comment, 2026-11-07)
- verdict [read]: stays open: FRM-525 is Todo at 12:18Z, its text still asks who spawns the 377 git/s, which the 02:04 window answers; done means 16 lanes with the mac usable and commit wait p90 under one run (FRM-525 description, updatedAt 2026-11-07T12:18:22Z; cpu-cases.md:40)

- checked [read]: 14:33 to 14:38 the same go suite from a rex tab against the bash tool, abba: rex 42.5 and 43.1 s, 330 and 337 cpu-s; tool 51.0 and 52.2 s, 389 and 391 cpu-s. 500 `git --version`: rex 2.25 s, tool 4.13 s, while a pure compute loop reads 2.29 s in both (`spawn-bench.tsv`, `lineage-rex.txt`, `lineage-tool.txt` in `~/.local/state/x/lanes/frm-525/`)
- assumed [read]: cwd, env, `PATH`, limits, the sandbox flag and cpu speed ruled out, so the process tree under the desktop app was blamed. wrong within minutes: `env -i` had hidden the cause, since a clean env has no `LANG` either, and a launchd job read as slow as the tool
- verdict [read]: a shell with no `LANG` makes each git start 1.7× slower, 4.34 → 2.62 s per 500, one key flipped; go suite 13 % less cpu, 16 % less wall; vitest 3 % less cpu (`tree.tsv`, `ab-lang.tsv`). why is inference: libintl asking macOS for the locale on each start
- tried [read]: `LANG` set in `settings.json`, reaching new sessions only
- verdict [read]: finder is closed as related, not the cause, on his word at 15:06. what it was: a red cpu in his status bar sent us to finder first, and its list view's «calculate all sizes» really was expensive, re-walking the repo on every file churn with a window open; that setting stays off. what clears it: at 15:03 under one lane it read 0 of 75 polls over 15 %, max 5.3 %, and the go dose runs filled the mac with finder idle (pk-310). finder's 2.4 to 3 GB growth stays unexplained; a past-a-day watch is dropped, a burst seen again reopens it
- verdict [read]: `core.bare` was never a setting of ours and nothing enabled it on purpose: it gives no perf. it is `false` in the one layer that holds it, `.git/config`, and no worktree carries an override. the `true` was a wrong write twice, 2026-10-08 and 2026-11-06: a test's `git init` under a commit hook inherited `GIT_DIR` and aimed at frame. today's doors: the gates and the push twin drop git's location vars, a test helper strips them, and a gate that writes it goes red and it goes back, red-proven
- tried [read]: cut the commit test step's two longest files: `pocket-check-on-write.test.ts` 25 → 3 s, a test polling 20 s for a record that never comes; `gate-queue.test.ts` 30 → 13 s, its 2 s poll and 2 s deadlines, one run each under other work

<!-- end -->
