# Bottom line

**Sixteen agent processes can be open on one Mac; sixteen CPU-heavy lanes cannot all stay fast if they repeatedly run the same expensive work.** The useful distinction is whether “lane” means an idle, mostly model-waiting session or a lane simultaneously running tests, hooks, and builds. For the latter, your measured ceiling—about one Go suite per minute—means parallel dispatch mainly divides the available CPU and increases each lane’s wait. No local scheduler or Git replacement creates more CPU capacity.

The best first bets are to **avoid rerunning work**, make test results reusable across worktrees, measure hook/runtime launches, and selectively remove expensive child-process starts. When independent suites must all run, add remote or additional compute; a Linux VM on the same Mac may change the OS cost structure, but it does not add cores. Your own observations already show why this distinction matters: `-parallel 5` reduced spawn p90 under concurrent suites, but did not make a lone suite faster; `taskpolicy -c utility` cost more CPU and wall time.

Claims below are marked **Measured** (a reported benchmark or your measurements), **Reported** (project documentation or a published claim without an equivalent measurement of your workload), or **Inference** (a testable proposal). For each door, the cheapest test is listed. Source names are given inline.

## Ranked doors: likely gain versus cost to try

### 1. Eliminate repeated tests and share valid results — **potentially very high CPU/lane gain; low-to-medium trial cost**

**What:** Before optimizing a test run, establish whether that lane needs to run it. Use changed-file/dependency-based test selection; share or replay successful results when the inputs really match; and avoid having several lanes independently verify the same tree. Build systems such as Bazel and Pants support dependency-aware test selection and remote result reuse. Go has a build cache safe for concurrent invocations and supports external cache integration through `GOCACHEPROG`, but Go’s test cache observes files and environment variables used by tests. That can cause cross-worktree misses; a shared cache directory alone is not proof that results will be reused safely.

**Numbers / who measured:** **Reported:** engineer Tony Wang described a Go monorepo release gate falling from **60.7 minutes / 1,121 rerun packages** to **8.2 minutes / 196** after `-trimpath`, then to **4.2 minutes / 25** after embedding test fixtures. This is one project’s reported result, not a forecast for your suite. Uber describes avoiding already-proven tests with a shared Bazel remote cache, but the retrieved account did not give a speedup number. Your own report that a test suite runs in multiple lanes supplies the clearest opportunity if those runs cover identical inputs.

**Risk:** Incorrect dependency/input declarations or incomplete test cache keys can replay a stale pass. Tests that open worktree-specific files or read changing environment state may not share results as expected. Keep a full-suite verification path.

**Cheapest test:** Run the same unchanged Go package twice in one worktree and in a second worktree; inspect `GODEBUG=gocachetest=1` and the `go test` output for cache hits. Separately, map changed source files to affected packages and compare selected tests with the full suite. Do not count a hit unless its inputs are demonstrably equivalent.

### 2. Add compute for genuinely independent heavy lanes — **very high lane-capacity gain; medium setup/cost**

**What:** Put test and shell execution on additional workers—remote Linux machines, additional Macs, or vendor-hosted agent environments—while leaving inference and coordination where convenient. This is the most direct route to 16 simultaneous CPU-heavy lanes. A remote machine’s faster throughput is not established for your suite; its advantage is additional CPU capacity.

**Numbers / who measured:** **Reported price:** Hetzner’s CCX43 listing describes **16 vCPUs and 63 GiB RAM at $0.4983/hour**, about **$364/month** at 730 hours before any extras, based on the listed hourly rate. That is a pricing example, not a recommendation that the VM’s CPU matches a Mac core. AWS search results included an obsolete instance, so I would not use that figure to budget a current setup. **Reported architecture:** Codex Cloud starts each task in its own isolated workspace; Cursor Cloud Agents use isolated cloud VMs; Devin Outposts queue sessions for workers, with additional workers serving additional concurrent sessions. None of those facts is a measured capacity guarantee for your exact tests.

**Risk:** Provisioning, data movement, secrets, dependency setup, cloud charges, and remote filesystem behavior. Validate that the remote lane runs the same tests and tool versions. A queue on one worker still queues; capacity comes from adding workers.

**Cheapest test:** Run one representative, fully prepared suite on one low-cost Linux worker and compare CPU-seconds, elapsed time, process rate, and test results with the Mac. Then run two independent copies to test scaling before moving agent shells.

### 3. Reduce agent-hook and shell-startup work — **medium to high if hooks fire on every tool call; low trial cost**

