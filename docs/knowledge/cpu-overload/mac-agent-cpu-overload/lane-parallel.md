# Research brief: parallel coding agents and this Mac’s CPU saturation

## Bottom line

Your measurements establish a real machine-wide saturation problem, but they do **not** establish one proven root cause. In particular, 59.4% system CPU means a large share of the measured CPU time is in the kernel; it does not tell us which kernel subsystem is responsible. The fact that your single Go test/gate run coincided with load around 51 and roughly 52% system CPU, despite a machine-wide queue, makes the test’s process, filesystem, security-check and watcher activity important suspects—not proof that any one of them caused the load. The approximately 5,940 Git lookups and tens of thousands of open/stat calls you reported make filesystem metadata and repeated subprocess work especially plausible candidates.

The best-supported conclusion is therefore: **the cause on this particular Mac remains unproven**. Published reports show several mechanisms that can produce similar symptoms—Gatekeeper/XProtect assessment of frequently launched binaries, high-churn FSEvents/Spotlight activity, and macOS filesystem metadata contention—but none identifies which mechanism accounts for your measured system time. Do not treat “use fewer threads,” “APFS is definitely the cause,” or “disable security” as a proven solution.

## 1. macOS kernel time, process starts and file metadata

1. A 2017 OS-primitives comparison reported Linux notably faster than macOS in its program-launch benchmark—about 10× in that test. It is old, not Apple-silicon-specific, and not a benchmark of your workload. (“Benchmarking OS primitives,” Bits’n’Bites, 2017-06-03.)
2. A Python tracker benchmark on Intel macOS Mojave reported `fork+exec` at 2.79 ms and `posix_spawn` at 1.64 ms, a 1.7× improvement in that particular test. A separate third-party Go package reports 35–42% faster `posix_spawn`-based launches than Go `os/exec` on an M2 Pro, but this is package-specific and not an independent comparison with Linux. (“Issue 35537,” Python tracker, 2018-12-20; `spawnexec` benchmark, date not given in the retrieved record.)
3. Gregory Szorc’s directory-walk benchmark on a Firefox tree reported substantial kernel time across 12 concurrent processes on macOS 10.13; macOS 10.14 improved it, but still used a great deal of system time. The author inferred lock contention from profiles and scaling; APFS’s closed source meant the specific “global APFS lock” explanation was not proven. (“Global Kernel Locks in APFS,” 2018-10-29.) A 2026 Apple Developer Forums report also discusses contention in a test suite that launches a process per test, but the excerpt available here does not establish the exact cause. (“Lock Contention in APFS/Kernel?,” Apple Developer Forums, date not shown in the retrieved record.)
4. There is direct, issue-tracker evidence that repeated execution of certain binaries can make `syspolicyd` a bottleneck: a Codex issue reports a bundled Node helper executed about 250 times per second, with `syspolicyd` saturating a core and shell commands stalling; another reports 150–200% `syspolicyd` CPU during repeated execution of an un-notarized CLI binary. These are reports about particular Codex versions and binaries, not proof about your Claude/Go test binaries. (“Codex app-server saturates macOS syspolicyd,” OpenAI Codex issue, 2026-04-27; “Notarize the macOS codex CLI binary,” OpenAI Codex issue, 2026-05-20.) Apple describes Gatekeeper’s checks for downloaded software and notarization; it does not say every local process launch necessarily incurs the same scan. (Apple Support, “Gatekeeper and runtime protection in macOS,” published 2024-12-19.)
5. `fseventsd` and indexing are credible suspects when large numbers of files change. A 2026 issue report describes a developer Mac with runaway `fseventsd` amid heavy agent activity, but explicitly does not establish that agents caused the condition. A separate RStudio issue describes dropped-event warnings and expensive rescans in a large, churn-heavy project. These show a plausible mechanism, not a diagnosis of your Mac. (“fseventsd runaway on agent-heavy Macs,” Claude Code issue, 2026-10-01; RStudio file-monitor issue, 2026-08-11.)
6. The retrieved evidence does **not** establish that `getpwuid`, `cfprefsd`, `notifyd`, the VFS name cache, APFS clone operations, or sandboxing is a major part of your CPU load. The `getpwuid` documentation warns that `getpwent` may cause a lengthy directory-services search; that is not a measurement of `getpwuid` per process launch. Apple documents the VFS name cache as a lookup cache, not a reason to attribute your observed CPU to it.

