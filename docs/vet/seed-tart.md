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
- 2026-09-28 17:34 → 17:39 — run 5 reaches the last cask, then starves: root at 261 MB free. brew 7 stages every cask under `/opt/homebrew/var/homebrew/tmp/.caskroom` (12 GB here) and `HOMEBREW_CACHE` does not move that. a bed artefact: on a real mac it is one volume. the bed now symlinks that `tmp` to the extra disk.
  - 📌 for dima's own restore: the Brewfile's casks need ~13 GB of staging on top of the ~13 GB they install. a fresh mac with under ~35 GB free will not finish step 5.
- 2026-09-28 17:40 — `home/.gitconfig` from main (`cfa2365f`, `insteadOf` → `pushInsteadOf`, dima's yes via cclio) copied into the VM clone for grading.
- 2026-09-28 17:40 → 17:47 — run 6: every tap, formula and cask installs (36 apps), then **`mas` hangs**: `mas 7.0.0` sits in `sudo mas install --force <ids>` waiting on `storeuid` (the App Store sign-in UI), 0 % cpu; killed, brew retries with `mas get` and hangs the same way. the expected App Store stop, unnamed. `mas list` works signed out (exit 0, empty).
  - fixed: step 5 exports the Brewfile's `mas` ids as `HOMEBREW_BUNDLE_MAS_SKIP` (a `HOMEBREW_*` name, so it passes brew's env filter); a new `appstore` stop checks `mas list` and names the exact `mas install <ids>` to run after signing in. a failed step 5 is now a named `macos` stop, not a bare `exit 1`.
  - the VM window showed «The disk you attached was not readable» from boot (the blank extra disk before it was formatted). harmless; **Eject** would have unmounted the casks' volume mid-run.
- 2026-09-28 17:47 — run 7: start to end in ~9 s on the installed machine (idempotent), `link` 1, the three stubs written, stops at `appstore`. `duti` asks a GUI «keep using X?» per type (named by `macos-setup`); 4 UTIs report «does not conform to any UTI hierarchy» (`.go`, `.tsx`, `.toml`, iA `.md`) — inference: the bed, apps live on `/Volumes/Extra` and LaunchServices has not indexed them.
  - two end stops fired one per run, so the human needed two rounds. fixed: `appstore` and `1password` are collected and named together, then one `exit 2`.
- 2026-09-28 17:48 — **`pushInsteadOf` graded** (main `cfa2365f`): `~/.gitconfig` linked, 1Password signed out. `brew update --force` exit 0 in 3 s; a fresh `brew tap cirruslabs/cli` clones over https in 2 s. the same state hung forever in runs 3 and 4.
- 2026-09-28 17:49 — run 8: every step `done`/`ran`, `Everything mirrored`, both sign-ins named in one run, exit 2. `pnpm frame:link` exits 1 on `.claude/ missing` — by design, the seed defaults to `--without-claude`; `pnpm frame:link --without-claude` → «Everything mirrored», exit 0.
- 2026-09-28 17:51 → 18:04 — **the clean run**: VM `seed-2`, a fresh local clone of the cached image, the branch head (`514f0bc5`) from a bundle over a clean https clone of main (`-c credential.helper=`: no «failed to store», no keychain item).
  - stop 0: CLT, 1 m 40 s. stop 1 (`brew waiting`): the installer, 20 s.
  - one seed run, **7 m 41 s**: fnm, pnpm, node 24 via fnm, `pnpm install`, the whole Brewfile, `Linked 8`, three stubs written, then `appstore` + `1password` named together, exit 2. no stall, no hand on the keyboard. (brew 7 stages every cask first, then moves them silently for ~6 min at ~50 % cpu in a child `brew.rb` — a 3-min silence watcher fires falsely there.)
  - ✅ `pnpm frame:link --without-claude` → «Everything mirrored», exit 0. a new `zsh -li` in a bare env finds brew, node v24.21.0 and pnpm through the stubs. a re-run: 3 s, the same two stops.
  - not done by the agent: the two sign-ins need dima's Apple ID and 1Password account.
- 2026-09-28 18:05 → 18:09 — review (a hand standards pass; `mattpocock-skills:code-review` cannot run inside a fork, it spawns its own agents) + `coderabbit` (1 finding). fixed: a clone outside `~/frame` is a named stop (step 0); the stub check is an exact-line match; a failing `xcode-select --install` no longer kills the seed before its stop; the `link` stop names a crash too. each proven both ways on `seed-2`:
  - old code, clone at `/tmp/elsewhere`: the seed re-pointed all 8 `~` links at `/tmp`. new code: `clone waiting`, exit 2, `~` untouched.
  - old code, a commented-out `source` in `~/.zshrc`: `done`. new code: `zsh waiting`, then `done` once restored.
- 📌 a harness trap worth keeping: filtering ssh noise with `grep -v Password` also drops every line with «1Password» in it — the `1password` stop looked missing for three runs.
- 📌 after a reboot with the extra disk attached, the boot disk renumbered from `disk0` to `disk1`. a disk op in a VM picks its target by size, never by number.

## verdict, round 1

**the seed runs start to end on a fresh mac.** CLT, then brew, then one agent-driven run of ~8 min, ending at the two sign-ins that need dima's accounts. green by `pnpm frame:link --without-claude`.

still open, not the seed's to fix:
- **stop 0 sits before the seed**: a fresh mac cannot `git clone` without CLT. the entry doc says `xcode-select --install` first.
- the `clt` stop inside the seed only fires for a clone made some other way (a zip, a bundle).
- plain `pnpm frame:link` stays red on a default seed (`.claude/` missing). the green check is `--without-claude`, or seed with `--claude`.

## round 2 — claude inside the VM (not started)

- a claude login: dima signs in to Claude Code in the VM window (an OAuth browser round), or a scoped API key from 1password, never his main one.
- `--claude`: the seed links `~/.claude`; `settings.json` then installs the plugins on the first launch, which needs network to the marketplaces and the `plugin-x` path at `~/frame`.
- the git-crypt key, if round 2 touches `gmail/`; nothing else needs it.
- the bed as built here: the extra disk, the brew `tmp` symlink, `HOMEBREW_CASK_OPTS` in `/etc/zshenv`. or a 120 GB base image, built once with packer, so the recovery-partition wall never comes up.