**What:** Inventory every synchronous hook, shell initialization, plugin, and MCP command that runs per tool call. Filter hooks before they start (Claude Code documents permission-rule-based `if` filtering), combine cheap checks into one dispatcher, move non-blocking side effects to asynchronous hooks, and use long-lived MCP stdio servers instead of repeatedly starting a runtime. Claude Code documents stdio MCP servers as long-lived processes. A persistent shell is another option for a harness that can safely maintain one shell per session.

**Numbers / who measured:** **Reported:** one hook benchmark measured **27.3 ms** CPU for `node -e 0` and **12.7 ms** for `bun -e 0`; its PreToolUse hook cost **56 ms** CPU per Bash call, with PostToolUse adding a similar cost. That was a 64-core Linux workstation, not your Mac. A separate Apple M3 Pro report measured fresh Node hook binaries at **34–38 ms** median. Joyee Cheung measured an empty Node startup growing from about **19 ms to 27 ms** across versions on macOS. These are large enough to matter when multiplied by frequent hooks, but not evidence that your own harness spends that much.

**Risk:** Combining hooks can change ordering, failure handling, or isolation. Persistent shells retain state; only use them if working-directory, environment, timeout, and child-process cleanup are controlled. Do not make a required safety check asynchronous merely to save latency.

**Cheapest test:** Log per-hook invocation count, CPU time, and wall time for one representative session. Disable one nonessential hook in a test profile, or add a narrow `if` matcher, and compare total CPU-seconds for a fixed set of tool calls. Measure login-shell startup separately.

### 4. Test a Go `posix_spawn` path for subprocess-heavy code — **medium whole-suite gain; low-to-medium trial cost**

**What:** Your Go `os/exec` workload uses fork-then-exec on macOS. A `posix_spawn` implementation may avoid some of that cost. This is a targeted optimization, not a fix for CPU spent doing real work.

**Numbers / who measured:** **Measured by you:** `fastexec` was about **23% cheaper per spawn** and **6% cheaper across the whole suite**, but broke two tests and was not merged. **Reported:** the `spawnexec` Go package measured **35–42% faster** than `os/exec` on an **M2 Pro**, for small commands such as `true`, `echo`, and redirected output. A separate M1 MacBook Air comparison measured only **2%** faster for `clang --version`, illustrating how workload and parent state affect the result. The `spawnbench` project reports that macOS `posix_spawn` stays flat with parent heap size while fork scales with heap shape; its authors caution that a single large `mmap` can mislead.

**Risk:** Child setup semantics, file actions, working-directory changes, signals, environment, and test assumptions must match. Your two broken tests are direct evidence of compatibility risk; preserve a fallback and do not replace all process creation without a complete suite run.

**Cheapest test:** Re-run the same small spawn benchmark and the two failing tests on the exact macOS 27 machine, then run the full suite with identical inputs. Report CPU time and wall time separately; the whole-suite gain, not the microbenchmark, determines value.

### 5. Trim remaining Git processes, but embed Git operations selectively — **low-to-medium likely gain after your custom Git work; medium/high integration risk**

**What:** Avoid starting Git for operations that can safely be answered in-process—particularly repeated status, path, or metadata queries—while keeping the real Git CLI for operations whose hooks, filters, signing, or compatibility behavior matters. Git libraries are not interchangeable drop-in replacements for every write.

