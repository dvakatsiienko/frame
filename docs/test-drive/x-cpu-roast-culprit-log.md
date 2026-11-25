---
status: live
until: 2026-12-08
kill-read: 2026-12-02
dies-when: the verdict line below is written, by 2026-12-08
---

# x-cpu-roast-culprit-log — a scheduled job names who roasted the mac

Ticket: FRM-691

**test card:** we believe a once-a-minute job that writes one row when the load stays at 20 or more for 5 minutes, naming the lane and the processes behind it, ends the hours of `ps` hunting after a roast · we test it by reading each row it writes beside what the lanes were running · we are right if each row names the lane that ran the suite, and wrong if a roast passes with no row.

**kill rule:** 0 rows that named a real culprit by 2026-12-08 → the job is deleted (its folder, its launchd label, its siesta section).

## the measurement (exit line 0, 24 Nov, 13:58 to 14:03, the mods and speak lanes running tests, 14 cores)

four runs of one probe: `ps -Ao pid,ppid,time,%cpu,command` twice 5 s apart (plain and `-S`), `ps -Aro … | head -20`, `iostat` over the same gap, `lsof -d cwd` and a parent walk for the top 5. the probe is not in the repo, its raw output sits in the stray's scratchpad.

- the ranking by cpu-time delta and the ranking by the `%cpu` column name different processes under a suite
  - load 5.8, calm: 2 of the top 5 shared
  - load 9.3: 4 of 5 shared, the same top 1
  - load 11.2, a mods suite with 14 `claude plugin test` workers: **0 of 5** shared; the column listed five workers born after the first sample, each with a delta of 0.00 s, while the delta named the five steady burners at 70 to 77 % of a core each
  - load 19.8, a burst: 3 of 5 shared
  - so the job ranks by cpu time, never by `%cpu`
- an exited worker's cpu is gone from every ps column on macOS 27.2.1, `-S` included: `ps -S` named the same top 5 as the plain delta in all four runs (63 to 66 % of the busy core-seconds visible at load 11.2, within 3 points of each other), and a `sh -c` that waited on three `python3` children of 1 s each (`/usr/bin/time -p`: user 0.42 + sys 0.59 for one) read `0:00.01` under both `ps -o time=` and `ps -S -o time=` (24 Nov 15:00), although `man ps` promises the sum. so a spawn storm of short workers is a blind spot no ps flag closes: every row ends with `seen N of M busy core-s` (the cpu time live processes gained, against the busy cores `iostat` read at each over-poll times the window), so a blind row says so. a) the stamp remembers what each over-poll saw, so a gone worker still charges its last-seen time to its lane: only if a real roast row reads under half seen
- processes born inside the gap are a third of what ps can see: at load 11.2, 16 new processes carried 16.2 of 47.7 visible core-seconds. a delta over pids found in both samples alone would drop them, so a process born since the baseline counts its whole cpu time
- a 5 s window sees a burst only in part: at load 19.8 the window was 33 busy core-seconds of 70 possible, and the workers appeared only in the `%cpu` column. the row diffs against a baseline taken when the load first went over, not against a 5 s window
- the folder of the heaviest processes does not name the lane: the 14 suite workers ran from `/var/folders/…/x-mods-overlay-*/x-mod-stash`, neither a lane tree nor the main checkout
- the parent chain does: 50 of 1,083 live processes reached one of the 9 thread pids of `x thread list`; `x verify red` reached the mods codie in 4 hops. a node daemon parented to launchd (pid 1) reaches none: it reads «no lane»
- cost: `ps` 39 to 66 ms a call, `lsof -d cwd` 20 to 38 ms calm and 43 to 50 ms at load 11.2 (229 ms for 5), `x thread list --json` 47 ms, the parent walk 0.03 ms off one `ps` sample. a poll without the 5 s gap is about 0.4 s, so a 60 s poll keeps its pace at every load measured
- the cpu-time delta and the `%cpu` column do not agree, so the job uses the delta

## rounds
- 2026-11-24 · exit line 0 measured, four probe runs under the mods and speak lanes' suites
- 2026-11-24 · wishkeeper's read: a worker that exits between the baseline and the row ranks 0 s; `-S` measured a no-op, so each row ends with `seen N of M busy core-s`

## verdict
