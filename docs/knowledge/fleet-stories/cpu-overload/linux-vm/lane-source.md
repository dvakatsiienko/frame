# FRM-536 source lane: a Linux VM on Apple silicon for the Go suite

Lane: primary sources (Lima source at sha `76f8cc2b`, Lima docs, Apple docs, Ubuntu manifests, Go source) plus local files. Read 2026-11-09. Marks: **measured** (someone ran it), **reported** (stated, no run shown), **inference** (ours).

Local facts first:
- `frm536` keeps the template defaults: vz, 10 cpus, 8 GiB, a 100 GiB raw disk (5.4 GiB used), `~` mounted with `mountType: null`, so virtiofs, read-only by default. The first aarch64 image is the **server** variant, and `containerd.user: null` means rootless containerd gets installed. Sources: `/Users/dima/.lima/frm536/lima.yaml:12,113,117,131,185,268`; `/opt/homebrew/share/lima/templates/default.yaml:41-58,110,193` (Lima 2.2.1).
- First boot, from `/Users/dima/.lima/frm536/ha.stderr.log`, 2026-11-09: VZ running at 15:11:56, ssh up at 15:12:03, containerd installed by 15:12:19 (15 s), boot scripts done at 15:12:31. That is **36 s, measured**, and 15 s of it is containerd.
- Door 3: go 74–85 cpu-s against 235–242, sys 30 against 147, `git --version` 0.5 ms against 5.2 ms, vitest no win. **Measured**, 2026-11-09 (`/Users/dima/frame/docs/knowledge/fleet-stories/cpu-overload/doors-left.md:25-29`).

## 1. Prior art

