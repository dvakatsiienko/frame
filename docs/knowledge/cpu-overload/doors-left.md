---
fed-by: incidents
---

# doors left — every way we found to more fast lanes, ranked

Ticket: FRM-525

Asked 2026-11-07: exa, parallel, an opus source lane, on our own rows. Raw lanes: [doors-left/](doors-left/). Marks: measured, reported, inference.

## the verdict

**No git beats a custom minimal build, and a git start is no longer the big cost. The largest door left is running fewer heavy suites.** All three lanes agree on that. 16 local whole suites at once do not fit 14 cores at about 240 cpu-s each, so 16 busy lanes need less work per lane, or more machines (inference).

## ranked

1. **Results shared by byte hash, for go, vitest and the twin.** A suite on bytes already proved never runs again
   - gain: 27 of 69 whole mods runs repeat a head, an upper bound, measured; 30 to 50 % of heavy runs, inference
   - test: add `git rev-parse HEAD:x/go` and a dirty flag to each `test-cpu-budget.log` row, read a day's repeats
   - risk: a test reads what the key misses, toolchain, fixtures or env
2. **Vitest selection at commit.** Whole on 260 of 368 commit rows, `related` on 29, measured; about 26,000 cpu-s in 26 h, inference
   - test: read `script/test-commit.sh`'s reasons against `test-commit.log`, replay a day
   - risk: a missed test reaches main, ci still catches it
3. **A Linux VM with the checkout on its own disk.** The one door that could change kernel cost per spawn, 60 % of the suite. No primary number exists anywhere
   - reported: bind mounts about 2.5× slower than the VM's disk (Mainardi, 2025). It adds no cores
   - test: half a day, Lima is installed, the 2,000-spawn program from `cases.md`, then one suite
4. **A remote Linux box.** The cleanest added capacity, the one door that adds cores. Hetzner AX102, 16 cores, from €159 a month, reported, no suite measured there
5. **The `nostacks` pass at merge.** `pnpm x-go:test` reruns 29 of 57 test files outside the budget row, measured; cost unread. Test: `time sh x/go/nostacks-pass.sh`
6. **The queue's ad hoc scripts get a budget.** 42 % of run wall in 26 h, measured, FRM-525's own trials included
7. **Each `x` verb stops asking git the same thing.** 5.9 git spawns a verb, 3,047 of 7,066 are `rev-parse`, measured before `LANG` and slim; 20 to 35 cpu-s, inference
8. **Cut `x`'s start.** 16 ms cpu against slim git's 2.8, measured. `GOGC=off` alone reads 12.2; chroma's tables take about 5.8 of init. 5 to 13 cpu-s, inference
9. **Fixture setup through `git fast-import` or go-git.** 20 to 40 cpu-s, inference; 702 sites behind one helper, measured
10. **Find the mods' heavy test files.** Start is at most 13 % of 527, so at least 87 % is test bodies, measured bound. `orbit.test.ts` is 5,234 lines
11. **Vitest pools and isolation.** Default today, `threads` and no isolate untried, no number. `vitest doctor` compares them, reported
12. **`-vet=off` in `x-go:gate`.** It already vets apart, so the run's vet is free to drop; size unread
13. **The Developer Tools exemption for gates outside the claude tree.** [#104173](https://github.com/anthropics/claude-code/issues/104173): Bash children lose it, 40 of 40 fresh binaries scanned against 1, reported. Helps wall on fresh binaries, cpu small here. A system setting, his call
14. **A machine-wide admission gate.** `gate-queue.sh` is this already for gates. `cpuq`'s author reports load 36 to 120 down to 5 to 9 on a 10-cpu Mac; no more throughput, a better mac

## shut

- **An in-process `x` harness or fork server:** at most 19 cpu-s of 240, for a rewrite of every verb, since x reads process env and cwd. Exa ranks a persistent worker high, by inference; the source lane read the code and its numbers win until measured
- **The dyld closure, Sandbox hook and JIT flags:** no owner door
- **Sapling, Dulwich, jj, Scalar, container-use:** each spawns git, runs on Python, or only tunes big repos

## git alternatives

**None replaces a write with hooks, signing and clean and smudge filters together.**

- [gitoxide](https://github.com/GitoxideLabs/gitoxide) 12,109 stars, active: no hooks, no filters at checkout, no push, read at bc4d8135
- [go-git](https://github.com/go-git/go-git) 7,848 stars: no hook call, fits fixture setup only (inference)
- [libgit2](https://github.com/libgit2/libgit2) 10,643 stars: a library, hooks and filters are ours to write
- [grit](https://github.com/gitbutlerapp/grit), GitButler's, 586 stars, 7 months old: its README says its cli «is not a Git-identical CLI», so no drop-in; its library may fit reads. Its benchmark: commit 16.8 against 27.2 ms, Linux, its own
- [ziggit](https://github.com/hdresearch/ziggit), 259 stars, last push 2026-05-06: claims drop-in and 4 to 10× on macOS, its own numbers; output differs by default; our matrix unproven
- [jj](https://github.com/jj-vcs/jj) 32,394 stars: spawns git for remotes, no git hooks

## where the lanes split

- Exa and parallel rank selection first; the source lane ranks byte-hash results first, by the logs. Both cut runs
- Exa's first move is a global job server; parallel and our rows say a queue moves the wait and only keeps the mac usable

## surprises

- 3 suites took 128 s on slim git, so the mac's rate is about 1.4 suites a minute, up from 1
- Vitest at commit plus the twin at push cost about as much wall as all go rows together
- Codex's tracker holds 10 issues on `syspolicyd` storms; this mac reads 0.058 core, a different shape (inference)
- Mods run one mod at a time, but its files run concurrently, 5.3 cores

## not found

A primary fork or exec rate in a Linux VM on Apple silicon. Any 16-lane run on one Mac, by anyone. First-hand sessions per machine from any platform. Repeats by bytes in our logs: door 1's size stays inference until the log column lands.
