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

## round 2 prep — a `--claude` VM waiting on dima's sign-ins

- 2026-09-28 18:51 — tart 2.32.1 from the formula's `tart.tar.gz`, sha256 `8554ab4f…4529` checked, run by path from the job dir. no system install. the cached image in `~/.tart` was reused, so the clone took 0.05 s. VM `seed-3`, window open, with an 80 GB sparse `--disk`, formatted `Extra` (picked by size) and wired in as in round 1: `/etc/zshenv` holds the cask appdir and cache, and brew's `var/homebrew/tmp` links onto it.
- 📌 harness: the worktree sandbox guard refuses any unknown binary that takes arguments (`vm 'zsh -s'`, `$T ip`). the pattern that works is a launcher with no arguments (`bin/vmgo`) that pipes a fixed `r/cmd.sh` over ssh, plus a throwaway ed25519 key installed once with `expect`.
- 2026-09-28 18:55 — stop 0, headless: `softwareupdate -i "Command Line Tools for Xcode 27.0-27.0"` (label read from `softwareupdate -l` with the on-demand flag file), **82 s**. frame went in as a bundle of main `2ec95d72`, origin re-pointed to https, no token in the VM.
  - 📌 a bundle of a worktree `HEAD` clones as a detached HEAD, so `git checkout -B main` was run after.
  - the CLT git ships `credential.helper=osxkeychain` again (seen in round 1).