- I found no published same-Mac fork/exec benchmark comparing macOS and a Linux guest. The nearest is [bitsnbites, OS primitives](https://www.bitsnbites.eu/benchmarking-os-primitives/): Linux about 10× faster at launching programs, but on different hardware. **Measured, not comparable.** Undated in the result «?». Our 0.5 against 5.2 ms looks like the only same-hardware number (door 3).
- [Mainardi, 2025-01-04](https://www.paolomainardi.com/posts/docker-performance-macos-2025/), M4 Pro: `npm install` with Lima vz + virtiofs takes 3.38 s natively and 8.99 s through a bind mount. That is 2.7×. OrbStack takes 4.22 s through a bind mount. **Measured**, 3 runs.
- [Rafalko, 2024-06-24](https://maks-rafalko.github.io/blog/2024-06-24/linux-windows-mac-performance): a PHP suite takes 5.5 s in OrbStack on an M3 Pro and 11.5 s on native Linux on an i7 laptop. **Measured, but different hardware**, so it doesn't isolate the OS.
- [Eclectic Light, 2024-01-22](https://eclecticlight.co/2024/01/22/why-does-virtualisation-run-some-code-far-slower-on-apple-silicon/): VM CPU work runs at 93–99 % of native. AMX-backed code like `vDSP_mmul` runs at about 50 %. A VM can't tell P cores from E cores, and host QoS doesn't reach the guest. **Measured.**
- Where it breaks: vz memory isn't given back to the host ([lima#2789](https://github.com/lima-vm/lima/issues/2789), open since 2024-10-23). Apple's `container` says the same: "only partial support for memory ballooning" ([technical-overview](https://github.com/apple/container/blob/main/docs/technical-overview.md), read 2026-11-09). [OrbStack benchmarks](https://docs.orbstack.dev/benchmarks) date from 2023-08 on an M1 Max, cover builds and power only, and have no spawn numbers. **Vendor.**

## 2. The distro

- Ubuntu 26.04 arm64 manifests, primary: [server 20260927](https://cloud-images.ubuntu.com/releases/resolute/release-20260927/ubuntu-26.04-server-cloudimg-arm64.manifest) has 675 packages; [minimal 20261002](https://cloud-images.ubuntu.com/minimal/releases/resolute/release-20261002/ubuntu-26.04-minimal-cloudimg-arm64.manifest) has 300. Minimal drops multipath-tools, fwupd, udisks2, packagekit, landscape-common, motd-news, open-vm-tools and **git**. Both still ship snapd, unattended-upgrades, cloud-init and apport. Both run kernel 7.0.
- Lima's template already lists the minimal variant (`lima.yaml`, images block). `--image-variant minimal` picks it (`limactl create --help`, 2.2.1).
- Disable in either image: snapd, unattended-upgrades/apt timers, apport. On server, also multipathd, fwupd, packagekit and motd-news. This is **inference** from the manifests. I found no measurement of their background CPU «?».
- Debian 13 genericcloud and Fedora 43 Cloud arm64 templates ship with Lima 2.2.1 (`/opt/homebrew/share/lima/templates/_images/`). Fork cost under Alpine/musl against glibc: no primary measurement found «?». Go's binary is static, but git under musl is untested «?».

## 3. VM settings on Lima/vz

- **Memory.** Lima attaches a `VZVirtioTraditionalMemoryBalloonDevice` ([vm_darwin.go:916](https://github.com/lima-vm/lima/blob/76f8cc2b5ef7d28b9bdf57455e7b833d32e1d092/pkg/driver/vz/vm_darwin.go#L916)) but never sets a target. Adaptive ballooning is still an open PR ([#4828](https://github.com/lima-vm/lima/pull/4828), 2026-04-10). Apple's doc says a lower `targetVirtualMachineMemorySize` only *asks* the guest, "If the guest doesn't comply, the physical memory size remains unchanged" ([Apple](https://developer.apple.com/documentation/virtualization/vzvirtiotraditionalmemoryballoondevice/targetvirtualmachinememorysize)). So 8 GiB, once touched, stays held. Size it to the peak, not more.
- **CPUs.** Default is min(4, host cores) (`default.yaml:40`). Whether 10 idle vCPUs cost the host anything: no primary found «?». VM threads compete with the host's 16 lanes (inference).
- **Disk.** Lima forces `DiskImageCachingModeCached` with fsync sync, citing ARM disk corruption ([vm_darwin.go:42-47](https://github.com/lima-vm/lima/blob/76f8cc2b5ef7d28b9bdf57455e7b833d32e1d092/pkg/driver/vz/vm_darwin.go#L42)). The format is `raw`, or `asif` on macOS 26+, one-way (`default.yaml:400-404`). No speed number for asif «?».
- **Driver and flags.** vz has been the default since Lima 1.0 on macOS 13.5+, and vmType can't be changed after create ([vmtype doc](https://lima-vm.io/docs/config/vmtype/), modified 2026-10-05). `nestedVirtualization` needs an M3+ and is off by default (`default.yaml:650-658`), so leave it off. Rosetta is off by default (`default.yaml:405-412`), so leave it off.
- **tmpfs /tmp.** Ubuntu moved /tmp to tmpfs at 50 % of RAM in the 24.10 cycle, per an [ubuntu-devel thread, 2025-05](https://lists.snapcraft.io/archives/ubuntu-devel/2025-May/043354.html) (reported; the 043353 page 404'd). Whether 26.04 cloud images keep that is unverified «?». Memory that tmpfs fills is not returned to the host (see the balloon point above).

## 4. Getting code in

- The default `~` virtiofs mount is read-only. The bind-mount penalty on Lima vz is 2.7× for npm (Mainardi, above, **measured**). That makes the VM's own disk the right home, which matches door 3.
- `git push` into a non-bare repo with `receive.denyCurrentBranch=updateInstead`: git's docs name this use, "developing inside a VM to test and fix code on different Operating Systems". It needs a clean worktree (`man git-config`, git 2.56.0, local). Only changed objects move, and the checkout is exactly a commit. This is the right fit for a commit gate (inference).
- **Trap, from the Go source:** the test cache keys files a test opens by **size + mtime**, and refuses files under 2 s old (`$GOROOT/src/cmd/go/internal/test/test.go:2090-2150`, go1.27.3). git checkout gives changed files fresh mtimes, so those tests rerun. `rsync -a` keeps mtimes. Build caching is content-hashed and unaffected ([cmd/go](https://pkg.go.dev/cmd/go#hdr-Build_and_test_caching)).
- [Mutagen](https://mutagen.io/documentation/synchronization) syncs on every change via watching, and its `one-way-replica` mode makes the VM an exact copy. That fits the dirty tree, not a commit (inference). Per-run cost for each method: none measured by anyone found «?».

## 5. Keeping it warm

- Go trims cache entries unused for 5 days and checks at most daily (`cache.go:349-350`, go1.27.3). A persistent `GOCACHE` therefore stays warm with daily use. `GOMODCACHE` defaults to `GOPATH/pkg/mod` ([cmd/go](https://pkg.go.dev/cmd/go)).
- Version match: `x/go/go.mod:3` says `go 1.27.3`. With the standard `GOTOOLCHAIN=auto`, an older guest Go downloads 1.27.3 by itself ([go.dev/doc/toolchain](https://go.dev/doc/toolchain)). A newer guest Go would not match the host «?».
- Boot: 36 s first boot, measured above. A warm restart wasn't measured «?». A third party reports Lima cold start to ssh at 4.6 s on an M3 ([dev.to](https://dev.to/michael_sun_18a5c4c96768d/utm-vs-orbstack-vs-lima-macos-vm-real-cold-start-disk-io-and-memory-numbers-on-m3-macbook-pro-4j6d), undated; it cites Lima 0.20.1 next to macOS 26.4, which doesn't fit, so treat it as **doubtful**).
- Health for weeks: Lima 2.2.1 has `snapshot`, `clone`, `factory-reset`, `protect` (`limactl --help`). Nobody I found reports a multi-week test-VM regime «?». Since memory isn't returned, a periodic restart is the known fix (Apple `container` doc, above).

## 6. Tools inside the VM

- `GOFLAGS` takes default `-flag=value` pairs, and the command line overrides them ([cmd/go](https://pkg.go.dev/cmd/go)). Only the flags in `go help test` keep results cacheable (`-run -short -v -timeout -parallel -cpu ...`; local `go help test`). Adding `-count=1` turns caching off.
- `--containerd none`, or `--plain`, skips the 15 s containerd install and its daemon (`limactl start --help`; log above). `--mount-none` drops the `~` share.
- A faster git build, a CPU governor, or a lighter init inside a vz guest: no primary source found «?». Whether a vz guest even exposes cpufreq is unknown «?».

## 7. Measuring a clean win

- Time sync + run together. Both caches matter: the Go test cache (mtime-keyed, above) and the page cache. Use [hyperfine](https://github.com/sharkdp/hyperfine) `--warmup` for a warm cache, or `--prepare 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches'` for a cold one (README, read 2026-11-09).
- Run with `-count=1`, or results come from the cache.
- Host load: door 3 ran at mac load 20–50, so its walls are noisy and its cpu-s are the firmer number.
- P/E core placement: QoS doesn't reach the guest (Eclectic Light, above), so vCPUs can land on E cores. Repeat each side at least 3 times, alternating sides (inference).
- Thermal: no primary source on throttling during A/B runs found «?».

## What we'd borrow (top 5)

1. **Code on the VM's own disk, pushed by `git push` with `updateInstead`.** Mount penalty 2.7× (Mainardi 2025, measured). Exact-commit copy (git-config doc). Our 3× win already depends on it (door 3, measured).
2. **A persistent instance with persistent `GOCACHE`/`GOMODCACHE`.** Kept by the 5-day trim (`cache.go:350`). Preserve mtimes, or the test cache misses (`test.go:2090`). Gain unmeasured «?».
3. **`--containerd none --mount-none` at create.** Saves 15 s of first boot, measured in our log, plus an idle daemon. Daemon CPU unmeasured.
4. **The minimal image, plus masking snapd, unattended-upgrades and apport.** 300 packages against 675 (manifests). Then install git. Background-CPU gain unmeasured «?».
5. **Memory sized to the measured peak, with a scheduled restart.** The vz balloon is never driven (Lima source, Apple doc, lima#2789). Reported, not measured here.

<!-- end -->
