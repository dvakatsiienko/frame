# research brief: why git process starts cost so much kernel time on macOS, and how to cut it

Answer in english. Name a source, its date and its version for every fact. Say «measured», «reported» or «inference» on each claim. Prefer a measurement over an opinion. A source you did not open is not cited.

## who asks and why

A developer runs many AI coding agent sessions at once (Claude Code) on one Mac. Goal: at least 16 parallel work streams, all fast. Today the machine saturates at 100 % cpu with few of them. Slowing down or running fewer is rejected: the only accepted answers make each run cheaper.

## the machine

MacBook-class Apple silicon, M4 Pro family, 14 cores, 48 GB (the owner's rows; verify nothing about it from the web), macOS Darwin 27.2.0 (`uname`), arm64, homebrew git, APFS internal disk, Spotlight on, FileVault and endpoint defaults, no third-party antivirus known. One repository of about 8.3 GB, 252,000 files.

## what is already measured here

- A Go test suite that spawns real git and a real Go cli in fixtures is the heaviest run: about 350 cpu-s, about 60 % of it sys, about 660 short-lived processes per second, load above 100 when alone. After a fixture cut: about 295 cpu-s, sys still 60 %
- 1, 2, 3, 4 copies at once cost 420, 433, 439, 441 cpu-s each, so the sys is the run's own, not contention. A ram disk `TMPDIR` cuts at most 5 %
- About 3,770 git processes in a 10 s kernel trace (`spindump`): 3.6 cores in git alone, git's samples 65 % kernel. On the stack: Sandbox 18 to 19 % of kernel samples, 26 % of git's (`hook_vnode_check_open` → `sb_evaluate_internal`), apfs 10 %, EndpointSecurity 4 %, AMFI 2 to 3 %. Entering the kernel: `__open` 693, `__execve` 307, `lstat` 230, `__getdirentries64` 209, `__fork` 178
- No `sandbox` key is set in Claude Code's settings; whose sandbox profile applies to these processes is unread
- **Setting `LANG` made every git start 1.7× faster**: 500 `git --version` 4.34 → 2.62 s (`LC_ALL=C` 2.41). Go suite 13 % less cpu, 16 % less wall. A kernel trace with `LANG` set, same git count: `cfprefsd` 3.56 → 0.00 cpu-s, `opendirectoryd` 2.27 → 0.01, `notifyd` 1.60 → 0.13, git 36.2 → 24.9 cpu-s, p50 9 → 6 ms per git. Reading: homebrew git links `libintl` and CoreFoundation; with no locale it asks macOS for the language on every start
- Sessions at rest are cheap: about 15 sessions, the desktop app and the OS fit in about 4 of 14 cores
- An earlier research round already holds: claude-code issues #107009 (idle desktop processes at about one core each), #104173 (the Developer Tools exemption does not reach the Bash tool: 40 of 40 fresh binaries scanned), #107076 (hiding the desktop window cut WindowServer 34.5 % → 6.3 %), and a Mac mini report with load 172 when two test runs overlapped. Do not re-report these; extend or contradict them

## vectors

1. **Confirm or break the `LANG` finding.** Does anyone else report slow process starts on macOS with no locale set, in git or in any program linking CoreFoundation or gettext or libintl? Is the 1.7× known? Why exactly: `CFLocaleCopyCurrent`, `cfprefsd`, `opendirectoryd`? Is `LC_ALL=C` safe for git, and what does it break?
2. **More tricks in that same family.** What else makes a git or any process start cheaper on macOS: how git is built (homebrew against Apple's `/usr/bin/git` against a static or custom build, `NO_GETTEXT`, `libintl`, dynamic library count, dyld closures), env vars (`GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL`, `HOME`, `GIT_OPTIONAL_LOCKS`, `GIT_ATTR_NOSYSTEM`), config reads and `includeIf` cost per start, `core.fsmonitor`, `core.untrackedCache`, `feature.manyFiles`, `index.version`, split index. Give per-start numbers where they exist
3. **macOS's process start cost itself.** `fork`/`exec`/`posix_spawn` cost against Linux on the same hardware, the published numbers; AMFI and code signature checks, `syspolicyd`, Gatekeeper first-run scans, the dyld shared cache, `Sandbox` `hook_vnode_check_open`, EndpointSecurity clients. What is the known per-process floor on Apple silicon, by macOS version? Did macOS 26 or 27 raise it? Is sandboxed-parent cost inherited by children, and how would one read whose profile applies?
4. **Similar cases, anywhere.** Reports of high `sys` under many short-lived processes on Macs: Hacker News, Reddit, Stack Overflow, Apple developer forums, the Go issue tracker (test suites and `os/exec` on darwin), Bazel, Buck2, Nix on macOS, Homebrew, ccache, Rust cargo, Chromium's build, the git mailing list. What did those projects change, with what measured gain?
5. **Doing without the process.** In-process git libraries (gitoxide/gix, go-git, libgit2), a long-lived `git cat-file --batch` or `git fsmonitor`-like daemon, jj's process count, and test fixtures that avoid spawning. Which real projects swapped, what speedup did they measure, what broke? Hooks and git-crypt filters make this harder: say so where it bites
6. **Spawn-heavy test suites.** How large projects keep a process-spawning test suite cheap on macOS: fixture snapshots, copy-on-write `clonefile`, `posix_spawn` against fork-exec in Go's `os/exec` and what Go's runtime does on darwin, a shared server per test run. Numbers
7. **What would you want to know that this brief did not ask?** Anything else that would help solve this: one thing per finding, with its source

## output shape

Findings grouped by vector, each with: the fact, the number, the source link, its date, measured or reported. Then **a ranked list of the 5 cheapest things to try on this machine**, each with the one command that would prove or kill it and the expected gain. Then what you looked for and did not find. Under 2,500 words.