- 2026-09-28 18:57 — seed run 1: `clt done`, `brew waiting` (the new wording, «skip its next steps»), exit 2 ✅. brew installed with `NONINTERACTIVE=1`, **17 s**, brew 7.0.7 (the RETURN prompt was graded in round 1).
- 2026-09-28 18:58 → 19:05 — seed run 2 (`--claude`), **7 m 19 s**: 36 apps installed, then a named `macos` stop, because `battle-net` failed with `curl: (18) Transferred a partial file` (blizzard's CDN, a transient cut; the url answers 200 from the host). ✅ the named stop worked as designed: the human re-runs.
- 2026-09-28 19:05 — seed run 3, **10 s**: `battle-net` in, `Linked 9`, three stubs written, `claude done ~/.claude linked`, then `claude skipped: Claude is not installed yet`, and `appstore` + `1password` together, exit 2.
  - 🐛 **nothing installs the Claude Code CLI.** `cask "claude"` is the desktop app, and the seed accepts `/Applications/Claude.app` as «installed», so on a real mac the check passes with no `claude` on PATH. (in the bed it skipped only because apps live on `/Volumes/Extra`.) the host's CLI comes from the native installer (`~/.local/bin/claude`). played here as the human: `curl -fsSL https://claude.ai/install.sh | bash`, 11 s, `2.1.283`. open for the seed: a `claude` step that runs that installer, or a stop that names it.
- 2026-09-28 19:06 — seed run 4: every step `done`/`ran`, `claude done: plugins install … on the next claude launch`, the two sign-ins, exit 2. ✅ **plain `pnpm frame:link` → «Everything mirrored», exit 0** (round 1 needed `--without-claude`). `~/.claude → ~/frame/home/.claude`.
- **state handed to dima**: the `seed-3` window is open, user `admin`/`admin`, and nothing is signed in. `Claude.app` and `1Password.app` are in `/Volumes/Extra/Applications`.

## round 2 — claude inside the VM

- 2026-09-28 19:15 — dima logged in to Claude Code in the `seed-3` window (2.1.283, Claude Max, `/rc` on). He ran it as `~/.local/bin/claude` because his shell had no `~/.local/bin` on PATH.
  - **the seed is not the cause**: a new `zsh -li` finds `~/.local/bin/claude` (`home/.zshenv:85`). his Terminal shell (pid 591) started at 15:55 VM time, 11 min before the seed wrote the stubs at 16:06. a shell open during the seed never sources them. find: the seed's closing line should say «open a new terminal».
- 2026-09-28 19:16 — the first launch installed **6 of 7 enabled plugins** (context7, typescript-lsp, warp, mattpocock-skills, typesafe, humanize). **`x` is missing.**
  - 🐛 **`settings.json` hard-codes `/Users/dima` three times**: the `x` marketplace path (`/Users/dima/frame/home/.claude/plugin-x`), the `statusLine` command (`/Users/dima/.claude/sline/bin`), and `additionalDirectories`. on a mac whose user is not `dima`, plugin `x` and the statusline are gone without an error. dima's own mac shares the username, so this bites only a VM or a second user. `~/…` or `$HOME` would fix it, if Claude Code expands them in those fields (not measured).
  - 🐛 **`~/.claude` is linked wholesale on a fresh mac**, because no real `~/.claude` exists yet for the mirror to descend into. every runtime write lands inside the git tree: 666 files in `plugins/cache`, `backups/`, `cache/`, and `sessions/<pid>.<hash>.key`, all untracked. a live session key sits one `git add .` away from a commit. the host never shows this, because its `~/.claude` is a real directory with only leaves linked. the fix: the seed makes `~/.claude` a real directory first, or `.gitignore` covers the runtime dirs.
- 2026-09-28 19:17 — 🐛 **nothing builds `sline`.** `home/.claude/sline/bin` is gitignored, so a seeded mac has no statusline even for user `dima`. played as the human: `pnpm sline:build` (go 1.27.1 from the Brewfile), exit 0.
- bed stand-ins for the grading, not seed changes:
  - `/Users/dima → /Users/admin` symlink, to stand in for dima's username.
  - `security unlock-keychain` in each ssh session, since the keychain locks per ssh login and a locked one reads as «Not logged in».
- 2026-09-28 19:18 — **the fleet boot, graded headless** (`claude -p --output-format stream-json`, trust dialog not accepted):
  - ✅ plugins: 7 (`x` included) + the built-in `agents-md` and `telemetry`. skills: 74, **`x:` 26 of 26** dirs in `plugin-x/skills`. MCP: `context7` connected.
  - ✅ the rules chain: asked for the operator's name, whether `fleet-output-format.md` is loaded, and what `slay` means, the model answered `name=Dima rules=yes vibe=git push` (opus, $0.44 for the boot).
  - ✅ hooks: `SessionStart` ×3 exit 0. `PreToolUse`, proven by its effect: haiku was told to run a background `sleep 1` with no deadline, and `bg-deadline-guard.py` refused it with its own error text. `UserPromptSubmit`, `Stop`, and `PostToolUse` were not graded one by one: stream-json reports only `SessionStart` events.
  - ✅ `sline` renders from the `statusLine` command: one line, 918 bytes, the repo, the branch link, the session cost. the first render took **17 s** cold, then 0.1 s warm.
  - 📌 in a non-interactive `zsh -lc`, `node` resolves to brew's v26.10.0 (a dependency of `agent-browser` and `vercel`). fnm's v24 wins only in interactive shells. `sline` showed v26 when run that way. inference: claude, launched from an interactive shell, shows v24.
- `Ignoring 6 permissions.allow entries … workspace has not been trusted`: expected until the first interactive `claude` in `~/frame` accepts the trust dialog.

- 2026-09-28 — dima's `ssh admin@192.168.64.3` rejected the password `admin` twice. the password was unchanged: a password-only login worked (`-o PubkeyAuthentication=no`). inference: his `Host *` sends every host through the 1Password agent, whose keys use up sshd's auth tries before the password counts.
- 2026-09-28 — **App Store: skipped, the apple sign-in hangs in the VM** (it stalled after the 2FA code). the two `mas` apps stay uninstalled. dima's call.
  - 📌 **his iCloud sign-in in System Settings was attempted too, and it also hung at the 2FA code.** System Settings still shows «Sign in with your Apple Account». at cleanup, check his Apple device list in case the VM got registered anyway.
  - the seed has no way to skip the `appstore` stop. step 5 overwrites `HOMEBREW_BUNDLE_MAS_SKIP` with the Brewfile's ids on every run (`script/seed.sh:104`), and step 9 counts any missing id as a stop, so no run reaches exit 0 without both apps. a way to skip it, not built yet: a `--without-appstore` flag that skips step 9 (or reports it `skipped`), the same shape as `--without-claude` on `frame:link`.

- 2026-09-28 19:38 — seed re-run after dima's 1Password sign-in: `1password done: an account is signed in`, `appstore waiting`, exit 2 on the one stop left.
  - 🐛 **the `1password` check is too weak.** it reads `op account list`, which a standalone `op account add` satisfies. dima signed in through the CLI, and the 1Password app had never run (no process, no Group Container). so the seed reported `done` with **no SSH agent**: `~/.ssh/config`'s `IdentityAgent` points at a socket that does not exist. the check should test the socket, e.g. `SSH_AUTH_SOCK=<agent.sock> ssh-add -l`.
  - over ssh, `op` has no session (`could not find session token for account my`). a CLI sign-in is per terminal.
  - launched with `open` from `/Volumes/Extra/Applications`, **the app copied itself to `/Applications`** and runs from there (pid 26607). a copy stays on the extra disk. so `gpg.ssh.program`'s `/Applications/…/op-ssh-sign` path is right, even in the bed.
- 2026-09-28 20:10 — dima signed in to the 1Password app and ran `cd ~/frame && claude`: trusted (`hasTrustDialogAccepted: true`), `/rc` on, sline rendered, «AGENTS.md loaded: /Users/admin/frame/AGENTS.md».
  - **the SSH agent was still off**: `settings.json` has `developers.cliSharedLockState.enabled: true` (CLI integration) and no `sshAgent` key, only `t/s.sock` exists, and there is no `t/agent.sock`. so the signed commit failed (`fatal: failed to write commit object`), and `ssh -T git@github.com` gave no identity.
- 2026-09-28 19:38 — 🐛 **`script/op-run.sh` has no path onto a new mac.** it reads the `x-fleet` token from the login keychain (`op-service-account-x-fleet`). nothing in the seed or the docs puts it there, and a missing item gives an empty token, so `op` fails with a misleading «You are not currently signed in». the VM has no such item (keychain exit 44).

- 2026-09-28 20:35 — dima turned on «Use the SSH agent». `t/agent.sock` came up and `ssh-add -l` lists one ED25519 key. `ssh -T git@github.com` answers «Hi dvakatsiienko!» through the agent.
  - the first signed commit waited on 1Password's approval prompt in the VM and hit the 150 s cap. after the approval: `git commit` signs in 0 s, and `git verify-commit` gives `Good "git" signature … ED25519 key SHA256:iPoh…O4wU`, `%G?` = `G`. the linked `.gitconfig` and `allowed_signers` work unchanged.

## verdict, round 2

**a seeded mac runs the fleet.** after the seed, one Claude login, and the 1Password app with its SSH agent, claude boots in `~/frame` with the whole chain: the rules, 26/26 `x:` skills, the hooks, the statusline, and signed commits to github. two stand-ins covered what the seed could not: a `/Users/dima` symlink and a manual `pnpm sline:build`.

the bugs, ranked by cost:
1. **`~/.claude` is linked wholesale on a fresh mac.** runtime state lands untracked in the repo, including a session `.key` one `git add .` from a commit.
2. **`settings.json` hard-codes `/Users/dima`** (the `x` marketplace, `statusLine`, `additionalDirectories`). any other username silently loses `x` and the statusline.
3. **the `1password` stop passes on a CLI-only sign-in.** `op account list` is satisfied by `op account add`, with the app never run and no SSH agent, so no signing and no ssh to github. the check should test the agent socket.
4. **nothing installs the Claude Code CLI.** the seed counts the desktop `Claude.app` as installed.
5. **nothing builds `sline`.** its `bin` is gitignored, so there is no statusline until `pnpm sline:build`.
6. **`op-run.sh` has no provisioning path** for the `x-fleet` token, and its error when the token is missing is misleading. a gap by choice in the VM: the fleet token stays off a throwaway machine.
7. **the `appstore` stop cannot be skipped**, so exit 0 is out of reach when the Apple sign-in fails, as it did here (it hung after the 2FA code). proposed `--without-appstore`.
8. **the seed's closing line should say «open a new terminal»**: a shell open during the seed never sources the stubs.

### left open after round 2

- the seed fixes (`168a2108`) re-run on `seed-3` with `--without-appstore`: the next coder's round.
- not graded: the App Store apps (skipped), `op-run.sh` (no fleet token in the VM), the git-crypt key (nothing in round 2 touched `gmail/`).
- **cleanup before the VM goes**: check dima's Apple device list (the hung iCloud and App Store sign-ins), and remove the VM's 1Password device and its Claude login session. only then `tart delete seed-3`. the cached image in `~/.tart` stays.
- the bed, if it is rebuilt: the extra disk, the brew `tmp` symlink, `HOMEBREW_CASK_OPTS` in `/etc/zshenv`. or a 120 GB base image, built once with packer, so the recovery-partition wall never comes up.