- **Your custom Git:** **Measured by you:** about **2.56 ms per start**, 85 dylibs, and **16% off the suite**, after removing gettext, Rust, Perl/Python, CoreServices, and fsmonitor. This is already a strong win; further CLI slimming has a diminishing return if the remaining CPU is `x` or actual tests.
- **libgit2:** **Reported:** libgit2 is a mature linkable C library used by GUI clients, forges, and utilities. A comparison of the `hk` and Lefthook hook managers says `hk` uses libgit2 rather than spawning Git; the comparison reports Git command timings such as roughly **4.5 ms** for `rev-parse` and **7.9 ms** for `status`, but the retrieved excerpt did not provide a defensible suite-wide percentage gain. Try it for repeated read queries, not as an assumed replacement for every write.
- **go-git:** **Reported:** actively developed since 2015, used by Gitea, Pulumi, and Keybase; the stable line was **v5.19.3** and v6 had a **beta.1** release in October 2026. Its compatibility matrix marks some functionality, including Git filter support, incomplete or unsupported. It may fit application-specific repository operations, but test its exact hook/filter/signing needs before adoption.
- **gitoxide (`gix`):** **Current project status:** its README marks clone, fetch, status, and commit as implemented, but marks push, commit hooks, commit-level merge, rebase, and reset incomplete. Its crate status also leaves hook discovery/execution and clean/smudge filter work incomplete. Commit-signing work exists; that does not make it a complete Git replacement. It is active and widely watched on GitHub, but there is no retrieved measurement showing it improves your test suite.
- **Sapling and Scalar:** Sapling’s `.sl` mode has scalability features; its docs describe a Watchman-backed working-copy path where add/remove can be O(changed files) rather than O(total files). That targets repository scanning, not necessarily child-process count, and Git interoperability has tradeoffs. Scalar focuses on large repositories: partial clone, sparse checkout, and fsmonitor reduce repository data or scanning. Those are worth testing if scans dominate, but not an answer to process startup alone.
- **Jujutsu:** current docs confirm that Git remote operations spawn `git`; Jujutsu documents no Git hooks. Its Git-backed interface is therefore not a direct way to preserve your required hooks while eliminating Git launches.
- **Agent-oriented newcomers:** `betterhook` describes itself as a worktree-aware hook manager; its retrieved benchmark excerpt did not contain a number. `nanogit` explicitly targets remote Smart HTTP repository operations, not local worktrees, index operations, hooks, or merges. These do not displace Git for your local write path.

**Risk:** Hook behavior, signing, clean/smudge filters, index/worktree semantics, and edge-case compatibility. Global replacement is the wrong first experiment. Jujutsu/gix considerations you already weighed should remain closed except where the current feature checklist changes the relevant facts.

**Cheapest test:** Identify the highest-count Git subcommands in one suite. Replace only one read-only call with a library API; compare results against Git on a fixture repository that includes your hooks and filters. Count avoided process starts and full-suite CPU-seconds. Keep commits and other sensitive writes on Git until they pass end-to-end compatibility tests.

### 6. Tune Go and Vitest runners against CPU-seconds, not just wall time — **medium and workload-dependent; low trial cost**

**Go:** `-parallel` limits parallel test functions within a single test binary; it is not the same knob as package/build concurrency. `GOMAXPROCS` caps simultaneous Go goroutine execution, not external child-process CPU. Your measured `-parallel 5` tradeoff is already more useful than generic advice: lower spawn p90 with three concurrent suites, but worse wall time for a suite alone. Keep separate configurations for an interactive Mac and a dedicated test runner if measurements support them. The Go test cache can avoid whole test executions when inputs match; `-count=1` explicitly bypasses that cache.

**Vitest:** its performance guide recommends trying `threads` and, where test semantics permit, disabling isolation; worker/pool choice and isolation have project-specific tradeoffs. Vitest 5’s published benchmarks show improvements ranging from **8% to 53%** on selected fixtures/configurations, not a guaranteed gain for your tests. Its `vitest doctor` can compare candidate settings.

**Numbers / who measured:** **Measured by you:** Vitest costs about **100 CPU-seconds** and is **31% kernel**. **Reported by Vitest:** the Vitest 5 maintainers measured the benchmark suite they publish; their results include an enterprise-monolith case improving from **7.24 s to 5.83 s** and a dependency-heavy case from **1.59 s to 0.74 s**. **Reported by CyberAgent:** a Go CI investigation measured reduced test compilation time from **29 s to 20 s**, but did not establish that this applies to your suite.

**Risk:** Less isolation can expose test-order/state bugs; `threads` cannot use process APIs such as `process.chdir()`. Lower Go concurrency can increase solo wall time, as you observed. No retrieved benchmark established an optimal `GOGC`, linker setting, or `-p` value for your suite.

**Cheapest test:** Use Vitest’s doctor or compare `forks`, `threads`, `vmThreads`, and isolation settings on the same test selection. For Go, vary `-parallel`, package `-p`, and `GOMAXPROCS` one at a time; capture CPU-seconds, wall time, process count, and failures for solo and concurrent runs.

### 7. Try Linux on the Mac only as a controlled OS/filesystem experiment — **uncertain CPU gain; medium trial cost**

**What:** A Linux guest may change process-spawn and kernel costs, but a Virtualization.framework VM shares the Mac’s CPU. It is not extra compute. Keep the repository and test caches in the guest’s native Linux filesystem where possible; frequent metadata operations on a host bind mount cross the VM boundary.

