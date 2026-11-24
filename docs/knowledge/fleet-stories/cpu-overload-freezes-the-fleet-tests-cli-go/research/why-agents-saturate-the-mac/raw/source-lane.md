# source lane: why many parallel agents saturate this mac, and who solved it

All sources opened on 2026-11-07 unless a note says otherwise. A date after a link is that source's own date. Nothing was run on this machine: every command below is a proposal, and none has been tried here.

## headline

- **No source proves the cause of the sys time on this mac.** The closest match is three separate problems stacked together, and each one has its own test.
- **Closest match, not checked here: Claude Code itself.** [claude-code#107009](https://github.com/anthropics/claude-code/issues/107009) (2026-11-03, open) describes a 14-core Mac on Darwin 27, where desktop-started `claude` processes use about one core each while idle, mostly as system time. 9 sessions gave load 60 to 70. A later comment reports load 67 "with nothing working" on 2.1.317 (2026-11-04).
- **Gatekeeper and XProtect are real and well measured, but they mostly cost wall time and daemon cpu, not kernel time.** One held first exec read real 21.65 s, user 0.00, sys 0.00 ([logmon-mcp#14](https://github.com/yuvalrakavy/logmon-mcp/issues/14), 2026-08-01). Inference: this is a poor fit for 59 % sys.
- **The known Developer Tools fix may not reach agent commands.** [claude-code#104173](https://github.com/anthropics/claude-code/issues/104173) (2026-10-21 measurement) counted 40 of 40 fresh binaries scanned through the Bash tool, against 1 of 40 from a plain shell in the same host app.
- **No one found runs 64 local sessions with local tests on a Mac.** Every high count I could open runs on servers or big Linux machines.
- **No one has measured a spawn-heavy suite on macOS against a Linux VM on the same Mac.** A VM move is therefore unproven.

## evidence against the suspicion that spawning is the cause

- **Arithmetic on the brief's own numbers (inference).**
  - 5,940 git lookups × 8.8 ms (100 `git --version` in 0.88 s) is about 52 s, or 17 % of the suite's 307 cpu-s. This matches the brief's estimate ([brief.md:15,25-27](brief.md), 2026-11-06/07).
  - The suite's 64,285 opens and stats would need about 3 ms each to fill the 190 s of sys. I found no source with a per-call cost near that.
  - So at least about 138 s of sys has no named cause, even if all 52 s were sys.
- **Load stays at 21 with nothing heavy queued** ([brief.md:24](brief.md), 2026-11-06/07). The gates are serialized, so gates do not explain this floor.
- **Exec was fast on a sick Mac.** An M4 Mac Studio (16 cores, 64 GB) at load 22, with about 12 `claude` CLIs, had process launch at 2 ms and `git status` at 14 to 34 ms. Git spawning ran about 1 per second. The author blames `fseventsd`, which was at a 36 GB footprint and about 100 % cpu ([daintree#12455](https://github.com/daintreehq/daintree/issues/12455), 2026-09-18).
- **Idle spin ignores load.** 2.1.309 spun at about 95 to 105 % of a core both at load 20 and at load 100+, and builds through 2.1.284 idled clean on the same Mac ([#107009 comment](https://github.com/anthropics/claude-code/issues/107009), 2026-11-04).
- **Evidence for spawning, to be fair:** load rises to 51 with sys 52 % only while a go test or gate runs ([brief.md:24](brief.md), 2026-11-06/07). A sustained 4,000 git/s drove `syspolicyd` to about 180 % and `trustd` to about 100 %, and a config change that stopped the spawning dropped `syspolicyd` to about 5 % ([codex#29084](https://github.com/openai/codex/issues/29084), 2026-06-19).
- **Evidence against the spin as the main cause here:**
  - The top `claude` was at 36 %, and `ps` summed to only about 6 of 14 cores ([brief.md:22-23](brief.md), 2026-11-06/07). 14 sessions at 72 to 105 % would show as more.
  - Possible explanations: `%CPU` understates it, or the spin flips on and off. One build read 0.9 %, then 82 to 92 % about 13 hours later ([#107009](https://github.com/anthropics/claude-code/issues/107009), 2026-11-04). Measure with a cpu-time delta, not `%CPU`.

## vector 1: kernel time on macOS

| mechanism | best evidence | status |
|---|---|---|
| XProtect on first launch | Apple: scans when an app is first launched, changed, or signatures update ([Apple](https://support.apple.com/guide/security/protecting-against-malware-sec469d47bd8/web), 2024-12-19). `fn main(){}` on an M2: about 120 to 180 ms first launch enabled, about 3 to 9 ms disabled ([cargo#15908](https://github.com/rust-lang/cargo/pull/15908), 2025-09-02) | measured |
| Scan growth by OS | XProtect scan 0.030 s on Ventura, 0.126 s on Sequoia; total about 0.195 s to just over 0.3 s, on different Macs ([Oakley](https://eclecticlight.co/2025/05/04/last-week-on-my-mac-checking-code-can-take-longer-now/), 2025-05-04). Rowe says the launch delay is `syspolicyd` scanning, triggered by a kernel upcall from a MACF hook ([Tsai](https://mjtsai.com/blog/2025/04/30/why-some-apps-sometimes-launch-extremely-slowly/), 2025-05-01 comment). Oakley and his commenters disagree on which step dominates | measured; the attribution is disputed |
| Queue collapse under burst | Bun copy first exec 0.95 to 1.23 s, second 0.01 to 0.03 s. A new two-line `#!/bin/sh` script stalled up to 35.7 s under load, "strong inference; I have not proven it" ([llxprt#3891](https://github.com/vybestack/llxprt-code/issues/3891), 2026-10-18). A single 84 MB binary took 15 to 21 min to be admitted ([chelis#356](https://github.com/Chelis-Lang/chelis/issues/356), 2026-06-11) | measured |
| Endpoint Security on every open | DTrace stack `mac_vnode_check_open` → `es_vnode_check_open`, one 1 KB allocation per open. The commenter says always-on Apple clients subscribe to vnode events ([#66020](https://github.com/anthropics/claude-code/issues/66020), 2026-06-15). The hook is real; its cpu cost per open was **not measured** | mechanism only |
| `fseventsd` | 24 GB against a 30 MB budget, one core pinned for about 2 days, 93 % of samples in `_platform_strncmp` on an M3 Pro, macOS 27.0 ([#98769](https://github.com/anthropics/claude-code/issues/98769), 2026-10-01). 100 to 200 % cpu during Bazel builds ([bazel#7527](https://github.com/bazelbuild/bazel/issues/7527), 2019-02-25) | measured, as daemon cpu |
| Memory compressor and swap | 13 sessions on an 8-core M1 with 16 GB: load 26 to 54, **26 % user, 58 % sys**, swap 8.8 of 10 GB. The reporter attributes it to compression and swap; the attribution was not separately tested ([#88524](https://github.com/anthropics/claude-code/issues/88524), 2026-08-21) | same ratio as here, on a much smaller Mac |
| Thread yield and syscall spin | `swtch_pri`, `__ulock_wait2`, STIME 10:00 vs UTIME 1:35 per thread ([#107009](https://github.com/anthropics/claude-code/issues/107009), 2026-11-03). OTEL socket: about 850,000 syscalls/s, 78 min system vs 18 min user, Bun 1.4.3 ([#102531](https://github.com/anthropics/claude-code/issues/102531), 2026-10-15) | measured, as sys time |
| XNU global locks | Name cache uses one global rw lock ([vfs_cache.c:154](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/vfs/vfs_cache.c#L154)). Fork takes `proc_list_lock` ([kern_fork.c:247](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/kern/kern_fork.c#L247)). Exec calls `mac_vnode_check_exec` ([kern_exec.c:6772](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/kern/kern_exec.c#L6772)). Read at sha f6217f8; newest tag xnu-12377.121.6; match to macOS 27.2 «?» | **unmeasured**; no contention figure found |
| Go uses `fork`, not `posix_spawn`, on darwin | [exec_libc2.go:86](https://github.com/golang/go/blob/89b15e2635bf7be8b2c5579a0d324524c802c320/src/syscall/exec_libc2.go#L86) at sha 89b15e2. Cost by parent size on macOS | **unmeasured** |
| `opendirectoryd`, `cfprefsd`, `notifyd`, `getpwuid` per spawn | Searched GitHub, Apple and the web. No measurement found; the brief's `top` figures are the only numbers ([brief.md:23](brief.md), 2026-11-06/07) | no one has measured this |
| Spotlight | "Based on no evidence" suspicion from a Go maintainer ([go#76314](https://github.com/golang/go/issues/76314), 2025-11-17). A Spotlight mask was "not enough" ([bazel#7527](https://github.com/bazelbuild/bazel/issues/7527), 2019-02-25) | unmeasured |

Published macOS against Linux numbers are weak and mostly old:

- Empty binary 100 runs 0.21 to 0.24 s against 0.01 to 0.02 s, and 100 `git status` 5.21 to 5.38 s against 0.53 to 0.64 s. This is an Intel Mac against a Ryzen, so different hardware; the author says "I still don't know why" ([Ball](https://thorstenball.com/benchmarking-process-startup-time), 2021-04-22).
- Firefox child launch median about 60 ms on macOS against about 12 ms on Linux, but much of that is app and sandbox setup ([bug 1690855](https://bugzilla.mozilla.org/show_bug.cgi?id=1690855), telemetry to 2021-02-03).
- **No fork, exec or stat benchmark of macOS against Linux on the same Apple silicon machine was found.** The Asahi comparison I opened covers gzip only, with results in images ([TechHara](https://blog-data-d05.pages.dev/posts/2024-11-25_benchmark---macos-vs-asahi-vs-virtualized-linux-0c7b309865d2), 2024-11-25).

## vector 2: known fixes on macOS

- **Developer Tools pane, gain.**
  - rustc `tests/ui`, almost 4,000 executables: 9m42s to 3m33s with XProtect off, measured by Marquart ([Nethercote](https://nnethercote.github.io/2025/09/04/faster-rust-builds-on-mac.html), 2025-09-04).
  - Exempting VS Code on macOS 26.2: a suite that could not complete ran its test phase in 1.05 s, and `syspolicyd` fell from 86 % to about 8 % ([chelis#356](https://github.com/Chelis-Lang/chelis/issues/356), 2026-06-11).
- **Developer Tools pane, sources disagree.**
  - Fails through Claude Code: Bash tool children are scanned 40 of 40; 117 ms median, Rust p90 6.1 s; macOS 27.0.1 ([#104173](https://github.com/anthropics/claude-code/issues/104173), 2026-10-21). The likely mechanism, responsibility disclaim, is marked "not confirmed" there.
  - "Does not affect YARA scanning of child processes" ([#60799](https://github.com/anthropics/claude-code/issues/60799), 2026-05-20, closed as inactive).
  - Exemption is per responsible app; SSH, cron and launchd work is not covered ([chelis#356](https://github.com/Chelis-Lang/chelis/issues/356), 2026-06-11).
  - "Still some reports" of slowness after enabling it ([nextest docs](https://nexte.st/docs/installation/macos/), undated).
- **Developer Tools pane, price.** Children skip the first-launch scan; the residual risk is downloaded prebuilt binaries run from those shells (chelis, same date). Nethercote also reports it may take a reboot to undo.
- **Hard link instead of copy.** Hard link to a warmed copy: first exec 0.02 to 0.04 s against 0.95 to 1.23 s. It does not help if tests still write new launcher scripts ([llxprt#3891](https://github.com/vybestack/llxprt-code/issues/3891), 2026-10-18). A `cp` pays the scan again, so the key is per file, not content (20.84 s, [logmon-mcp#14](https://github.com/yuvalrakavy/logmon-mcp/issues/14), 2026-08-01).
- **Prewarm in parallel.** Six fresh binaries: 125 s serial, 27 s concurrent; no security change ([logmon-mcp#14](https://github.com/yuvalrakavy/logmon-mcp/issues/14), 2026-08-01). This disagrees with "`XprotectService` runs in a single thread" ([cargo#15908](https://github.com/rust-lang/cargo/pull/15908), 2025-09-02). Both are reported; the cause of the difference is «?».
- **`fseventsd` restart.**
  - `sudo kill -TERM` took it from 24 GB to 7.4 MB, and swap from 13.5 GB to 1.5 GB ([#98769](https://github.com/anthropics/claude-code/issues/98769), 2026-10-01).
  - It came back after 28 days, and moving temp files to another volume did not help. "I cannot prevent it" ([write-up](https://github.com/talkstream/fseventsd-runaway), 2026-10-31).
  - `launchctl kickstart` is blocked by SIP. The restart erases the event history.
- **Hide the desktop window.** WindowServer 34.5 % to 6.3 % on macOS 27.2, M4 ([#107076](https://github.com/anthropics/claude-code/issues/107076), 2026-11-03). 43 to 45 % to 3 to 10 % on an M4 Pro with 48 GB, on macOS 26.7.2 (2026-11-06 comment). Free, about a third of a core.
- **1Password.** `op read` takes about 1.27 s at 6 % cpu, so waiting rather than computing ([community](https://www.1password.community/developers-69/why-is-the-cli-so-slow-any-tips-1391), 2025-05-26). Nothing I opened explains the app itself at 61 % ([brief.md:23](brief.md), 2026-11-06/07). «?»
- **Disabling SIP** removes the scan but is a security non-starter ([Tsai](https://mjtsai.com/blog/2025/04/30/why-some-apps-sometimes-launch-extremely-slowly/), 2025-05; [#60799](https://github.com/anthropics/claude-code/issues/60799), 2026-05-20). `renice` and `killall` on `syspolicyd` did not fix slowness ([vvitovec](https://dev.to/vvitovec/your-mac-is-protecting-you-but-is-it-worth-it-1g34), about 2026-07 «?»).
- **Not measured anywhere I could open:** `.metadata_never_index`, Time Machine exclusions, `sysctl` limits. The one direct Spotlight claim, an X post by Jason Buchanan, returned 402 and then an empty fetch, so it is dropped.

## vector 3: who hit this

- **Same machine class.** 14-core Darwin 27: 9 sessions, load 60 to 70, spin since about 2.1.285 and 2.1.286 (Sep 29 and 30), still in 2.1.317. Not fixed. The workaround is a launchd job that sends SIGTERM after 10 idle minutes; sessions resume intact, but the app rewarms them ([#107009](https://github.com/anthropics/claude-code/issues/107009), 2026-11-04).
- **Same pattern on Windows, fixed there.** Idle desktop sessions at 0.7 cores, 353 ms/s on 2.1.299 and 0 ms/s on 2.1.304 ([#103340](https://github.com/anthropics/claude-code/issues/103340), 2026-10-21). Whether it is the same bug is «?».
- **Build fan-out.** 11 cores with 18 GB: 11 agents plus a 5-agent workflow, load about 726. Seven agents on one cargo lock turned a 17-minute gate into over two hours. A 2-slot semaphore "keeps the Mac usable" ([#101193](https://github.com/anthropics/claude-code/issues/101193), 2026-10-11 and 2026-10-26).
- **Orchestrator tools.** Boss, a Bazel-based agent system, added a `syspolicyd` wedge detector: at 100 % cpu it stalls `F_ADDFILESIGS`, which hangs every Bazel server on the machine ([spinyfin/mono#1011](https://github.com/spinyfin/mono/pull/1011), 2026-05-30). No cause fix.
- **Statusline fan-out, including on Linux.** Four `ccstatusline` processes at about 470 % cpu, load 30+ on Ubuntu; cause not fully confirmed by the reporter ([ccstatusline#397](https://github.com/sirmalloc/ccstatusline/issues/397), 2026-05-23). On macOS, `ps` is spawned twice per ancestor on each repaint; a fix gave −24 % cpu (2026-10-13 comment).
- **Go tracker.** No issue measures `syspolicyd` cost on tests. Nearest: `DiskCache.Trim` blocking over 20 min, no proven cause ([go#76314](https://github.com/golang/go/issues/76314), 2025-11-15, closed 2026-03-09); hangs cleared by killing `syspolicyd` ([go#37885](https://github.com/golang/go/issues/37885), 2020); virtualized Linux "a lot faster on the same hardware" for I/O ([go#28739](https://github.com/golang/go/issues/28739), 2021-10-14), with marcan's note of about 46 F_FULLSYNC IOPS on M1 (2022-02-17).
- **A red herring to rule out.** The kernel zone leak was traced to npm-installed `claude` running from a deleted inode; the native installer does not reproduce it ([#66020](https://github.com/anthropics/claude-code/issues/66020), 2026-07-16 and 07-17). It leads to panics, not sys time, and no such panic is in the brief.

## vector 4: the 64 threads claim

- **Reported fact, not a Mac.** Cursor peaks at "several hundred agents"; the early harness ran on "a single large Linux VM", later each run on "its own large machine". "The disk became the hotspot", with many GB/s of build artifacts ([Cursor](https://cursor.com/blog/self-driving-codebases), 2026-02-05). No core count published.
- **Reported, hardware unknown.** Julian Knutsen's "Atlanta-based server" runs about 100 agents and merges about 50 PRs a day ([Every](https://every.to/context-window/inside-the-100-agent-software-factory), 2026-05-19).
- **Isolated and remote.**
  - 16 agents, each in Docker, with a `--fast` 1 % or 10 % test sample per agent; host hardware not given ([Anthropic](https://www.anthropic.com/engineering/building-c-compiler), 2026-02-05).
  - Stripe minions run on remote devboxes, at most two CI rounds, local lint under 5 s; no parallel count given ([Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents), 2026-02-09).
- **Design claim.** Gas Town coordinates 20 to 30 agents in tmux ([Every](https://every.to/context-window/inside-the-100-agent-software-factory), 2026-05-19). [Yegge's post](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04) was opened through the fallback and keyword-filtered only; no hardware spec appeared. Full read «?».
- **A count may not mean what it sounds like (inference).** The workflow limit is 16 by default and settable from 1 to 256 ([#99267](https://github.com/anthropics/claude-code/issues/99267), 2026-10-03), so 64 could be subagents that only read and search. No first-hand report ties a 64 count to a machine.
- **Macs at 9 to 15 sessions hurt.** 9 on 14 cores (#107009), about 12 on 16 cores with 64 GB (daintree), 15 on an 18 GB M3 Pro with swap full ([#101193](https://github.com/anthropics/claude-code/issues/101193), 2026-11-03). Most of these names a bug or a memory limit rather than a limit on sessions.
- **Searched with no find:** `anthropics/claude-code` for 30, 40, 50, 64 or 100 sessions and agents; Threadripper; the web for first-hand 30 to 64 session setups. Verdict on 64 local threads with local tests: **unverified «?»**.

## vector 5: Linux against macOS

- **Same suite, macOS against a Linux VM on the same Mac: no measurement found.** Searched the web, plus lima-vm, orbstack and apple/container trackers.
- **VM overhead, one independent-looking test.** M3 with 36 GB, macOS 26.4. Kernel compile with 4 vCPUs: OrbStack 2m18s, Lima 2m22s, UTM 2m25s, no macOS baseline. Guest disk read 4,920 and 4,180 MB/s against 5,810 on the host. Shared folder 2,140 and 1,420 MB/s ([Sun](https://dev.to/michael_sun_18a5c4c96768d/utm-vs-orbstack-vs-lima-macos-vm-real-cold-start-disk-io-and-memory-numbers-on-m3-macbook-pro-4j6d), May 3, year «?»). Inference: keep worktrees on the guest disk.
- **Bind mounts.** VirtioFS about 3x slower than native, down from 5 to 6x two years before ([Mainardi](https://engineered.at/articles/docker-on-macos-is-still-slow), 2025-01-04; I could read only the page summary).
- **Old same-hardware hint.** Same Mac, a Go tool: native `real 1.28 s` against Docker `real 0.30 s` ([go#28739](https://github.com/golang/go/issues/28739), 2018-11-13, Intel, macOS 10.12). Go's team called the comparison "apples and oranges" (2021-10-14).
- **Linux does not cure agent-side load.** Load 30+ on Ubuntu with 2 sessions (ccstatusline, 2026-05-23). Idle 105 to 130 % under WSL2 ([#19393](https://github.com/anthropics/claude-code/issues/19393), 2026-01-20). OOM on Linux ([#74001](https://github.com/anthropics/claude-code/issues/74001), 2026-07-03; title read only).
- **First-hand use.** Hashimoto runs a NixOS VM on a Mac for all dev work, on Apple silicon since Nov 2021 ([nixos-config](https://github.com/mitchellh/nixos-config), read 2026-11-07). The README gives no build timings in what I read.
- **What is lost, needs of the fleet:** not sourced by this lane beyond the above. «?»

## vector 6: the mac mini claim

- **It is about local inference and always-on infrastructure, not spawn cpu.** Buyers want to avoid "renting compute" and treat units as "infrastructure". The article gives no cpu or offload measurement. Cook on the Apr 30 2026 call: demand "faster than what we had predicted" ([Decrypt](https://decrypt.co/366389/openclaw-apple-mac-mini-shortage-ai-2026), 2026-05-02).
- **Second machine as build or test offload: no measured result found.**
- **Inference.** A second Mac has the same XProtect and first-exec path, and SSH-launched work is not covered by the exemption per [chelis#356](https://github.com/Chelis-Lang/chelis/issues/356) (2026-06-11). A mini would move the load, not remove the mechanism.
- **Prices, read 2026-11-07.**
  - Hetzner, excl. VAT: AX41 6 cores 64 GB €59, AX42 8 cores 64 GB €79, AX102 16 cores 128 GB €159, AX162 48 cores 128 GB €319, per month ([Hetzner](https://www.hetzner.com/dedicated-rootserver/matrix-ax/), undated; rows matched by order).
  - Apple sells M6 (12 cores) and M5 Pro (15 to 18 cores, up to 64 GB) ([specs](https://www.apple.com/mac-mini/specs/)). Apple's pages contain $399, $899, $1,199 and $1,999, but the match to configs is «?».

## vector 7: offload designs for one operator

- **CI owns the whole suite, exemption for the inner loop.** The chelis outcome: "volume-reduction discipline stays primary" ([chelis#356](https://github.com/Chelis-Lang/chelis/issues/356), 2026-06-11).
- **Sample tests per agent.** `--fast` at 1 % or 10 %, deterministic per agent, random across VMs ([Anthropic](https://www.anthropic.com/engineering/building-c-compiler), 2026-02-05). Stripe's cap of two CI rounds is the same idea ([Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents), 2026-02-09).
- **Machine-wide queue.** Already built here. Others built the same: a 2-slot semaphore ([#101193](https://github.com/anthropics/claude-code/issues/101193), 2026-10-26) and [agent-slots](https://github.com/staterijndael/agent-slots) (created 2026-11-03, 0 stars, author's claims only). Evidence it reduces load exists only qualitatively, and this machine still saturates with one in place ([brief.md:16](brief.md), 2026-11-06/07).
- **`GOCACHEPROG`** exists (`go doc cmd/go`, local toolchain, read 2026-11-07). No experience report found.
- **Remote Bazel.** Vendor claims only, no numbers, read through a third-party summary ([Plushcap on BuildBuddy](https://www.plushcap.com/content/buildbuddy/blog/buildbuddy-remote-bazel-the-missing-piece-for-ai-coding-agents), 2026-03-02).
- **"What broke":** one concrete failure. Measuring inside the test harness hid the first-exec cost, because the clock starts after the hold ([logmon-mcp#14](https://github.com/yuvalrakavy/logmon-mcp/issues/14), 2026-08-01). No failure report of a remote gate for agents found.

## ranked candidate fixes for this setup

Expected gains are inference from the sources above, not measured here.

| # | fix | expected gain | prove it | cost and risk |
|---|---|---|---|---|
| 1 | Stop idle desktop `claude` processes (quit sessions, or a launchd SIGTERM after 10 min) | If spinning: 0.7 to 1 core per idle session, and a load floor well below 21. If not: nothing | Test S1, then SIGTERM one idle session and watch the load | Low. Resume is reported intact. Must not hit a working session. Processes rewarm |
| 2 | Report here with `ps -M` and `sample` output on #107009 if S1 is positive | Upstream fix; the Windows twin got one | S1 output | Minutes |
| 3 | Hide the desktop window | About 0.3 core and less GPU | `top` WindowServer, Cmd+H, 2 min | None |
| 4 | Check `fseventsd`; restart if far over budget | Up to 1 core plus swap relief | S3 | `sudo`; loses event history; can return |
| 5 | Run the queue's gates from a process whose chain does not pass through `claude`, under a host granted Developer Tools. Untested design (inference) | Removes scans on fresh binaries, about 0.1 to 0.2 s each here ([brief.md:25](brief.md), 2026-11-06/07) and queue stalls. Little sys relief expected | The 40-binary script in #104173, in both chains | Security: skips first-launch scan. launchd runner is reported uncovered |
| 6 | One warmed cli binary, hard-linked into tests; avoid writing new executables per test | Fewer scans; llxprt shows 0.03 s against about 1 s for a large binary | `rg -c 'not exempt'` on `log show` before and after a run | Small harness change. Check for new hook scripts too |
| 7 | Audit per-repaint and per-tool spawns: statusline, hooks, `op`, OTEL | Unknown; ccstatusline fix −24 % of its own cpu | Test S5 | Low |
| 8 | Linux box or VM for gates only | Unknown, unmeasured | Same suite: `/usr/bin/time -l` in a VM with worktree on the guest disk, when the machine is quiet | Most effort; does not touch spin, WindowServer, `fseventsd` |
| 9 | Mac mini | No evidence for this problem | none needed yet | Cost; same OS mechanisms |

Not recommended: disabling SIP. `renice` on `syspolicyd` was reported not to help.

## what would prove or disprove each cause

No `sudo` unless marked. Keep them light; the 40-binary script and decisive test should wait for a quieter moment.

| id | suspect | command | proves if | disproves if |
|---|---|---|---|---|
| S0 | Decisive: is the suite's sys its own, or contention? | Same `/usr/bin/time -l go test …` with all sessions running, then with every `claude` and the desktop app stopped (at halt) | sys falls far below 190 s when quiet: contention from elsewhere | sys stays near 190 s: the suite's own fork, exec and file work |
| S1 | Idle spin | `ps -axo pid,etime,time,command \| rg '[c]laude'` twice, 10 s apart; then `ps -M -p <pid>` and `sample <pid> 5` on an idle one; `claude --version` | About 7 to 10 cpu-s per 10 s while idle, STIME far above UTIME, `swtch_pri` in the sample | Near 0 across several hours; the bug flips, so one clean read proves nothing |
| S2 | Swap and compressor | `sysctl vm.swapusage; vm_stat` | Swap near full, compressor large | Swap near empty on 48 GB; rules out the #88524 reading |
| S3 | `fseventsd` state | `top -l 1 -stats pid,mem,cmprs,ports -pid $(pgrep -x fseventsd)`, `launchctl print system/com.apple.fseventsd \| grep 'jetsam memory limit (active'` | Footprint far over the 30 MB budget | Single-digit MB |
| S4 | XProtect on agent commands | `/usr/bin/log show --last 10m --info --debug --predicate 'process == "syspolicyd"' \| grep -c 'not exempt'`; script in #104173 for the A/B | Count tracks fresh binaries in the Bash tool chain, but not in the plain shell | Equal and low in both chains |
| S5 | Who makes the syscalls | `top -l 2 -s 5 -n 15 -o sysbsd -stats pid,command,cpu,sysbsd,sysmach,csw,faults` | One process far above others, like 850,000 syscalls/s in #102531 | Evenly spread |
| S6 | OTEL loop | `env \| rg OTEL_`; then S5 on the session | Exporter set and a process with huge `sysbsd` | Not set |
| S7 | Spawn rate | `ps -axo time,comm \| sort -r \| head -25` twice for daemon deltas (`syspolicyd`, `trustd`, `opendirectoryd`, `cfprefsd`, `mds`, `mdworker`) | Daemon cpu tracks the gate windows | Daemons flat while sys stays high |
| S8 | Third-party ES clients or EDR | `systemextensionsctl list` | An active endpoint-security extension (command from memory, «?») | None listed |
| S9 | 1Password | Quit it for 5 min under similar load; compare `top` totals | Load or sys drops clearly | No change |
| S10 | Thermal throttling | `pmset -g therm` while at 106 °C | A speed limit is reported | No limit. Whether it reports on Apple silicon is «?» |

Definitive kernel attribution needs root or reduced security: `sudo spindump`, `sudo fs_usage`, or `xctrace` System Trace. DTrace needed SIP off in #66020. None of these was tried here.

## thin or contradictory evidence

- **Whether Developer Tools covers agents:** chelis says yes (VS Code host, 2026-06-11); #104173 says no through Claude Code's Bash tool (2026-10-21); #60799 says no (2026-05-20). The chelis chain through `claude`, if any, is «?».
- **Whether the scan is cached:** #60799 claims a scan on every spawn of a signed un-notarized binary. llxprt, logmon and cargo all measure first run only. They disagree; the #60799 claim is sampled but not timed by run.
- **Which step costs most at launch:** Oakley against Johnson and Rowe (2025-05).
- **`fseventsd` trigger:** churn is a hypothesis in daintree and #98769, and both say so. 31 idle headless processes left it healthy (2026-10-02).
- **Parallel or single-threaded scanning:** see vector 2.
- **Report quality:** most GitHub reports here are one machine, and several are visibly agent-written. #107009 has an internal mismatch: about 12 threads at 3 to 4 % each does not sum to 90 % of a core. Its 10-second cpu windows and the second reporter's version table are the stronger data.

## could not open or verify

- X post by Jason Buchanan on Spotlight: 402, then empty. Dropped.
- Tom's Hardware on the Mac shortage: headline only. Not used.
- Boris Cherny's session counts, Cursor secondary pages, `op` runaway threads, Reddit threads: seen only as search snippets. Not used.
- Claude Code docs `llms.txt`: 404 at the URL tried. Docs claims come through issue text only.
- This machine's Claude Code version, install type, grants, swap and ES clients: not read, per the lane's read-only rule.

<!-- end -->