## 2. macOS remedies and their limits

1. **Check for Gatekeeper/XProtect assessment before changing security settings.** Compare first and repeated launches of the same newly built test executable, and inspect system logs and `syspolicyd` samples during the delay. When the issue is repeatedly launching an un-notarized distributed tool, signing/notarizing that tool or avoiding repeated process launches is the reported fix—not turning off SIP. The Codex issue itself calls disabling SIP a security non-starter. (OpenAI Codex issues, 2026-04-27 and 2026-05-20.)
2. **Developer Tools privacy permission is not a demonstrated CPU fix.** Apple’s current user guidance says the Developer Tools setting controls whether listed apps may run software that does not meet system security policy. The retrieved sources do not provide a controlled timing result showing that granting this permission speeds up ordinary test binary launches. `DevToolsSecurity -enable` addresses debugger/performance-tool authorization prompts; its manual describes authorization policy, not Gatekeeper bypass or spawn acceleration. (Apple Support, macOS Tahoe/Sequoia guide; `DevToolsSecurity(8)`, manual dated 2011.)
3. **Spotlight: use the supported Search Privacy UI for a narrow A/B.** Exclude only disposable build/dependency/worktree locations and check whether indexing daemons and system CPU fall. A third-party macOS specialist reports that `.metadata_never_index` no longer works reliably on recent macOS, while other reports recommend it; the evidence conflicts. Prefer the UI exclusion and verify the result rather than assuming the marker works. (Eclectic Light, “Using and troubleshooting Spotlight in Sequoia,” 2024-11-28; Apple Support, “About Spotlight indexing and search results,” published 2026-08-25.) No controlled gain for your setup was found.
4. **FSEvents/watchers: reduce redundant watches and file churn, then measure.** A watcher issue recommends excluding hot directories at the FSEvents stream when the software supports it; this is an application-level mitigation, not a global macOS switch. Do not disable `fseventsd` as a general fix. (RStudio issue, 2026-08-11; `fseventsd` report, 2026-10-01.)
5. **EDR/antivirus: ask an administrator to identify the product and use its performance diagnostics.** Microsoft documents that apps accessing many resources quickly can produce Defender performance issues; it also warns that antivirus exclusions reduce protection and do not disable EDR event processing. Do not add broad exclusions or turn off a security product without an authorized, controlled test. (Microsoft Defender documentation, 2026-09-17; Microsoft performance guidance, 2026-08-24.)
6. **Time Machine exclusions save backup scope, not demonstrated CPU time.** Apple documents exclusions as a way to omit files from backups. No measured evidence was found that excluding `node_modules` or build output from Time Machine resolves this CPU symptom. Likewise, the retrieved `sysctl` material concerns process limits, not faster process creation; changing limits is not a performance remedy supported here. (Apple Support, Time Machine guide; macOS tuning document, date not shown.)
7. **1Password is worth isolating, not blaming.** The supplied observation that `1Password` was using 61% CPU merits an A/B. Community reports document slow `op` calls and process/hang issues, including an example with seconds of wall-clock latency; those reports do not establish that `op` caused your system CPU saturation. Move secret resolution out of per-tool-call hooks if a timed test confirms it is expensive. (1Password Community, “CLI Slow Performance,” date not shown; Hermes Agent pull request, 2026-09-28.)

## 3. Who has encountered similar problems