**Numbers / who measured:** **Reported:** OrbStack says its filesystem work reached **75–95% of native performance** in its benchmark and reports **2–5×** real-workload gains from its own filesystem changes; those are vendor measurements, not a Linux-vs-macOS comparison of your suite. A 20,000-small-file comparison reported roughly **4.3 s** on Docker Desktop versus **6.4 s** on Apple Container for a host bind-mounted directory. Another Apple Silicon sysbench comparison showed similar CPU scores among native-arm64 Docker, OrbStack, and Apple Container, but did not measure fork/exec rates. **Not found:** a comparable measured process-spawn rate, end-to-end CPU time, or memory overhead for your suite inside these VMs.

**Risk:** Guest startup, VM memory, host-to-guest sync, filesystem semantics, debugging friction, and competing for the same physical cores. Apple Container uses a VM per container, which may be less attractive for many frequently started lanes than a shared Linux VM.

**Cheapest test:** Clone or sync one worktree into the guest’s native filesystem and run the exact same suite and spawn loop under one selected runtime. Compare CPU-seconds, open/process rates, wall time, resident memory, and test results. Do not infer success from a CPU-only microbenchmark.

### 8. Improve responsiveness with admission control, not magic core assignment — **little/no total CPU gain; low-to-medium trial cost**

**What:** A per-user machine-wide queue can stop many sessions from launching heavy test phases at once. A shared GNU make jobserver coordinates participating tools, but does not automatically control every process in a coding-agent tree: the retrieved `lock` documentation lists GNU make, Ninja, Cargo, and GCC/LLVM LTO as participants, while noting that Go and Bun do not speak the protocol. A wrapper can still limit when entire test commands begin.

**Numbers / who measured:** **Measured/reported by a tool author:** `cpuq` describes a 10-CPU Mac shared by three agent sessions where load average fell from **36–120 to 5–9** after admission control. That is a tool-specific report, not proof of higher suite throughput. **Measured by you:** three concurrent suites used about the same CPU per suite and took longer; a queue changes the waiting pattern, not the Mac’s total work rate.

**Risk:** Excessive serialization can reduce throughput when suites have idle periods. QoS and priority changes can make completion slower; you already measured that for `taskpolicy -c utility`. macOS does not expose a normal Linux-style user CPU-affinity control; `thread_policy_set` affinity is described as a hint, not a dependable pinning mechanism.

**Cheapest test:** Gate only whole-suite/test-heavy commands at two or three concurrent slots and compare total suites completed per hour, interactive latency, and per-suite p90. Keep lightweight agent shell commands outside the gate.

### 9. Revisit hardware only after measuring the remaining workload — **potentially high capacity gain, high cost**

**What:** More CPU cores can raise parallel CPU throughput, especially a higher-core-count desktop; faster single-core and storage can also help, but neither guarantees a 16-lane result. A new Mac does not eliminate sandbox, process, or test work.

**Numbers / who measured:** **Reported:** the community XcodeBenchmark table lists an M4 Pro 14-core MacBook Pro at **104 seconds** and an M5 Max 18-core model at **84 seconds**. These are not a controlled same-machine test of your Go suite; the configurations and software versions differ. M5 Ultra machines have higher reported multicore scores, but the retrieved evidence did not include an equivalent Xcode or Go-suite comparison suitable for estimating your gain.

**Risk:** High purchase cost and a misleading extrapolation from a different benchmark. Check RAM pressure, thermals, and actual sustained suite throughput before buying.

**Cheapest test:** If possible, borrow/rent a higher-core-count Mac and run your exact full suite several times at 1, 4, and 8 concurrent lanes. Compare total completed suites per hour and each lane’s latency, not a synthetic multicore score.

## Kernel/security and the less obvious doors

**What the evidence supports:** macOS uses `dyld` to load dependencies at process start; a published macOS internals account says a tiny CLI can take around **10 ms** to start and an app with many third-party frameworks can exceed **100 ms**. Your observed Git binary’s **706 dylibs** versus the custom binary’s **85** is therefore a plausible, already-tested optimization direction, though it does not isolate dyld’s share. The same account describes sandbox policy checks on controlled syscalls. Your measured **19% of kernel samples** in the Sandbox kext on opens is important local evidence, but I found no independently measured change that safely removes that cost for unsandboxed shells.

