# Every door to many fast AI coding agents on one Mac: answer in english

## the goal

One Apple silicon Mac (M-series, 14 cores: 10 performance, 4 efficiency, macOS 27, Darwin 27.2) should run at least 16 AI coding agent lanes at once, all fast. A lane is one coding agent and its reviewer, each a Claude Code session running shells, git, tests and hooks. Today the cpu sits at 100 % with a few lanes. Hunt every possible solution, from any angle, including ones we have not thought of.

## what we measured

- One whole go test suite alone holds 96 % busy, load 107. It makes about 661 short-lived processes a second, about 10,000 git starts per run. About 60 % of its cpu is kernel time. 19 % of kernel samples sit in the Sandbox kext's hook on every open, with no sandbox profile on our shells.
- 1, 2, 3, 4 suites at once cost about the same cpu each, so wall grows with the count. About one go suite a minute is the mac's rate. A queue only moves the wait.
- Per start, cpu ms: homebrew git 5.2 (706 dylibs), Apple's git 4.2 (704), the `/usr/bin/git` shim 9.1, `rg` 3.4 (85), `true` 2.0.
- Go on darwin spawns by libc fork then exec. `posix_spawn` through fastexec was 23 % cheaper per spawn, about 6 % over the whole suite, and broke 2 tests. Not merged.
- About 170 of the suite's cpu-s is the tool under test, `x`, a Go cli, running as a real child process on purpose.
- `go test -parallel 5` against the default 14, 3 suites at once: 263 against 277 cpu-s each, the same wall, a tiny spawn's p90 22 ms against 100. Alone: 226 against 270 cpu-s, wall 74 against 48 s.
- `taskpolicy -c utility` costs more cpu and much more wall.
- Vitest: about 100 cpu-s, 31 % kernel. Claude Code plugin tests: 527 cpu-s, 86 % user, one test file at a time as a child of the large claude binary.
- At rest: about 15 sessions, the app and the os fit in about 4 of 14 cores. Spotlight 0.1 to 0.4 cores. `syspolicyd` 1.5 to 2.7 cpu-s per 10 s. A ram disk for TMPDIR cuts sys 5 % at most.

## what we already did

- `LANG` set for agent shells: without it each git start ran 1.7× slower through libintl, cfprefsd and opendirectoryd
- lighter test fixtures: 386 → 308 cpu-s
- a custom minimal git: 2.56 with no gettext, Rust, perl or python, CoreServices and fsmonitor removed, 85 dylibs, 16 % off the suite
- go test capped at 5 workers

Whole suite is now about 240 cpu-s, from about 420 this morning.

## already weighed, need new evidence to reopen

jj moved its git backend toward spawning git. gix could not run commits with hooks and filters end to end, as we read it. nit (libgit2, Zig): 17 stars, too small, writes pass through to git. AI commit message wrappers do not help speed.

## vectors, cover all

1. **Git alternatives that suit agents.** Every maintained git client, library, daemon or server mode that cuts process starts or replaces the binary for writes with hooks, signing and clean and smudge filters. Adoption, last release, published numbers. Include gitoxide's real current status, libgit2-based tools, go-git, Sapling, Scalar, Dulwich, any newcomer, and anything aimed at agents.
2. **How others run agents at scale.** Cursor, Devin, Codex, Claude Code, Conductor, Factory, Sculptor, container-use, git worktree managers: what they do about this load, on one machine or many. First-hand counts of sessions per machine.
3. **macOS kernel cost.** What makes fork, exec, dyld and open expensive on Apple silicon macOS, what settings, entitlements, codesign states, Developer Tools permission, dyld closures, Endpoint Security clients, security daemons and XProtect do to it, with numbers. Which of these an owner of the machine can change, safely.
4. **Linux instead.** The same workload in a Linux VM on Apple silicon (Virtualization.framework, OrbStack, Lima, Apple's container tool, Docker): measured fork and exec rates, filesystem cost across the VM boundary, memory cost, and how agents' shells would run inside. A remote Linux box, cost per month for this workload. Whether new Mac hardware helps.
5. **Reduce the work.** Test selection by changed files, shared results across lanes that test the same tree, content-addressed test caches, in-process test harnesses for a Go cli, a persistent worker or fork server, golden template repos, fixtures with no git at all, go test cache sharing across worktrees.
6. **Schedule the work.** Admission control across many parallel agents, global job servers, cgroups-like limits on macOS, QoS, cpu affinity, priorities, how to keep the machine responsive at full load.
7. **The agent runtime itself.** The cost of the hooks, MCP servers, plugins and shell snapshots an agent harness fires per tool call. How to measure and trim them. Node or bun startup cost per spawn.
8. **Runner tuning.** Vitest pool choice and isolation cost, Go test build cache, `GOGC`, `GOMAXPROCS` for test binaries, `-p` against `-parallel`, linker and compile cost in repeated `go test` runs.
9. **Anything else.** A surprising door we have not named. Prior art that did not work, and why.

## output

Rank by the likely cpu or lane gain against the cost to try. For each door: what it is, its link, the number and who measured it, the risk, and the cheapest test on this mac. Mark each claim measured, reported or inference. Say what you could not find. A door with no number is still welcome, labelled.
