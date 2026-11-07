# lane-source: why git starts cost so much on this mac (source, traces, probes)

Local probes: 2026-11-07, 17:35 to 17:43 +0200, load 12 to 50, other work live. Timing rows are one abba pair of 200 starts each, from bash, `LANG=en_US.UTF-8` set on every start, bash's own fork inside them. Traces: `~/.local/state/x/lanes/frm-525/spindump-go.txt.gz` (01:43, no `LANG`) and `spindump-lang.txt.gz` (17:10, `LANG`). A sample count is a sum of spindump lines at 10 ms and includes blocked samples: a share, not cpu.

## Per-start table, measured here

| start | cpu ms (user + sys, mean of 2) | wall ms | dyld images |
|---|---|---|---|
| `/usr/bin/true` | 2.0 | 3.3 | env stripped, unread |
| `rg --version` (brew; pcre2, iconv, libSystem) | 3.4 | 5.6 | 85 |
| CommandLineTools `git` 2.54.0 | 4.2 | 5.3 | 704 |
| brew `git` 2.56.0_2 | 5.2 | 6.8 | 706 |
| brew `git`, `LC_ALL=C` added | 5.2 | 7.3 | |
| brew `git`, `GIT_TEXT_DOMAIN_DIR=/nonexistent` added | 5.3 | 7.2 | |
| `/usr/bin/git` (the xcode shim) | 9.1 | 13.3 | env stripped, unread |
| brew `git rev-parse HEAD` in `~/frame` | 5.8 | 7.6 | |
| `rev-parse`, `GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null` | 5.4 | 7.0 | |
| `rev-parse`, `GIT_TEXT_DOMAIN_DIR=/nonexistent` | 5.3 | 6.5 | |

## 1. The `LANG` finding

