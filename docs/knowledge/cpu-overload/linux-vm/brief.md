# research brief — a linux vm on an apple silicon mac to run a go test suite faster

wish: FRM-536

answer in english.

## context

a developer runs many parallel AI coding sessions on one Apple Silicon Mac (M-series, 14 cores, 48 GiB RAM, macOS). the sessions run test suites constantly. a Go test suite that spawns thousands of short child processes (git, its own binary) costs 235–242 cpu-seconds on macOS, 60 % of it kernel (sys) time. the same suite in a Linux VM on the same Mac (Lima 2.2, `vmType: vz`, 10 vCPUs, 8 GiB, Ubuntu 26.04 arm64 cloud image, the code copied onto the VM's own disk) costs 74–85 cpu-seconds and runs 3× faster in wall time; a `git --version` spawn costs 0.5 ms in the VM against 5.2 ms on macOS. a vitest (Node) suite showed no cpu win in the VM. we want to turn this into a dependable, clearly faster setup, not one blurred by bootstrap chores.

## vectors

1. prior art: who runs test suites or CI-like workloads in a Linux VM on Apple Silicon for speed, and what did they measure? (Lima, Colima, OrbStack, UTM, Tart, Apple's Containerization / `container` tool, Docker Desktop). where did it break? any published numbers on fork/exec or process spawn cost macOS vs Linux on the same hardware?
2. the distro: is a stock Ubuntu cloud image right for a throwaway test runner, or is there a better pick (Debian, Fedora, Alpine/musl and its fork cost, a minimal or container-optimised image, a newer kernel)? what in a stock image costs cpu in the background (snapd, unattended-upgrades, cloud-init, multipathd) and should be disabled?
3. vm settings on Lima/vz: cpus and memory sizing for a parallel Go test run (is 8 GiB right, does memory ballooning exist, does over-sizing cpus hurt the host?), vz vs qemu, disk format and caching, `nestedVirtualization`, rosetta off, tmpfs for /tmp and the Go build cache.
4. getting code in fast and right: rsync, mutagen, `git push` into a bare repo in the VM, git worktrees on the VM disk, virtiofs read-only mounts with an overlay, reverse-sshfs. the cost of each per run, and which keeps the VM's copy identical to a commit (for a commit gate) without a full copy each time.
5. keeping it warm: a persistent instance vs created per run; persistent `GOCACHE` / `GOMODCACHE`; boot time; keeping go/node versions matched to the host; how others keep such a VM healthy for weeks.
6. complementary tools worth installing inside the VM for test speed (a faster git build, `GOFLAGS`, a cpu governor, an init that stays out of the way).
7. how to measure a clean win: what to time (sync + run, not run alone), and the traps that make such A/Bs lie (host load, thermal throttling, page cache).

## output shape

per vector: the finding in 2–4 lines, each fact with its source link and a date; then a «what we'd borrow» list of the 5 settings or tools with the most expected gain, each with its source. flag anything reported but unmeasured. under 1,500 words.
