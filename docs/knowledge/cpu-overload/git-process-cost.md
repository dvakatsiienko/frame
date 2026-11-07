---
fed-by: incidents
---

# git process cost on macOS — why a git start costs what it does, and what can cut it

Ticket: FRM-525

Asked 2026-11-07: exa, parallel, an opus source lane. Raw lanes, read for depth: [git-process-cost/](git-process-cost/). Probed by hand after the lanes: the image counts, the sandbox read with its control, the gnulib report, fastexec.

## the verdict

**No single trick frees the mac.** The `LANG` chain is now read frame by frame, and about 5 of the 300 cpu-s more sit in each of two cheap levers. The largest cost left is what the fixtures make git do and `x` running as a real child, about 170 cpu-s.

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