- **Confirmed, exact chain read. Measured, trace frames, 2026-11-07.** `main` → `init_git` → `libintl_setlocale` → `_libintl_locale_name_default` → `_CFPreferencesCopyAppValue…` → XPC to `cfprefsd`. Lines for `libintl_setlocale`: 2,294 no `LANG`, 108 with it (the env path). `CFPreferencesCopyAppValue`: 2,296 → 7, and not all git: `bluetoothd` shows that frame too
- **Why `opendirectoryd`. Measured.** Same stack: `_CFCopyHomeDirURLForUser` → `getpwuid` → `ds_user_byuid` → `_od_rpc_call`. Lines «blocked waiting for», whole trace: `cfprefsd` 375 → 0, `opendirectoryd` 162 → 0, `notifyd` 96 → 16
- **`CFLocaleCopyCurrent` is not it. Measured and source.** 0 trace lines; not imported by brew's `libintl.8.dylib` (`nm -u`, gettext 1.0). gettext's comment refuses it since macOS 10.13.4 and calls `CFPreferencesCopyAppValue("AppleLocale")`: `localename-unsafe.c` line 2866, [gettext-1.0 tarball](https://ftp.gnu.org/gnu/gettext/gettext-1.0.tar.gz)
- **Why `LANG` stops it. Source, same tarball.** `gl_locale_name_environ` checks `LC_ALL`, the category variable, `LANG`; only if all are empty does `libintl_setlocale` (`setlocale.c` line 1446 on) call the default. The result sits in a `static`, so it is paid once per process, every process
- **Git's side. Source.** [`gettext.c`, master fb255012, 2026-11-06](https://github.com/git/git/blob/fb255012acbcbe81189cb8014da0280b09c66ecc/gettext.c): `setlocale(LC_MESSAGES, "")` and `setlocale(LC_TIME, "")`, so setting only `LC_MESSAGES` leaves `LC_TIME` asking (inference)
- **Apple's git has no such path. Measured.** CommandLineTools `git` imports libc `_setlocale`, no libintl (`nm -u`, `otool -L`). `LANG` should not matter there (inference, not timed bare: the brief asks every timing with `LANG`)
- **Homebrew builds gettext in. Source.** `depends_on "gettext"` on macos, no `NO_GETTEXT`: [formula 6e962d4e, 2026-10-28](https://github.com/Homebrew/homebrew-core/blob/6e962d4e9f10b326c881744476c699f9c737083c/Formula/g/git.rb)
- **`LC_ALL=C`: safe for git, no gain over `LANG`.** Git's own tests run under `LANG=C LC_ALL=C`: [`t/test-lib.sh` 527-532, master](https://github.com/git/git/blob/fb255012acbcbe81189cb8014da0280b09c66ecc/t/test-lib.sh). What it changes: `is_utf8_locale()` turns false, gating PCRE2 UTF mode ([`grep.c` 325](https://github.com/git/git/blob/fb255012acbcbe81189cb8014da0280b09c66ecc/grep.c)) and making `gettext_width` use `strlen`; hooks and filters inherit it (inference). Measured here 5.2 against 5.2 cpu ms; the 14:40 row in `cases.md` reads 2.62 → 2.41 s wall. Both one window, they disagree. Keep `LANG`

## 2. Same family: more tricks

- **Every git loads about 700 images, for the fsmonitor daemon only. Measured and source: the strongest new lead.** `DYLD_PRINT_LIBRARIES`: brew git 706, CommandLineTools git 704, `rg` 85. Cause: `BASIC_LDFLAGS += -framework CoreServices`, unconditional in the Darwin block of [`config.mak.uname`, master fb255012](https://github.com/git/git/blob/fb255012acbcbe81189cb8014da0280b09c66ecc/config.mak.uname), beside `FSMONITOR_DAEMON_BACKEND = darwin`. Git's only CF and CoreServices imports: `_FSEventStream*`, `_CFArrayCreate`, `_CFStringCreateWithCString` (`nm -u`)
- **`NO_GETTEXT` alone will not drop them. Source, inference.** `libintl.8.dylib` also links CoreFoundation and CoreServices, so both must go. `NO_GETTEXT`: [`Makefile` 425](https://github.com/git/git/blob/fb255012acbcbe81189cb8014da0280b09c66ecc/Makefile). `APPLE_COMMON_CRYPTO`'s frameworks go only into `LIB_4_CRYPTO` (1887). Not built here: this lane writes nowhere
- **dyld is a big share of a git start. Measured, rough.** Git blocks, `LANG` trace, first level under `start`: `main` 2,503, `dyld4::start` 1,807, `__execve` 85, `__fork` 22. About 42 % of main plus dyld; `main` includes blocked waits, so dyld's cpu share is likely higher (inference). Inside: `applyFixups` 526, `runAllInitializersForMain` 493, `loadDependents` 223. The context window can catch a neighbour block
- **The gap. Measured.** Above `true`: brew git 3.2 ms, CommandLineTools git 2.2, `rg` 1.4. A stripped git could reach about 3.4 total (inference from `rg`)
- **Never run the shim. Measured.** `/usr/bin/git` 9.1 ms against 4.2 for the binary it ends in
- **Dead here. Measured.** `GIT_TEXT_DOMAIN_DIR=/nonexistent` with `LANG`: no gain; it returns before `setlocale` (source), so it would only help a job with no `LANG`. `DYLD_PRINT_STATISTICS`: prints nothing on macOS 27.2
- **Config cost is small. Measured, near noise.** `rev-parse` 5.8 → 5.4 ms with system and global off; this repo has 1 system, 47 global, 74 local keys, no `includeIf`. A real repo adds 0.6 ms over `--version`. Git's tests set `GIT_CONFIG_NOSYSTEM=1`, `GIT_ATTR_NOSYSTEM=1` (`test-lib.sh` 1463). `GIT_ATTR_NOSYSTEM`, `HOME` not timed «?»
- **`feature.manyFiles`, `index.version`, `core.untrackedCache`: index work, not start.** [`feature.adoc`](https://github.com/git/git/blob/fb255012acbcbe81189cb8014da0280b09c66ecc/Documentation/config/feature.adoc). Fixture repos are tiny: no gain (inference). `GIT_OPTIONAL_LOCKS=0` skips status's index refresh ([`git.adoc` 1032](https://github.com/git/git/blob/fb255012acbcbe81189cb8014da0280b09c66ecc/Documentation/git.adoc)). Per-start numbers not found
- **Signing differs. Measured.** Brew git `adhoc`; CommandLineTools git `library-validation`; shim platform 27 (`codesign -dv`). Its share of the 1 ms gap is unread «?»

## 3. macOS's start cost

- **Floor here. Measured.** `true` 2.0 cpu ms from bash; 1.26 ms in the 14:55 go row (`cases.md`). A published floor by macOS version, a 26 or 27 regression: no source found. Public xnu is [xnu-12377.121.6, commit 2025-10-16](https://github.com/apple-oss-distributions/xnu), older than Darwin 27
- **The hook runs per open, per policy. Source.** `mac_vnode_check_open` ([`mac_vfs.c` 1621](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/security/mac_vfs.c)) returns early only if enforcement is off or the cred is exempt; `MAC_CHECK` walks every registered policy ([`mac_internal.h` 264](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/security/mac_internal.h)). `security.mac.vnode_enforce` is 1, SIP on (probes)
- **`sb_evaluate` may not mean a sandbox profile applies to git. Inference, unsettled.** Flat with `LANG`: 1,070 → 1,119 lines, `hook_vnode_check_open` 589 → 701. [Project Zero, 2014](https://projectzero.google/2014/11/pwn4fun-spring-2014-safari-part-ii.html): Sandbox.kext is a MAC policy, nearly every hook can have a decision tree, «every process can have a unique sandbox profile»; nothing on a platform-wide profile. An Apple list post gave 502 then nothing through the bot fetch; hacktricks sits behind a toll. Both dropped
- **Whose profile: partly read. Measured.** `Claude.app`'s entitlements show no `app-sandbox` row; `settings.json` no `sandbox` row. Spindump's header names `Parent`, `Responsible` (`Rex Server` for one git), no sandbox field. My `sandbox_check` probe was refused twice by this lane's tool guard, so it did not run: item 5 below. Inheritance by children: no source opened «?»
- **EndpointSecurity: no third-party client visible. Measured.** `systemextensionsctl list`: 2 ClearVPN network extensions, nothing else. Running: Apple's `endpointsecurityd`, `XprotectService`, `syspolicyd`, `amfid`. So the 4 % is Apple's own or a client this list does not show (inference). `sandbox-exec` is at `/usr/bin/sandbox-exec`
- **A rewritten binary pays again, even identical. Reported.** [cargo#17467](https://github.com/rust-lang/cargo/issues/17467), 2026-09-13, open: first run 138 ms against 8 ms, new inode each build. Agrees with `cases.md`'s 30×

## 4. Similar cases

- **Go's `fork` runs libSystem's atfork handlers in the child. Source and measured.** Go imports libc `fork`: [`zsyscall_darwin_arm64.go` 1784, go dcc06a82, 2026-11-07](https://github.com/golang/go/blob/dcc06a82727b447270b1a58cc5f86b49736e317c/src/syscall/zsyscall_darwin_arm64.go). `x` blocks, `LANG` trace: `fork` 649 samples, `libSystem_atfork_child` 406, `__fork` 140, `libSystem_atfork_parent` 83. So 63 % of it is handlers whose work the next `exec` discards (inference). No clash with the 14:55 «go's fork is not the cost»: that row counts parent sys, these sit in the forked child. Upper bound: 6.5 s per 10 s against about 125 cpu-s, the 01:43 window's total: about 5 % (inference)
- **Go hit those handlers before. Reported.** [go#56784](https://github.com/golang/go/issues/56784), 2022-11-17: tests hang in `_notify_fork_child` and `xpc_atfork_child`, tied to `__CF_USER_TEXT_ENCODING` from CF-linked parents. «I looked into posix_spawn but it looks like we don't have any other ports that use that»
- **Bazel: the filesystem, not `sandbox-exec`. Reported, sources differ by date.** [bazel#8230](https://github.com/bazelbuild/bazel/issues/8230), open. 2019-05-22: darwin-sandbox 36.6 s, local 5.6 s. 2019-05-16: thousands of symlinks per action degrade badly on macOS. 2021-09-15: «I don't think `sandbox-exec` is the bottleneck», file and symlink create and delete are. Our ram-disk row says the disk is not ours (`cases.md`)
- **Node's spawn on PATH lookup, mac only. Reported.** [node#62554](https://github.com/nodejs/node/issues/62554), 2026-04-02, open: 24.14.0 → 24.14.1, 25.6.0 → 25.6.1 about 2×, 1.15× with an absolute path. This mac runs node 26.13.0; carried or not is unread «?». Worth a look for vitest

## 5. Doing without the process

- **gix cannot replace a commit with hooks today. Source.** [`crate-status.md`, gitoxide bc4d8135, 2026-11-06](https://github.com/GitoxideLabs/gitoxide/blob/bc4d8135306797b528170709b231faf3e6ebe170/crate-status.md): `status` ticked; `checkout`, `merge`, `rebase`, hook execution, «checkout with conversions like clean + smudge» unticked. So git-crypt and hook fixtures stay on real git. The README has no process-free or speed-against-spawn claim (searched: process, spawn, fork, faster)
- **jj went the other way. Source.** `git.subprocess` became default, libgit2's path dropped: [`CHANGELOG.md` 2511, 2945, jj 7fdb0d10, 2026-11-07](https://github.com/jj-vcs/jj/blob/7fdb0d1088f3592e73e31967b21322ef2299ce85/CHANGELOG.md). Fetch, push, worktree ops spawn git, push with `--no-verify`: [`git_subprocess.rs` 165-342](https://github.com/jj-vcs/jj/blob/7fdb0d1088f3592e73e31967b21322ef2299ce85/lib/src/git_subprocess.rs). Reason given: compatibility, ssh bugs
- **go-git. Source.** [`COMPATIBILITY.md`, 9decb13c, 2026-11-06](https://github.com/go-git/go-git/blob/9decb13c199a6b5b8d55df169dc3b5c22482364a/COMPATIBILITY.md): `worktree add` partial; a search for hook and smudge returned no row
- **libgit2 can lose to git. Reported, old.** [libgit2#4230](https://github.com/libgit2/libgit2/issues/4230), 2017-05-02, open: status 2.5× slower, 5 to 6× with untracked cache
- **`git cat-file --batch`/`--batch-command`** exist ([doc](https://github.com/git/git/blob/fb255012acbcbe81189cb8014da0280b09c66ecc/Documentation/git-cat-file.adoc)). A project with a measured swap: not found
- **What fixtures do matters more. Measured, a lead.** Git blocks, `LANG` trace: `cmd_fetch` 620, `cmd_receive_pack` 424, `cmd_upload_pack` 285, `cmd_push` 161, `cmd_rev_list` 156, about 73 % of `run_builtin`'s 2,268. Blocked waits are inside, and this window ran one codie's proof run. Agrees with `git push` 76 ms against `git commit` 24 ms (`cases.md`)

## 6. Spawn-heavy suites

- **Go does fork-exec on darwin. Source.** [`exec_libc2.go` 86](https://github.com/golang/go/blob/dcc06a82727b447270b1a58cc5f86b49736e317c/src/syscall/exec_libc2.go). `posix_spawn` in the code search's top 8: only syscall tables and race files. `go doc syscall.StartProcess`: «wraps ForkExec», go1.27.3. Rust uses `posix_spawn`: [`unix.rs` 73, master, read 2026-11-07](https://github.com/rust-lang/rust/blob/master/library/std/src/sys/process/unix/unix.rs)
- **What swapping would pay. Inference.** Parent sys 0.34 to 0.82 ms (`cases.md`) × 17,490 spawns is at most 14 cpu-s of 295; with the child's atfork samples about 5 % of a window. Needs a patched Go or a spawn helper
- **Git's own suite as the model. Source.** `test-lib.sh`: `LC_ALL=C`, both `NOSYSTEM`s, `TEST_CREATE_REPO_NO_TEMPLATE` passing `--template=` (1624). Brew's template dir holds 14 sample hooks (measured count), copied on each plain `git init` (inference; the copy code not read). Not timed
- **`clonefile` snapshots: no number found** in the trackers read

## 7. What the brief did not ask

- **A filter ran in the `LANG` window. Measured, thin.** `filter_buffer_or_fd` 243 lines there, 0 at 01:43. `~/.gitconfig` sets `filter.lfs.*` with `required=true`, `.git/config` sets `filter.git-crypt.*`. A fixture with a real `HOME` and matching attributes spawns a filter per `git add` (inference)
- **The target is smaller than the start. Inference from `cases.md`.** 10,000 git starts × 1.8 ms saved is 18 cpu-s of 295, about 6 %; about 170 of the 295 is `x` as a child. Build tricks finish the git-start line; they will not free the mac alone

## The 5 cheapest things to try

1. **Move fixtures off brew git for a day.** One env change, no build. Expect 5.2 → 4.2 ms per start, about 3 % of the suite. Killed if the cpu does not move, or 2.54 breaks a test. `PATH=/Library/Developer/CommandLineTools/usr/bin:$PATH /usr/bin/time -l go test ./x/go/...`, abba against bare
2. **Count what each fixture op spawns.** The largest lever, size unknown: the push and fetch share, the filter lead. `GIT_TRACE2_EVENT=$PWD/t2.json go test ./x/go/... ; rg -c '"event":"child_start"' t2.json`, then group by `child_class`. At `cases.md`'s rows each push replaced by a plain ref write saves about 50 ms (inference)
3. **A stripped fixture git.** Expect 5.2 → about 3.4 ms, about 6 % of the suite, far fewer dyld samples. Killed if it stays above 4.5. In a scratch checkout, with the `-framework CoreServices` line removed from `config.mak.uname`: `make NO_GETTEXT=1 NO_TCLTK=1 NO_PERL=1 NO_PYTHON=1 FSMONITOR_DAEMON_BACKEND= prefix=$PWD/out install`, then 200 `out/bin/git --version`. Untested recipe
4. **Fixture git env and empty templates.** Expect up to 0.4 ms per start and 14 fewer files per `git init`, 1 to 2 % (inference). `time (for i in {1..200}; do git init -q --template= "$TMPDIR/t$i"; done)` against the same without `--template=`; set `GIT_CONFIG_NOSYSTEM=1 GIT_ATTR_NOSYSTEM=1` beside it
5. **Read whose sandbox, once.** No gain if it reads 0, and the question closes; 18 to 19 % of kernel samples are at stake if a removable profile shows. `python3 -I -c "import ctypes,os;c=ctypes.CDLL(None);print(c.sandbox_check(os.getppid(),None,0))"` from a Bash tool shell, then a rex tab. Private API, its reading of 0 from memory «?»

Tried and killed, do not repeat: `LC_ALL=C` over `LANG`, `GIT_TEXT_DOMAIN_DIR`, `DYLD_PRINT_STATISTICS`.

## Looked for and did not find

- A report of slow starts from an unset locale on macOS, or the 1.7×. GitHub issue search, 2026-11-07: «CFPreferencesCopyAppValue libintl slow», «gettext setlocale macOS cfprefsd slow startup», «LANG unset macOS process startup slow cfprefsd», `repo:Homebrew/homebrew-core git LANG slow`: no relevant hit. [lore.kernel.org](https://lore.kernel.org/git/) search gave 403: the git list is unread «?»
- A git issue on CoreServices at start: `repo:git/git macOS CoreServices startup`, one unrelated pr. A git built without it, with numbers: none
- A Go issue on darwin spawn sys cost, or a `posix_spawn` proposal: `repo:golang/go` searches, only #56784 of use
- Nix on macOS: search hits on sandbox permissions, titles only, none with a process-cost number
- Linux on the same hardware, version-by-version floors: left to the web lanes
- Sandbox platform profile's cost and reach: nothing primary; Sandbox.kext is closed
- ccache, Buck2, Chromium, Stack Overflow, Hacker News, Reddit: not read in this lane

<!-- end -->