1. Claude Code’s public issue tracker contains user reports of high idle CPU and busy loops, hook duplication spawning repeated ESLint processes, and leaked `caffeinate` processes. They establish that similar symptoms have been reported, but issue reports are not independent proof that the same bug—or any Claude Code bug—caused your measurements. (“High CPU usage when idle,” issue #21286, 2026-01-27; “Hook Configuration Progressive Duplication,” #3523, 2025-07-15; “caffeinate processes leak,” #28046, 2026-02-24.)
2. Another Claude Code report describes long-running sessions entering V8 garbage-collection thrash with very high CPU; a separate report records several idle sessions pinned at a core. These support checking each CLI/app process individually for idle CPU, leaks, and stuck event loops. (“Long-running sessions enter permanent V8 GC thrash,” #96378, 2026-09-23; “High idle CPU usage,” #68931, 2026-06-16.)
3. Codex issue reports document severe macOS `syspolicyd`/Gatekeeper symptoms associated with particular process-launch patterns. This makes security assessment a testable lead, not a general explanation for agent-related CPU problems. (OpenAI Codex issues #19885, 2026-04-27 and #23649, 2026-05-20.)
4. A Go issue reports a macOS `fsync` regression that was isolated by removing the `fsync` calls; the issue reports a roughly 10× macOS/Linux difference for that test. It illustrates why syscall-level isolation matters, but it is an old Go/version-specific result, not a current Go test suite comparison. (“Go 1.12 MacOS syscall/IO perf regression,” golang/go #30497, 2019-03-01.)
5. Bazel’s 2018 sandboxfs write-up shows that sandbox strategy can materially affect build performance, and a Bazel issue reports macOS sandbox overhead concerns. A `rules_go` issue reports Bazel test/link overhead versus `go test` for its then-current setup. None settles the performance of your current toolchain. (“Preliminary sandboxfs support and performance results,” Bazel, 2018-04-13; bazelbuild/bazel #8230, 2019-05-03; rules_go #2550, 2020-06-30.)
6. Similar high-CPU claims exist for Spotlight and developer file churn; one recent repository issue measured Spotlight-related processes using more CPU than the benchmark running at the time. That supports measuring indexing during your own run, not assuming it is responsible. (ohdearquant/lattice #1092, 2026-07-20.)

## 4. “Other people run 64 parallel threads”

The evidence distinguishes **agent sessions** from **OS threads**, and neither number by itself tells us how much local testing is happening.

- Imbue describes scaling from 10 local agents to 100+ agents deployed remotely in Modal sandboxes. This is evidence for remote parallel agents, not 100 local test-running processes on one laptop. (“A case study in testing with 100+ of Claude agents in parallel,” 2026-04-02; published 2026-04-03.)
- Anthropic reports 16 agents working on a C compiler over nearly 2,000 Claude Code sessions and about $20,000 in API costs. The retrieved article excerpt does not identify the worker hardware or show that all tests were run locally and simultaneously. (“Building a C compiler with a team of parallel Claudes,” Anthropic, 2026-02-05.)
- A 2026 capacity page reports 17 observed working sessions and claims 32 idle sessions on a 4-vCPU/8-GB computer. This is a session/RAM observation from a commercial service, not evidence that 32 sessions can all run CPU-heavy tests concurrently. (“How many Claude Code sessions can you run at once?,” OMG.dev, date not shown.)
- An orchestration guide says 30–50+ agents may use a high-memory VM or dedicated server, but it is guidance, not a measured controlled benchmark. A Conductor case study explicitly describes moving agents from the laptop to cloud workspaces because local hardware was a limitation. (amux guide, updated September 2026; Vercel/Conductor case study, date not shown.)

**Verdict:** I found no well-substantiated, hardware-specific demonstration that 64 concurrent Claude Code sessions each run full local builds/tests on one ordinary Mac. High counts often mean sessions waiting on model APIs, short tasks, remote sandboxes, or agents whose tests are limited/queued. The 64-session claim, as stated, is not verified by the evidence reviewed.

## 5. Linux versus macOS for this workload

1. Historical benchmarks and issue reports show macOS can be slower for some process-launch, filesystem metadata, or `fsync` workloads, but results vary by operation, OS version, hardware and implementation. The 2017 launch benchmark and 2018 APFS walk are not Apple-silicon comparisons of your suite. (Bits’n’Bites, 2017-06-03; Gregory Szorc, 2018-10-29.)
2. Linux inside a Mac VM is not automatically a faster filesystem path. A 2021 comparison reports shared host folders were orders of magnitude slower for I/O than either native macOS or the VM’s own filesystem. Lima documentation distinguishes host mounts such as VirtioFS from guest filesystems. Keep checkout, build artifacts and caches on the guest’s virtual disk for a fair VM test; bind-mounting the macOS worktree may preserve the bottleneck. (sffc, 2021-05-17; Lima mount documentation, 2026-10-05.)
3. OrbStack’s vendor benchmark reports 2–5× speedups over prior file-sharing implementations and examples near native macOS performance for selected workloads; its own documentation still notes an inherent cost for Mac-file access. These are vendor-selected workloads, not proof a Linux VM beats native APFS for your Go/Vitest/mods gates. (OrbStack, “Truly fast container filesystems on macOS,” 2024-05-22; OrbStack file-sharing docs, date not shown.)
4. A 2026 M3 MacBook Pro comparison of UTM/OrbStack/Lima reports substantial variation among bind-mounted and guest storage workloads, but it does not compare your exact suite against bare-metal Linux. (DEV Community benchmark, 2026-05-03.)
5. **No same-suite comparison was found** for your Go, Vitest, mods, TypeScript and mutation-test workload across native macOS, a Linux VM on this Mac, and bare-metal/remote Linux. Thus, “Linux will solve it” is a reasonable experiment, not an established result. The major practical cost is moving the agent/tool/test environment and preserving macOS-specific build/test access; the retrieved evidence did not examine that migration comprehensively.

## 6. The Mac mini claim

The documented Mac mini setups I found primarily sell **an always-on host**, persistent remote access, or a place for macOS/iOS builds—not a proven fix for macOS kernel overhead. One report uses an M4 16-GB mini as a shared, always-on remote development machine; another explicitly separates a cloud agent from a Mac used for Apple-platform builds. (Silkweave, 2026-07-08; Replicas, 2026-11-02.)

A second machine can isolate agent/build load from your workstation, but I found no measured same-suite comparison of a second Mac versus a Linux box or cloud runner for your test gates. A Mac mini running the same macOS and APFS workload is not, by itself, evidence of a different fix; its benefit would depend on its CPU/RAM/storage and on actually moving the work. Exact Apple retail purchase pricing was not established in the retrieved sources. For a dated operational comparison, GitHub lists Linux 2-core runners at $0.006/minute and its 5-core M2 Pro macOS runner at $0.102/minute in the retrieved pricing table; confirm current rates and included-minute terms before budgeting. (GitHub Actions runner pricing, retrieved page; date not shown.)

## 7. Offload designs for one operator

1. **Remote execution or CI for heavy gates:** move the expensive suite off the interactive Mac, with one controlled gate at a time or an explicitly bounded number of remote workers. This removes local CPU contention if tests genuinely run remotely; it does not make them faster unless the remote machine, cache, or scheduling is better.
2. **Remote build cache:** Bazel checks local and then remote cache entries and downloads a hit; uncached actions still run locally unless a remote executor is configured. Nx similarly shares cached outputs, and Nx can distribute task execution. Cache correctness depends on complete inputs/outputs and deterministic tasks. (Bazel remote caching documentation, date not shown; Nx caching docs, 2026-11-04; Nx distributed execution docs, date not shown.)
3. **Run fewer tests where safe:** Nx `affected` runs tasks selected from project dependencies, while test-impact analysis selects tests based on observed source/test relationships. Shopify reported about 60% average test-file selection and that around 40% of builds ran fewer than 20% of tests; Stripe reported a typical build ran about 5% of its full Ruby suite. Those results are from other repositories and do not justify skipping full verification for your code without validating selection recall and retaining a full suite on a trusted cadence. (Shopify Engineering, 2020-06-11; Stripe Engineering, date not shown.)
4. **Avoid repeated subprocess work:** investigate reducing per-test Git/process starts, batching repeated lookups, reusing test-built binaries, or using persistent workers where safe. A `posix_spawn` change has reported gains in narrow benchmarks, but no evidence shows it alone would resolve your total system CPU. (Python tracker, 2018-12-20; M2 Pro `spawnexec` result, date not shown.)
5. **Keep caches/artifacts in the filesystem where they run.** If testing a Linux VM, compare guest-local checkout/storage against a Mac host bind mount. Share read-only dependency/build caches only where each tool’s cache design permits it; sharing a mutable `node_modules` tree or Git worktree state can introduce correctness and coordination problems. (sffc, 2021-05-17; Bazel and Nx cache documentation, dates as above.)

## Ranked candidate fixes and proof plan

Expected gains below are qualitative: the available sources do not support a numeric prediction for this Mac.

| Rank | Candidate | Expected gain / proof | Cost and risk |
|---|---|---|---|
| 1 | Reduce work inside the hot gate: measure and reduce repeated Git lookups/process launches; reuse binaries or batch operations where tests permit. | Potentially high if the measured syscall/spawn volume is causal. A/B one unchanged Go suite with the current harness and a version that reduces repeated launches; compare wall/user/sys time, load, and total process counts. | Low-to-medium engineering effort; low security risk; ensure tests still exercise intended behavior. |
| 2 | Test whether executable assessment is involved. | Potentially high only if `syspolicyd`/XProtect is doing substantial work. Compare a newly built binary’s first launch with subsequent launches and capture `syspolicyd` activity during the stall. Fix a confirmed packaging/launch pattern, not security globally. | Low diagnostic cost; avoid bypasses. Signing/notarization may require build/distribution changes. |
| 3 | A/B exclude only volatile worktrees/build/dependency paths from Spotlight using Search Privacy. | Potentially material if `mds`/`mdworker`/semantic-indexing processes are active. Compare repeated identical gates with and without the narrow exclusion, while recording indexer and system CPU. | Low; excluded files will not be Spotlight-searchable. Verify the exclusion actually takes effect. |
| 4 | Check FSEvents/watchers and avoid unnecessary churn/rescans. | Potentially material if `fseventsd` or watcher-triggered rescans remain hot after file activity. Run one controlled mutation/build workload and compare against an otherwise idle baseline; inspect watcher configuration and process CPU. | Low-to-medium; disabling or narrowing watchers can make tools miss changes, so test correctness. |
| 5 | Isolate 1Password and any EDR/antivirus contribution. | Unknown until measured. Time a harmless representative `op` operation and compare with the relevant hook disabled; for EDR, use vendor diagnostics and only an authorized narrow exclusion test. | Low diagnostic cost; security policy can limit what may be changed. Do not disable protection or use broad exclusions. |
| 6 | Benchmark the same gate in a Linux VM using guest-local files, then on remote/bare-metal Linux. | Could be high for metadata-heavy work if the kernel/filesystem is the main bottleneck. Compare the identical commit, dependency versions, warm/cold cache state, and test command; do not use a Mac bind mount for the guest-local baseline. | Medium setup; VM shares the Mac’s CPU/thermal budget and RAM. Remote Linux adds access, environment, and data-handling considerations. |
| 7 | Move heavy gates to remote CI/build workers and use caches/impact selection. | High relief to the local workstation if execution is truly remote; wall time depends on runner and cache. Pilot one gate and measure cache hit rate, transferred bytes, and local CPU. | Medium setup and recurring cost; cache-key correctness, test-selection false negatives, credentials and data policy need attention. |
| 8 | Buy a Mac mini only for a concrete always-on or macOS-only need. | A second machine can offload local work, but no evidence found predicts its speedup for your gate. First test offload to an available second host or remote runner. | Purchase and maintenance cost; does not establish or fix the original cause. |

### No-sudo diagnostic commands

Run these during a reproducible gate and save timestamps and output. They observe; they do not by themselves identify a root cause.

```sh
# System-wide CPU/load, sampled once per second
 top -l 10 -s 1 -o cpu

# Current process snapshot; sort and inspect the top CPU users
 ps -Ao pid,ppid,stat,%cpu,etime,command | sort -k4,4nr | head -30

# Per-process samples for your own CLI/test process
 sample <PID> 10 1

# Spotlight state and candidate indexer processes
 mdutil -s /
 ps -Ao pid,%cpu,etime,command | grep -E 'mds|mdworker|spotlightknowledged|textunderstandingd|fseventsd'

# Check whether the specific path is excluded from Time Machine (backup only)
 tmutil isexcluded /path/to/worktree

# Check quarantine metadata on a test executable; do not remove it as a blanket remedy
 xattr -p com.apple.quarantine /path/to/test-binary

# Inspect policy/log events around a controlled first launch
 log show --last 5m --style compact --predicate 'process == "syspolicyd" OR process == "trustd"'

# Repeated launch timing: compare a fresh executable and then the same executable again
 time /path/to/test-binary --version
 time /path/to/test-binary --version

# Read the current process limit; do not change kernel limits as a speed tweak
 ulimit -u
 sysctl kern.maxproc kern.maxprocperuid
```

A `sample` or log command may be restricted for a system daemon on a particular macOS configuration; do not elevate privileges merely to force access. If you cannot observe the system daemon without `sudo`, use Activity Monitor, approved diagnostics, or an administrator-approved capture. `DevToolsSecurity -enable` is not the proposed diagnostic or fix for ordinary process-launch overhead.

## Preserve the problem context for tomorrow

Save a dated, append-only issue note such as `mac-cpu-saturation-2026-11-06.md` in the issue or repository. Include:

- **Environment:** Mac16,7/M4 Pro, 14 CPU cores (10P/4E), 48 GB, macOS/Darwin version; Claude Code/Desktop versions; active security/EDR tools; storage/free-space state.
- **Workload map:** session count, worktree count and locations, `node_modules` layout, watchers, hooks, queued job state, and the exact command/test commit. Preserve representative logs and the 5,940 Git lookup / file-open/stat counts with the command that produced them.
- **Time-series observations:** timestamped `top` output, load, user/system/idle CPU, thermal reading, process snapshots, and which workload was running. Keep the already observed “nothing heavy / commit / mods / mutant / Go gate” cases as separate rows rather than combining them.
- **Evidence labels:** mark each statement `OBSERVED`, `REPORTED`, `HYPOTHESIS`, or `NOT TESTED`. Record “cause of system CPU is not proven” prominently. Do not turn correlations or issue reports into a diagnosis.
- **A/B log:** one change at a time, same commit and command, same cache state, at least a repeat run; record wall/user/sys time, load and relevant daemon CPU. Save the raw command output, not only conclusions.
- **Next decision:** prioritize reducing repeated process/filesystem work, then test security assessment and indexing/watchers, then compare guest-local Linux VM and remote Linux. Record any exact setting changed and how to revert it.
- **Recovery/context:** list active worktrees/branches and uncommitted changes, links to logs/profiles, and a short “resume here” paragraph. Never include credentials or secret environment-variable values.

## Coverage and evidence gaps

The following requested topics were **not examined sufficiently to make a specific finding**: direct APFS clone-cost measurements; a controlled Apple-silicon benchmark of `stat`/`open`/`exec` on current macOS versus Linux; direct per-spawn measurements for `getpwuid`, `cfprefsd`, or `notifyd`; the performance impact of macOS sandboxing in your workload; current macOS VFS name-cache contention; and the exact role of each process in your supplied CPU snapshot. Searches for Linux-VM and container comparisons did not yield a same-suite native-macOS/Linux/VM benchmark for your workload.

Also not examined comprehensively: issue trackers for Cursor, Aider, Codex, Vibe Kanban, Crystal, Claude Squad, and every other named orchestrator; Linux-specific Claude Code support and what macOS features would be lost in a migration; Homebrew/Chromium/Nix build cases; a measured second-Mac-versus-Linux/cloud offload of your gate; and an official Mac mini purchase-price comparison. `GOCACHEPROG` was sought as a cache lane, but no relevant result was retrieved here. Time Machine exclusions were checked as a requested remedy, but no performance gain was found. The evidence on `.metadata_never_index` is contradictory, and the APFS lock explanation is an informed historical hypothesis—not a confirmed current root cause.

**Decision:** do not buy hardware or weaken macOS security as the first move. Preserve the evidence, then run controlled, one-variable tests. The strongest initial engineering target is the heavy gate’s exceptionally high process and metadata-operation count; the most important independent checks are `syspolicyd`, indexers/FSEvents, and the observed 1Password process.