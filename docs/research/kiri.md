---
dies-when: kiri test drive starts or is dropped (watch on github.com/libracoder/kiri/releases; revisit when #310 and #288 close)
---
Ticket: none

# Kiri vs colima for a rare-use solo Mac dev: source lane

Read 2026-11-15, repo `libracoder/kiri@ae3467e`. The video itself was not opened (no URL given).

## Verdict
**Worth a test drive, not yet a replacement.** The speed and idle claims hold up in the source. But the project is 13 days old, mostly one person, and has open gaps in the dev loop (hot reload, build networking). For rare use the real gain is the VM sleeping by itself, not the start time. Keep colima and switch with `docker --context`.

## 1. Project facts
- Repo: https://github.com/libracoder/kiri. License Apache-2.0. Site https://runkiri.com. Created 2026-11-02.
- Owner: user `libracoder` (88 commits; the next contributor has 4). The CLA names "Canestack Labs" (`CLA.md`). Releases are built in a private repo (`RELEASES.md`).
- Releases: first on GitHub v0.1.14 (2026-11-02), latest v0.2.1 (2026-11-15). That is 6 releases in 13 days. The site says "Beta".
- 6,031 stars, 271 forks. 58 open issues and 37 open PRs (GitHub search API, 2026-11-15).
- Homebrew: no formula and no cask (formulae.brew.sh returns 404). You install a `.dmg`, and the app updates itself (README L72-80).

## Video claims vs source
| Claim | Source says |
|---|---|
| 22 ms vs ~170 ms on Docker Desktop | Benchmarks page: 22 ms Kiri, 178 ms Docker Desktop, **152 ms colima**, 279 ms OrbStack. Kiri 0.1.13, M3 Max, every engine at 2 CPU/8 GB, 2026-11-02 (https://runkiri.com/benchmarks/). README now: 14.2 ms CLI (L97-103). |
| daemon ~10 MB | 9.7 MB = daemon 9.0 + guest agent 0.69 (`bench/results.json`). The **Virtualization.framework helper adds 69 MB** on top (same file). |
| VM sleeps after 60 s, wakes in ~0.1 s | Confirmed: `KIRI_IDLE_SECS`, default 60, 0 = never (`crates/kiri/src/daemon/engine.rs` L1044). It only sleeps when no container is running (L1100). Boot 112 ms (`results.json`), docs say 0.15 s. |
| Returns memory | Balloon (`features.md` L57). Not measured. |
| No containerd/runc/shim; clone3 | Matches README L109-119. |
| Local domains, HTTPS | `*.kiri.local` once you opt in, or `*.kiri.localhost` with no setup. HTTPS via its own name-constrained CA (`features.md` L33-39). |
| Colima faster at bind-mount reads, OrbStack at new HTTP connections | True on the Mac page: bind read 5235 MB/s colima vs 1724 MB/s Kiri. New HTTP connections 2389/s OrbStack vs 1892/s Kiri (benchmarks page). |
| Import; k8s in ~20 s | `kiri import` (README L89). k3s in "~20 s" (`features.md` L68). Not measured. |

## 2. Is the benchmark fair?
- Every run is warm. `bench/suite.sh` L13-16 pulls alpine first, runs it 3 times, then uses hyperfine with 3 warmups. `kiri bench` uses 5 warmups and the VM "already up" (`crates/kiri/src/bench.rs` L1-10, L54). The 22 ms therefore excludes the cold image pull and the 60 s sleep. **Your case is a VM that is usually asleep, so you would pay about 0.1-0.15 s of wake time on the first run, plus image pulls.**
- `kiri bench` leaves colima out (`bench.rs`); `bench/suite.sh` runs against any context. The raw Mac data is only a PDF (not opened).
- Fair for warm starts; not what you will feel day to day.

## 3. Biggest open gaps (open issues, 2026-11-15)
- **Bind mounts:** files changed on the Mac send no inotify events into containers, so hot reload breaks (#310; also #48 point 3, still seen on 0.2.0). Permission bugs #72 and #98 are closed. The VM disk does not shrink (#123).
- **Build:** no network during `docker build` on macOS 0.2.1 (#288). `--platform` builds pick up a local image of the wrong arch (#57). BuildKit `host-gateway` fails (`features.md` L121).
- **amd64/Rosetta:** a crash on every amd64 container (#199) and bun under emulation (#66) are both closed. Nothing open on Apple Silicon.
- **Networking:** Compose DNS aliases can resolve to another project's container (#294). `host.docker.internal` does not reach `::1` (#258).
- **Stability:** "agent exited" at boot (#316). Images with 60+ layers fail (#253). `docker load` fails (#85, partly fixed).

## 4. Telemetry and cloud
- Crash reports are **off by default** and sent to Kiri Cloud only after you opt in in Settings (`crates/kiri/src/diag/report.rs` L551-556, L589).
- Update checks: when the window opens and every 6 h, to `download.runkiri.com`. They can be turned off ("Check for updates automatically"; `ui/mod.rs` L628-630, L2106-2110).
- Share: opt-in. `kiri share` or the Share button opens a tunnel to `edge.runkiri.com`, with URLs on `*.runkiri.cloud`. Sign-in is a GitHub device flow (`crates/kiri/src/share.rs` L1-16, L47).
- No analytics SDK found in the app source. The website loads Google Analytics.

## 5. Test drive: one measurement
Same Mac, both on 2 CPU / 8 GB, colima using vz + virtiofs, the bench run with both VMs stopped first:
1. Cold first `docker run --rm alpine true` with the VM asleep (Kiri: wait more than 60 s; colima: `colima start` included), then the warm median from `bench/suite.sh`.
2. Idle RSS after 5 min: Kiri daemon plus the VZ helper, against colima/lima processes.
3. A 1 GB bind-mount read (`suite.sh` bind-read) and an inotify check on your real project (#310).

If inotify fails or the build has no network (#288), stay on colima for now.

## Not checked
- The video itself and its exact numbers (~170 ms, 0.1 s).
- The benchmark PDF and raw Mac JSON.
- Independent third-party measurements (none found).
- How the memory balloon actually behaves.
- `kiri import` and k8s timing.
<!-- end -->


## the web lanes (exa, parallel), 2026-11-15

## 1. Kiri

**What it is.** Kiri is a beta, Rust-written Docker Engine API-compatible runtime: on macOS it runs a small Linux guest through Apple’s Virtualization.framework, with a Rust guest agent that starts containers directly (no `dockerd`, `runc`, or shim). It supplies a Docker context and supports the normal Docker CLI, Compose and buildx. The repository is [libracoder/kiri](https://github.com/libracoder/kiri) (repository snapshot checked 2026-11-15); its listed maintainer is `libracoder`, and the snapshot showed 1,893 stars. The project’s own release history dates the first release, 0.0.1, to 2026-08-04; 0.1.14–0.1.18 arrived 2026-11-02–06, 0.2.0 on 2026-11-10, and 0.2.1 was current on 2026-11-15—very rapid beta cadence, not a stable release schedule ([release history](https://runkiri.com/releases/), checked 2026-11-15). Licensing is contradictory: the repository front page says Apache-2.0, while Kiri’s FAQ says the code is dual-licensed MIT or Apache-2.0; the guest Linux kernel is GPL-2.0. Treat the FAQ/repository state as requiring clarification before redistribution ([repository](https://github.com/libracoder/kiri), [FAQ](https://docs.runkiri.com/faq/), both checked 2026-11-15).

**Claims and benchmarks.** The headline claim is broadly supported, but the numbers have changed between project pages. Kiri’s published Apple-Silicon comparison reports `docker run --rm alpine true` at **22 ms**, versus Docker Desktop **178 ms**, OrbStack **279 ms**, and Colima **152 ms**; the test used the same Docker CLI, warm images, two CPUs and 8 GB, and was dated 2026-11-02 ([benchmark](https://runkiri.com/benchmarks/), 2026-11-02). Its newer benchmark repository reports **18.3 ms** for Kiri in a 2026-11-03 rerun, so “22 ms” is a particular run, not a fixed property ([kiri-bench](https://github.com/libracoder/kiri-bench), 2026-11-03). The comparison also measured bind-mount reads at Kiri **1,724 MB/s**, Docker Desktop **1,354**, OrbStack **3,240**, and Colima **5,235**: Colima wins that workload. Published network results show Kiri ahead on single-stream/new HTTP connections, while OrbStack wins four-stream published-port throughput ([benchmark](https://runkiri.com/benchmarks/), 2026-11-02/03).

The **~10 MB** claim is close: Kiri documents **9.0 MB** for the daemon and **0.69 MB** for the guest agent, while its FAQ reports **9.7 MB combined** versus OrbStack’s **216 MB** for the compared engine processes. Idle CPU was documented as **0.0%** for the daemon; the published comparison did not provide a controlled Colima-vs-OrbStack-vs-Kiri idle CPU/RAM table ([memory documentation](https://docs.runkiri.com/memory/), [FAQ](https://docs.runkiri.com/faq/), checked 2026-11-15). The **60-second idle shutdown**, roughly **0.1 s** wake (documented cold boot: 112 ms), and memory return to macOS are supported: the balloon returns unused memory while awake, and powering off after 60 seconds returns the remainder ([memory documentation](https://docs.runkiri.com/memory/), 2026-11-15). I found **no battery benchmark**, so battery-life superiority is unsubstantiated.

These are not independent benchmarks in the strong sense: both the comparison and `kiri-bench` are Kiri-maintainer project material. I found no independent Colima/OrbStack battery, idle-resource, network, and bind-mount study. Also, the user’s “~170 ms Docker Desktop” figure is not the cited run’s value: the project reports 178 ms there. I found no Better Stack Kiri feature; the relevant 2026 Better Stack result was a **Podman** article, so that attribution is a contradiction/unconfirmed premise ([Better Stack result](https://betterstack.com/community/guides/scaling-docker/podman-vs-docker/), 2026-01-21).

**Compatibility and risks.** Compose and buildx are documented as working: Kiri manages a BuildKit container and supports Compose `up/down/build`, health checks, dependencies, multiple networks and named volumes ([Compose](https://docs.runkiri.com/docker/compose/), [builds](https://docs.runkiri.com/docker/builds/), checked 2026-11-15). The limitations are material for production-like workflows: only the local volume driver is supported, and unsupported mount types and the volume `size` option are explicitly listed ([storage](https://docs.runkiri.com/docker/storage/), 2026-11-15). Bind mounts use virtiofs; ordinary `/Users`, `/Volumes`, `/private`, `/tmp` and `/var/folders` paths are supported, but unusual absolute paths refer to the VM rather than the Mac. Kiri documents Linux-like permission behavior and some remaining edge cases rather than promising perfect Docker Desktop equivalence ([storage](https://docs.runkiri.com/docker/storage/), 2026-11-15). Apple-Silicon `linux/amd64` images use Rosetta, which must be installed; the VM itself uses Virtualization.framework ([FAQ](https://docs.runkiri.com/faq/), 2026-11-15).

There are real beta issues: an open report describes repeated VM crashes under Postgres/Playwright network load and failure to honor restart policies after a crash; proposed fixes were not yet review-clean at the report’s last update ([issue #50](https://github.com/libracoder/kiri/issues/50), updated 2026-11-10). Another open report found that deleted guest files could continue consuming host allocation in `data.img` until FITRIM/reclamation ([issue #123](https://github.com/libracoder/kiri/issues/123), 2026-11-10). Kiri’s own architecture/security documentation confirms the VM boundary and host-vsock design ([security](https://docs.runkiri.com/security/), checked 2026-11-15).

**Homebrew and privacy.** I found no official Homebrew formula or cask for this runtime as of 2026-11-15; the project’s development material describes Homebrew as a plan, while the official installation path is a signed/notarized DMG or install script ([development notes](https://github.com/libracoder/kiri/blob/main/docs/development.md), [install](https://docs.runkiri.com/install/), checked 2026-11-15). Kiri says it has **no analytics or usage telemetry**. It does contact update servers, registries, vulnerability-database services when used, and crash-report endpoints only when diagnostics are enabled/sent ([FAQ](https://docs.runkiri.com/faq/), [security](https://docs.runkiri.com/security/), checked 2026-11-15). Kiri Share is the exception requiring an account: sign-in is via GitHub, and the account holds links, reserved names and plan/usage data; normal local containers, Kubernetes and machines do not require sign-in ([Kiri Cloud](https://docs.runkiri.com/kiri-cloud/), checked 2026-11-15). Thus, a public share link creates a cloud-account/privacy dependency, but merely running Kiri locally does not.

**Recommendation for this Mac.** For rare, local Docker CLI use, Kiri is an interesting fast beta and its sleep behavior fits an infrequent workflow. Keep Colima available for workloads sensitive to bind-mount read speed, volume-driver coverage, crash recovery, or mature edge-case compatibility; do not switch solely on the vendor’s headline latency or infer battery savings that have not been measured.

