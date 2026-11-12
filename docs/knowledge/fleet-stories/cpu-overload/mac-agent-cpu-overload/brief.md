# research brief: why does many parallel coding agents saturate this mac, and who solved it

Answer in english. Every claim carries a source link and its date; label inference as inference. Prefer first-hand measurements, kernel or vendor sources, issue trackers and engineers' own write-ups over listicles and vendor marketing.

PK-328:W31 (2026-11-07 01:15, dima): it seems like a big issue, because with cpu overload everything is slow, and i want it solved. how do we not forget it? after i halt today, how do we best preserve the context of this problem, with all cases of cpu bottlenecking? from all your replies today i did not see any surely proven verdict about the real cause of the cpu overload. how do we solve it?
PK-328:W32 (2026-11-07 01:15, dima): i still think using fewer threads is not a solution: i currently have 14, which is not a lot, and other people run 64 parallel threads somehow. ❓ how do they?
PK-328:W33 (2026-11-07 01:15, dima): another idea: i hear a lot that many people treat macos as not very agentic friendly and use linux instead, or buy that new mac mini for agentic workflows.
PK-328:W34 (2026-11-07 01:15, dima): do a proposal for how to save the context of the current problem until tomorrow's reopening of this issue, and do a wide research, all research lanes, about my issue, using all the context you have: maybe there is a known solution? has anyone else met my issue with macos? hunt any similarities to see if someone solved it. also research linux vs macos, my claim.

## the setup

- Mac16,7, Apple M4 Pro, 14 cores (10 performance, 4 efficiency), 48 GB, macOS 27.2 (Darwin 27.2.0)
- about 14 concurrent Claude Code sessions (`claude` cli, plus the Claude desktop app, Electron), each in its own git worktree of one monorepo; about 14 live worktrees, each with node_modules through pnpm
- each session constantly spawns short-lived processes: git, node, pnpm, zsh, hooks written as shell and node scripts on every tool call
- heavy runs: Go test suite (one package, about 540 tests, each spawning a freshly built test-built cli binary and git: 45 s wall, user 117 s, sys 190 s), vitest (76 cpu-s), a mods test suite (446 cpu-s), TypeScript native typecheck, mutation test rounds, lefthook git hooks on every commit
- a machine-wide queue already serializes commits and heavy runs, so usually one gate at a time, yet the machine stays saturated

## the symptoms, measured here on 2026-11-06 and 11-07

- load average 20 to 60, peaks 126 to 172, 247 once; CPU temperature 106 °C
- `top`: 40.6 % user, 59.4 % sys, 0.0 % idle at load 47: **more than half of cpu is kernel time**
- `ps` %CPU totals only about 6 of 14 cores while the system reads 100 % busy: inference, short-lived spawns that `ps` never catches
- top by %CPU at that moment: a Go test binary 62, 1Password 61, `fseventsd` 50, WindowServer 45, claude 36, Claude Renderer 33, `cfprefsd` agent 26, `opendirectoryd` 25, `syspolicyd` 19, `notifyd` 18, `cfprefsd` daemon 14
- load by what was running: nothing heavy queued 21, only a commit 19, only a mods suite 21, only a mutant round 27, only a go test or gate 51 with sys 52 %
- spawn cost under load: 100 `git --version` 0.88 s, 50 `node -e 0` 1.29 s, a fresh Go binary's first exec 0.09 to 0.23 s
- one go test run: about 5,940 lookups of `git`, 23,722 file opens, 40,563 stats
- 📌 not proven: the real cause of the sys time. Spawns explain about 17 % of the go suite's cpu by one estimate

## the vectors

1. **The kernel time on macOS.** What makes process spawn, exec, stat and open expensive on macOS against Linux? Name each mechanism with a source: Gatekeeper, `syspolicyd`, `amfid`, XProtect or code signing checks on fresh unsigned binaries; Endpoint Security clients and EDR; the sandbox; `fseventsd` under churn; Spotlight `mds` on worktrees and node_modules; `opendirectoryd` and `getpwuid` lookups per spawn; `cfprefsd` and `notifyd`; APFS metadata and clone cost; the VFS name cache; lock contention at high core counts. Any published benchmark of fork, exec or stat, macOS against Linux, on Apple silicon especially.
2. **Known fixes for macOS.** The Developer Tools privacy pane exemption for a terminal, `DevToolsSecurity`, Spotlight exclusions, `.metadata_never_index`, Time Machine exclusions, `sysctl` limits, 1Password agent or `op` overhead, disabling or tuning anything else. For each: the measured gain, on which macOS version, whether it still works, and its security price.
3. **Who hit this.** People running many parallel coding agents or many worktrees on a mac: Claude Code, Cursor, Codex, Aider, agent orchestrators such as Conductor, Vibe Kanban, Crystal, Claude Squad. GitHub issues on `anthropics/claude-code` about high cpu, hooks cost, process leaks, Bun or node overhead. The same symptom class in other fields: Go test on macOS slow against Linux (golang/go issues), Bazel, Buck, Nix, Homebrew, Chromium builds, Node and pnpm test suites on mac; `xcodebuild` and `syspolicyd` spikes.
4. **The 64 threads claim.** Who runs 30 to 64+ parallel agent sessions, on what hardware and os, and what do they actually do at that count? Does a thread there run local tests, or does it mostly wait on the model api and offload builds and tests to remote machines? Sandboxes, cloud dev boxes, remote CI runners. Separate reported fact from a boast; report core counts per session where known.
5. **Linux against macOS for agent workloads.** Real measurements of the same test suite or build on Linux bare metal, on a Linux VM on Apple silicon (Lima, OrbStack, UTM, Apple's `container` tool, Virtualization.framework) and on native macOS. Is a Linux VM on the same mac faster at spawn-heavy work? Docker bind mount costs. What is lost in leaving macOS. What the fleet would need: Claude Code on Linux, remote sessions.
6. **The mac mini claim.** Is the «buy a mac mini for agents» trend about cpu, or about an always-on box? Measured results from a second machine used as a build or test offload. A second mac against a cheap Linux box or a cloud runner: prices dated.
7. **Offload designs that fit one operator.** Running test gates remotely or in a VM while agents edit locally: remote execution caches (Bazel-style, Turborepo, Nx, Go's `GOCACHEPROG`), test impact selection, shared build caches between worktrees, CI-only heavy gates; what broke for people who tried.

## the output

- for each vector: the 3 to 6 findings that carry the most, each with its number, source link and date
- a ranked list of candidate fixes for this setup: expected gain, how to prove it here with one command or a short A/B, cost and risk
- what would prove or disprove each suspected cause on this mac, including commands that need no `sudo`
- where evidence is thin or contradictory, say so plainly. A finding of «no one has measured this» is a valid answer