Apple says XProtect scans apps that have changed or are at first launch. A practical Gatekeeper benchmark reports that repeatedly launching fresh or copied executable paths can cost more than repeatedly launching an already-assessed trusted binary; it advises against disabling Gatekeeper. This is worth checking if tests create many unique binaries, but it does not establish that every Git launch is rescanned. Apple’s Endpoint Security API allows security clients to authorize or observe events including execution and fork; I found no quantitative general overhead figure. Do not treat this as evidence that a particular installed security client is responsible for your measured cost.

**Safe owner-controlled experiments:** keep frequently launched trusted tools at stable paths; build once rather than copying many new executable paths; compare first launch of a test binary with repeated launches; and inspect the active Xcode/toolchain selection. If a trusted artifact is quarantined, verify that fact and assess only that artifact. Do not disable Gatekeeper, SIP, XProtect, or system sandbox protections as a performance “fix.” I found no supported macOS setting that safely disables Sandbox.kext checks for your ordinary shells, and no measured benefit from changing code-signing state, dyld closures, or Developer Tools permissions for this workload.

**Cheapest test:** Run a fixed executable repeatedly from one stable path, then compare with a newly built/copied executable while recording process CPU/wall time and `syspolicyd` activity. In a separate controlled test, count file opens and compare the same command under the real shell environment. Avoid changing global security settings.

**Other doors:** Anthropic’s Scion and OpenAI’s Pando show that large agent workloads can motivate server-side source-control redesign. Pando’s reported production benefit is nearly **5× lower median push latency**, but it is a Git-compatible backend change, not evidence that replacing local Git launches will speed your tests. Scion is explicitly designed for very large monorepos and agent/job-heavy environments, not as a general Git replacement. For your local work, the more surprising low-cost opportunity is that your test subject `x` reportedly accounts for about **170 CPU-seconds**: identify which tests need a real child process and test a library-level/in-process entry point for the others. **Inference:** that could reduce launch overhead and harness work, but it cannot eliminate CPU spent executing `x`’s actual logic. Keep subprocess tests for argv, environment, exit status, signals, and process boundaries.

## Agents at scale: what the evidence says—and does not say

Cursor Cloud Agents and Codex Cloud use isolated remote environments; Devin sessions execute on worker machines, and Outposts scales by adding workers. Claude Code’s agent view runs sessions locally and gives each editing session a worktree. Conductor documents both local Mac workspaces and cloud sandboxes. Factory supports multiple sessions and persistent Droid Computers; Container Use gives agents isolated containerized environments. Sculptor describes agents running in separate containers. These products principally isolate work or move execution to remote machines; isolation by itself does not increase a single Mac’s CPU.

**First-hand per-Mac capacity:** I found no official, measured “sessions per Mac” number for Cursor local, Claude Code, Conductor, Factory, Sculptor, or Container Use. A production-scale Copilot study reports a median of **2 sessions per user** and **P90 of 8**, not sessions per machine or a CPU capacity target. Do not present that as a 16-lane hardware benchmark.

## Not established in this research

- A complete census of every maintained Git client/library/daemon was not established; **Dulwich was not examined**, and some additional VCS projects surfaced without a feature or maintenance audit. The nit comparison you had already weighed was not reopened. The current gitoxide checklist was checked; no end-to-end proof was found for your exact hooks, signing, and clean/smudge filters.
- No exact macOS 27.2 measurements were found for open syscall cost, Sandbox.kext overhead on your shells, Endpoint Security-client overhead, code-signing-state effects, dyld-closure gains, or Developer Tools permission changes. XProtect behavior is documented, but the performance impact on your exact fixed binaries is not established.
- No comparable Linux VM benchmark was found for your suite’s fork/exec rate, process CPU cost, memory overhead, or end-to-end lane throughput. No 16-lane run on one Mac or one remote Linux host was found.
- Official product documentation established local/cloud execution models, not a measured per-machine session limit for the named agent products.
- No workload-specific measurement was found for `GOGC`, Go linker/compiler settings, a persistent Go test worker, Vitest settings on your suite, or converting the `x` tests to in-process calls. Those remain low-cost experiments, not promised gains.
- The remote price above is one indicative compute option, not a complete provider comparison or a cost model for 16 workers.

**Practical order:** first measure which tests can be skipped or shared; then profile hook/runtime starts and the remaining child processes; test the Go spawn patch and runner settings without losing full-suite correctness; and move or add compute if 16 lanes must execute CPU-heavy work simultaneously. Queueing is useful for keeping the Mac usable, but only avoided work or added compute raises total lane throughput.