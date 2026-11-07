---
fed-by: incidents
---

# git process cost on macOS — why a git start costs what it does, and what can cut it

Ticket: FRM-525

Asked 2026-11-07: exa, parallel, an opus source lane. Raw lanes, read for depth: [git-process-cost/](git-process-cost/). Probed by hand after the lanes: the image counts, the sandbox read with its control, the gnulib report, fastexec.

## the verdict

**No single trick frees the mac.** The `LANG` chain is now read frame by frame, and each of two cheap levers left holds about 5 % of the suite. The largest cost left is what the fixtures make git do and `x` running as a real child, about 170 cpu-s.

## what is proven

- **The `LANG` chain.** `init_git` → `libintl_setlocale` → `_CFPreferencesCopyAppValue` → XPC to `cfprefsd`, and `_CFCopyHomeDirURLForUser` → `getpwuid` → `opendirectoryd`. With no locale variable, every homebrew git pays it once per process. Apple's git does not link libintl. A [gnulib report, 2026-11-04](https://lists.endsoftwarepatents.org/archive/html/bug-gnulib/2026-11/msg00035.html) on macOS 27.2 found the same path from another program: 5,004 `CFLocaleCopyPreferredLanguages` calls in 5,000 restores. No lane found anyone reporting our 1.7×
- **Every git start loads about 700 dylibs.** `DYLD_PRINT_LIBRARIES`: brew git 706, Apple's 704, `rg` 85. Git's Darwin build links `-framework CoreServices` unconditionally ([`config.mak.uname` line 198](https://github.com/git/git/blob/master/config.mak.uname)), for the fsmonitor daemon only. Brew's libintl links CoreFoundation too, so both must go. dyld is about 42 % of git's samples in the `LANG` trace, which include waits
- **Our shell runs no sandbox profile.** `sandbox_check` reads 0 for this Bash tool shell and its parent, for Rex and for Finder; it reads 1 for `cfprefsd`, WebKit, Chrome's helpers and the desktop app's helpers, so the read tells them apart. So the 19 % `Sandbox` in kernel samples is the kext's hook on every open, not a profile anyone could lift by a setting (inference on the last step: Sandbox.kext is closed). A `--bg` lane's shell was not read
- **Go on darwin spawns by libc `fork`, then `exec`**, running libSystem's atfork handlers in the child. [fastexec](https://pkg.go.dev/github.com/zchee/fastexec), a third party's `posix_spawn` door with no cgo, claims 1.8× sequential and 3.3× parallel on an M3 Max; its README's numbers, not reproduced here

## what it would pay, per start, this mac, one window

- brew git 5.2 cpu ms, Apple's 4.2, `rg` 3.4, `true` 2.0, the `/usr/bin/git` shim 9.1: never call the shim
- a git with no gettext and no CoreServices: about 3.4 ms, inference from `rg`, about 6 % of the suite
- 10,000 git starts × 1.8 ms saved is 18 of about 300 cpu-s
- swapping Go's spawn: at most about 14 cpu-s of parent sys, about 5 % with the child's atfork work (inference)

## measured after the lanes, 2026-11-07, load 40 to 70, other lanes live

- **A slim git cuts the whole go suite 18 %, with no code change.** Git 2.56.0 built with no gettext, no Rust, no perl, no python, CoreServices and fsmonitor removed: 85 dylibs against 706. `go -C x/go test -count=1 .`, abba, slim first on `PATH`: brew 395.6 and 393.0, slim 319.6 and 324.1 cpu-s. Sys 240 → 213, user 154 → 109. Three times the 6 % estimate above. Recipe: `git-process-cost/slim-build.sh`, http helper kept (`NO_CURL` broke `TestPushRetriesOnlyAServerError`, fixed and rerun green)
- Per start, 200 runs, abba: `--version` brew 5.30 and 4.60 cpu ms, slim 3.80 and 3.05; `rev-parse` brew 4.95 and 5.20, slim 2.80 and 3.30
- **`posix_spawn` beats Go's `fork` by 23 % per spawn**, not the 5 % capped above. 1,000 spawns of brew git, abba, os/exec against fastexec: 1 worker 6.0 → 4.7 ms total, 8 workers 5.65 → 4.37; parent 0.95 → 0.35, child 4.9 → 4.2; wall at 8 workers 1.5 → 0.85 ms. A short-lived parent; not yet a suite number. `git-process-cost/spawn-bench/`
- `GIT_TRACE2_EVENT` over the suite saw 181 git starts of thousands: fixtures strip the env, so it is no count
- A batch read of all 55 test files, $8.80, claims 1,119 spawns no assertion needs, unchecked, about 20 cpu-s at 19 ms each: `lane_landed_test.go` 315, `merge_auto_test.go` 338. `~/.local/state/x/lanes/frm-525/spawn-audit.jsonl`
- No caller of `/usr/bin/git` in our scripts, jobs or x; all 4,394 git records in the `LANG` trace are brew's. No guard needed
- `sandbox_check` reads 0 for all 6 `--bg` lane sessions and their children too

## dead ends

- `LC_ALL=C` over `LANG`: no steady gain, and it turns off UTF-8 in git's regex. Keep `LANG`
- `GIT_TEXT_DOMAIN_DIR`, `DYLD_PRINT_STATISTICS` (prints nothing on 27.2)
- `GIT_CONFIG_NOSYSTEM` and a null global config: 0.4 ms, near noise
- `feature.manyFiles`, `index.version`, `core.untrackedCache`: index work, not start; fixtures are tiny
- gix cannot replace a commit with hooks or clean and smudge filters today; jj moved toward spawning git, not away; so hook and git-crypt fixtures stay on real git

## the lanes split

- exa ranks `posix_spawn` above config work, from fastexec's numbers; the source lane caps it near 5 %, from our own rows. Ours win until measured
- exa and parallel suspect a sandbox inherited from Claude; the `sandbox_check` read above says no for this shell
- parallel names [codex#19885](https://github.com/openai/codex/issues/19885) and [codex#29084](https://github.com/openai/codex/issues/29084), `syspolicyd` storms at very high launch rates, not opened here. `syspolicyd` here read 1.49 and 2.73 cpu-s per 10 s, a small share

## not found

Anyone else's 1.7×, a controlled macOS 26 or 27 regression, a same-hardware Linux number, a per-process floor by macOS version, a git built without CoreServices with numbers. Unread: the git mailing list (403), Reddit, Hacker News, Stack Overflow for this exact shape.
