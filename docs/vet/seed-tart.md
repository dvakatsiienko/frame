---
dies-when: FRM-147 closes
---

# seed-tart — `script/seed.sh` on a fresh macOS VM

Ticket: [FRM-147](https://linear.app/x-com/issue/FRM-147)

**what:** round 1 — the seed run over ssh on a `tart` VM, an agent playing the human at every stop.
**bed:** tart 2.32.1, image `ghcr.io/cirruslabs/macos-tahoe-vanilla:latest`, user `admin`/`admin`.

## log

- 2026-09-28 16:40 — `brew install cirruslabs/cli/tart` fails on brew 7.0.7: the tap's formula calls `depends_on :macos` beside `depends_on macos:`, which brew now refuses. workaround: the formula's own `tart.tar.gz` (2.32.1), sha256 checked against the formula, run by path. softnet skipped, only `--net-softnet` needs it.
- 2026-09-28 16:47 — image pull starts; done 16:53 (5.5 min, `~/.tart` 52 GB).
- 2026-09-28 16:55 — VM `seed-1` up with its window, ip over `tart ip --wait`. measured fresh state: macOS 26.6.2, no CLT (`/usr/bin/git` is the shim), no brew, zsh. two ways the image is NOT a fresh mac: **passwordless sudo** is baked in (a human types a password at every `sudo`), and ssh is on.
- 2026-09-28 16:56 — root has **18 GB free** of 41 GB; the Brewfile needs more (host numbers: casks 12.6 GB, `/opt/homebrew` 3.3 GB, CLT 1.6 GB, plus the download cache). `tart set --disk-size 120` grows the disk, but the container cannot grow: the recovery partition sits after it, and macOS 26 refuses to erase it without SIP off (`deleteContainer`, `eraseVolume` and `addPartition` all fail). the fix for the bed: a second 80 GB sparse disk (`tart run --disk`), with `HOMEBREW_CASK_OPTS=--appdir=/Volumes/Extra/Applications` and `HOMEBREW_CACHE` on it, set in `/etc/zshenv` so the mirror's `.zprofile` never collides.
- 2026-09-28 16:58 — **stop 0, before the seed exists**: the human's first `git clone` hits the CLT shim (`xcode-select: note: No developer tools were found, requesting install`, exit 1) and a GUI dialog. the seed's own `clt` stop can never fire on this path: the clone already needed CLT. played headless with `softwareupdate -i "Command Line Tools for Xcode 27.0"`, 82 s.
- 2026-09-28 17:00 — clone over https with an app token, `37a0e694`. 📌 the CLT git ships `credential.helper=osxkeychain` and tried to save the token to the login keychain; it failed only because the keychain is locked over ssh (`failed to store: -25308`). a clone with a token passes `-c credential.helper=`. verified after: no token in git config, no `github.com` item in the keychain.
- 2026-09-28 17:00 — seed run 1: `clt done`, then `brew waiting — needs your hands: install Homebrew…`, exit 2. ✅ a named stop, as designed.
- 2026-09-28 17:11 → 17:24 — the brew installer, played as the human (password + RETURN). lost 12 min to the harness, not the seed: the RETURN prompt carries colour codes between its words (`Press ␛[1;39mRETURN␛[0m/…`), so an `expect` on `Press RETURN` never matched. the match is the plain tail «to continue or any other key». the install itself takes ~1 min.
- 📌 brew's closing «next steps» tell the human to append `brew shellenv` to `~/.zprofile`. a human who obeys creates a real file where the mirror links `home/.zprofile` (which already has the line), and the `link` step stops on it. the seed's `brew` stop should say «skip brew's next steps».
- 2026-09-28 17:24 — seed run 2: `brew`, `fnm`, `pnpm`, `node` (v24.21.0) done; `pnpm install` ran (386 packages) but printed **no `deps` status line**, since `act` prints only under `--dry-run`.
  - 🐛 **step 5 is a dry run**: the seed calls `pnpm macos:setup` without `apply`, and `macos-setup.ts` without `apply` changes nothing («Dry run. Run `pnpm macos:setup apply`»). no Brewfile, no defaults, no duti, and the seed still marched on. fixed: `pnpm macos:setup apply`.
  - `link` crashed with `EEXIST` on `~/.config`, and the seed answered with the «files in the way» stop. cause: **the harness, not the seed**. an earlier run backgrounded with a bare `&` survived on the VM side; both runs queued on brew's lock and reached `link` in the same second (all 8 links stamped `14:24:44`). still a seed defect in miniature: any non-zero `frame-link` exit, a crash included, is reported as «files in the way».
- 2026-09-28 17:26 → 17:34 — runs 3 and 4 hang on `Tapping lutzifer/tap`: brew clones over https, and the linked `~/.gitconfig` (`[url "git@github.com:"] insteadOf = https://github.com/`) turns it into `ssh git@github.com`, which sits forever at the host-key `yes/no` prompt. with 1Password not signed in (step 9) there is no key either. killing the ssh leaves git waiting on it; the bundle fails and the seed exits 1 with **no named stop**.
  - a clean first run dodges it (taps clone at step 5, `link` is step 6). it bites the first re-run after `link` while 1Password is still out: brew's auto-update fetches every tap over the rewritten url. here it bit because the run-2 race linked first.
  - tried in the seed: `GIT_CONFIG_GLOBAL=/dev/null` around step 5. **dead**: `/opt/homebrew/bin/brew` re-execs through `env -i` with an allowlist (`HOME`, `PATH`, `SSH_AUTH_SOCK`, `HOMEBREW_*`, proxies); nothing else reaches git. reverted.
  - the root fix is outside the seed: `pushInsteadOf` instead of `insteadOf` in `home/.gitconfig`. fetches stay https (public taps need no key), pushes still go over ssh with the 1Password key, which is what the comment above the block says it is for. dima's file, a find for him.
  - bed: the VM's `~/.gitconfig` link removed to restore the step-5 state of a clean run.
- 2026-09-28 17:34 — 🐛 **nothing writes the zsh stubs.** `manifest.ts` keeps `.zshenv` / `.zprofile` / `.zshrc` in `noLink` («sourced by a stub»), and the seed never made the stubs, so a seeded mac never loads frame's shell config (no `brew shellenv`, no fnm, no aliases). fixed: step 6 writes each missing stub with the host's exact text, reports one that already sources frame as `done`, and stops on a foreign file instead of overwriting it.
- 📌 after a reboot with the extra disk attached, the boot disk renumbered from `disk0` to `disk1`. a disk op in a VM picks its target by size, never by number.
