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
   - test: landed 2026-11-09 (FRM-533 step 1), each `test-cpu-budget.log` row carries a code key and clean or dirty; the first hours read 2 repeats of a passing key in 8 passing runs; the day's read decides step 2
   - risk: a test reads what the key misses, toolchain, fixtures or env
2. **Vitest selection at commit.** Whole on 260 of 368 commit rows, `related` on 29, measured; about 26,000 cpu-s in 26 h, inference
   - landed 2026-11-09 (FRM-534, gate lane 1): `related` on every branch, an allow-list of kinds; the cause was a `codie/*`-only switch, 132 of 136 whole commit runs off it; the day's read lands 2026-11-10
   - risk: a missed test reaches main, the push twin and ci still catch it
3. **A Linux VM with the checkout on its own disk.** Measured 2026-11-09, FRM-536: a Lima vz VM, 10 cpus, 8 GiB, the whole tree on its disk, two runs a side, mac load 20 to 50
   - spawn: `git --version` 0.5 ms against 5.2 on the mac, cpu per spawn; Ubuntu's git against Homebrew's, unsplit (slim ran only in the suite rows)
   - go suite: 74 to 85 cpu-s against 235 to 242, wall 27 to 29 s against 82 to 89; sys 30 against 147. about 3× less
   - vitest: 133 cpu-s against 123 to 128, the same 2,102 tests (30 skipped in the VM); wall 20 s against 31 to 37 under load. no cpu win
   - so the win is go's spawn-heavy suite only. costs: 8 GiB held, a code sync per run, a toolchain kept matched; nothing that needs macOS (Keychain, launchd, 1Password, git-crypt, claude) moves. reported: bind mounts about 2.5× slower than the VM's disk (Mainardi, 2025). It adds no cores
   - raw rows, the scripts and the three research lanes: [linux-vm/](linux-vm/); its shaping is PK-373
4. **A remote Linux box.** The cleanest added capacity, the one door that adds cores. Hetzner AX102, 16 cores, from €159 a month, reported, no suite measured there
5. **The `nostacks` pass at merge.** landed 2026-11-09 (FRM-535): 235 cpu-s a run, as much as the whole suite, measured; it now runs on ci only
6. **The queue's ad hoc scripts get a budget.** 42 % of run wall in 26 h, measured, FRM-525's own trials included
7. **Each `x` verb stops asking git the same thing.** 5.9 git spawns a verb, 3,047 of 7,066 are `rev-parse`, measured before `LANG` and slim; 20 to 35 cpu-s, inference
8. **Cut `x`'s start.** 16 ms cpu against slim git's 2.8, measured. `GOGC=off` landed 2026-11-09 (FRM-535): 19.6 → 13.8 cpu ms a start through the shim, a 256 MiB limit; chroma's 5.8 ms stays, glamour needs it
9. **Fixture setup through `git fast-import` or go-git.** 20 to 40 cpu-s, inference; 702 sites behind one helper, measured
10. **Find the mods' heavy test files.** Start is at most 13 % of 527, so at least 87 % is test bodies, measured bound. read 2026-11-09 (FRM-537), `x-mod-stash`, 28 files one at a time: 286 user-s in all, 4 files hold 69 % — `quiet` 85 (235 tests), `orbit` 41, `pace` 36, `hot` 36 (20 tests, 1.8 s each). a file's own start is ~0.3 s, so start is not the cost. the whole run took 375 user-s, 89 more than the sum, because 4 files (`hot`, `pace`, `switches`, `waker`) timed out under load and ran again. keep: trimming `quiet` and `hot`, and ending the retries, is the next door, no number yet
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

Any 16-lane run on one Mac, by anyone. First-hand sessions per machine from any platform. A published same-Mac spawn rate, macOS against a Linux guest: ours (door 3) looks like the only one.
