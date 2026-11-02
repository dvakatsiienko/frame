---
name: firelink
description: Load BEFORE any question about Dima's games — what he owns, played, earned or wishlisted on psn or steam (trophies, achievements, platinum, rarity, «what's left», «what to play next») — and before launching, updating, debugging or shelling into the steamac vm (FX Steam Launcher, SteamOS, proton, the rockstar launcher in it).
argument-hint: "<trophy-sys verb> [arg] | vm play | vm ssh [cmd] | vm update"
---

# firelink — every door into dima's games

three doors, one skill: **psn** and **steam** through trophy-sys (the truth for libraries and trophies), and **steamac**, the vm that plays his windows steam games on the mac. § 3 maps where every other game piece lives.

**lane** — `cc`: Bash, the scripts below · `cloud-chat` desktop: the `x-cloud-chat__firelink_tracker` and `x-cloud-chat__firelink_steamac` mcp tools (the same scripts, read-only, no `snapshot`) · `cloud-chat` / project thread: the mac's desktop commander, `mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process` (the unprefixed one runs in the cloud vm, never count it).

`<base>` = `~/frame/home/.claude/plugin-x/skills/firelink`.

## 1. trophy-sys — psn + steam, the only truth

`~/projects/bytes/apps/trophy-sys`: psn through the unofficial `psn-api` (NPSSO), steam through the Steam Web API (key); its web app is [trophy-sys.vercel.app](https://trophy-sys.vercel.app). call it BEFORE answering; never answer from memory, a note or a guide site. tracker down or mac unreachable → say so and stop.

```zsh
<base>/scripts/trophy-sys-cli.sh <verb> [arg] [--out <file>]   # clean json to a file, prints path + shape
```

parse the file with a short `python3`, never read it whole (`games` is ~260 rows, `steam-games` ~340).

- psn: `profile` · `games` (whole library, takes no number) · `game <npCommId>` (full list, rarity %) · `news` (earned since the last baseline) · `stats` · `stats-sync` and `snapshot` write state: only on his explicit ask
- steam: `steam-profile` · `steam-games` · `steam-game <appid>` (achievements + global rarity %) · `steam-wishlist` (`priority: 0` = unset)

### gotchas that bit

- `games` and `steam-games` are BARE ARRAYS; `game` is one object (`groups`, `trophies` with `earned`, `grade`, `rarity`, `group`, counter `progress {current, target}`)
- `progress` = base + dlc, never a platinum flag (cult of the lamb: 89 % with the platinum earned) → read the platinum trophy's `earned`; base game → `group == "default"`
- `playSeconds` / `lastPlayedAt` can be null → guard; steam playtime is already seconds
- a psn title gets an npCommId only after its first launch: owned ≠ listed; cross-gen = two npCommIds (elden ring `NPWR25264_00` ps4, `NPWR25067_00` ps5) → disambiguate by platform
- psn and steam share no ids → match by name, name the platform of every number; steam has no platinum, psn has no wishlist api
- a «Game details» privacy error, or an empty steam answer = a steam privacy setting flipped, never an empty library (`steam-profile` → `visibility` 3 = public)
- psn verbs failing auth = the NPSSO expired (it lives ~60 days); a new one comes from a fresh sony sign-in in a browser, then `.env`: [npsso-renewal](~/frame/docs/research/npsso-renewal.md), BYT-85
- never guess an id: read it from `games` / `steam-games`; never `pnpm -s` (pnpm 12 removed it, no json)
- secrets: `.env` holds `NPSSO`, `STEAM_API_KEY`, `STEAM_ID64` — never ask for, never print

## 2. steamac — windows steam games on the mac

`/Applications/FX Steam Launcher.app` ([fxgl/steamac](https://github.com/fxgl/steamac), on trial: a no-name open-source project, kept only if games run well): valve's arm64 SteamOS in a libkrun vm. chain: game dx9–11 → DXVK (Proton, x86 via FEX) → Venus → MoltenVK or KosmicKrisp → Metal.

- `scripts/steamac-play.sh` — launch with the caps the app can't save ([fxgl/steamac#50](https://github.com/fxgl/steamac/issues/50)): gpu 10 GiB, `MESA_KK_COMPILE_THREADS=4`, control fifo `~/.local/share/steamac/control.fifo`; `~/Applications/FX Steam (safe).app` is his dock applet running it (adhoc-signed: `codesign --force -s -` after an edit)
- `scripts/steamac-ssh.sh [cmd]` — shell into the vm, `steamos@127.0.0.1:2222`, key `~/.ssh/steamac_ed25519`; «connection refused» = vm off; first run `--install-key`
- `scripts/steamac-askpass.sh` — the SteamOS password from the keychain (`es.fxgam.steamac.guest-password`), for `--install-key` only; never echo it
- `scripts/steamac-update.sh` — swaps in the latest github release (sha256, gatekeeper, team-id `V25VKGTW55`), quits the vm first; settings and the disk stay
- `scripts/swap-watch.sh` — read-only mac swap / memory pressure every 5 s, for a stutter
- `~/Library/Application Support/es.fxgam.steamac/game-stats.json` — per-session fps (avg, p50, 1 % low), hitches/min, per appid: read it before calling a game «runs well»

### inside the vm

- library `~/.local/share/Steam/steamapps/common/`, manifests `appmanifest_<appid>.acf`; each game has its own proton prefix `steamapps/compatdata/<appid>/pfx` — nothing (a launcher, a sign-in) is shared between games
- disk: `/home` is ~127 GB and runs near full; `df -h ~` before a big download
- a remote command whose path has spaces goes in as a script on stdin: `steamac-ssh.sh 'bash -s' < script.sh`; inline quoting breaks
- the session is gamescope gaming mode: a window steam did not start stays invisible; desktop mode is Steam → Power → Switch to Desktop (restarts the session, pauses downloads)
- a first launch stuck on «Running install script» (a vcredist under proton): the installer waits on an invisible dialog — `ps` shows `vcredist_x86.exe` / `msiexec` at 0 cpu; end those two pids (name them to dima first) and the game starts; proton ships the runtimes anyway
- windows mods with an asi loader usually need the launch option `WINEDLLOVERRIDES="dinput8=n,b" %command%` (general proton practice, untested here)

### rockstar games in the vm

- a rockstar title starts the Rockstar Games Launcher in steam mode (`-steamAppId`): it signs in to the Rockstar account linked to his steam account on rockstar's server; no local reset changes that, and every game's fresh launcher lands on the same account
- the steam link is not on rockstargames.com's Connections page: it forms only in the launcher, and unlinks only through rockstar support, asked from the linked account
- «Verify your email» codes count against a quota: never press «Resend code» in a loop; «too many emails» locks the address for hours
- bully, max payne 1–2 and the old gta trilogy run without the launcher
- the live case (gta iv on a typo email, 2026-11): pocket PK-298

## 3. where every game piece lives

facts about a game go to its home below, never into this skill.

- 🗂 claude project «stuff» files (`/mnt/project-files/`, cloud only, an rclone drive with no history) — `games/<game>/index.md` + topic files, `games/README.md`, `games/_finished/`, `tools/trophy-sys.md` (the manual and the npCommId / appid cache); its local copy `~/projects/cw/stuff/psn-trophy-tracker-local.md`, last synced 2026-09-19
- 🧠 project memory (same project, `team/silo`) — his taste, queue, verdicts. cloud only
- 📄 claude docs `dima-<game>` — his pinned per-game doc, url in that game's `index.md`; `dima-games-inbox`
- 📓 notion `games` root (`31a63143-8240-808b-9a6f-e8d7e099ca48`, `ntn` through `~/frame/script/op-run.sh`, `x:notes`) — one child page per game
- 🪨 obsidian vault (`x:notes`; icloud last-writer-wins, writes on his ask) — `games/play next.md` (the owned-games pick list), `sv/` stardew valley, `z_cotl/` cult of the lamb, `z_rim/` rimworld, `gear/console.md` (ps5 pro + dualsense edge)
- 🏆 trophy-sys code — `~/projects/bytes/apps/trophy-sys` (its `AGENTS.md` before any edit); research `~/frame/docs/research/npsso-renewal.md`, `trophy-sys-notes-store.md`
- 🌐 page cache — `~/.local/share/web-bot-blocked-fetch/<game>/` (psnprofiles, wiki dumps)
- 💾 local saves — `~/Library/Application Support/HelloGames` (nms mac), `~/Library/Application Support/Steam` (mac steam), `~/.local/share/Hinterland` (the long dark), `~/.local/share/StardewValley`
