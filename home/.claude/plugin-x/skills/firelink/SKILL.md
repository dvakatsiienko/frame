---
name: firelink
description: Load BEFORE any question about what Dima owns, played, earned or wishlisted on psn or steam (trophies, achievements, platinum, rarity, «what's left», «what to play next»), and before launching, updating or shelling into the steamac vm (FX Steam Launcher) that runs his steam library on the mac.
argument-hint: "<trophy-sys verb> [arg] | vm play | vm ssh [cmd] | vm update"
---

# firelink — the hub: his psn + steam libraries, and the vm that plays steam on the mac

**lane** — `cloud-chat` desktop: the `x-cloud-chat__firelink_tracker` and `x-cloud-chat__firelink_steamac` mcp tools (same scripts, read-only) · `cloud-chat` / project thread: the mac's desktop commander, `mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process` (the unprefixed desktop-commander runs in the cloud vm, never count it) · `cc`: Bash.

`<base>` below = `~/frame/home/.claude/plugin-x/skills/firelink`.

## 1. trophy-sys — the only truth for libraries and trophies

`/Users/dima/projects/bytes/apps/trophy-sys`: psn via unofficial `psn-api` (NPSSO), steam via the Steam Web API (key). call it BEFORE answering; never answer from memory, a project file or a guide. tracker down or mac unreachable → say so and stop.

```zsh
<base>/scripts/trophy-sys-cli.sh <verb> [arg] [--out <file>]   # writes clean json, prints path + shape
```

it wraps `source ~/.zshrc; node --env-file=.env --env-file-if-exists=.env.local src/server/cli.ts <verb>` and strips the preamble (fnm's «v24.0.2 not installed» line is noise). parse the file with a short `python3`, never read it whole.

### verbs

- psn: `profile` · `games` (whole library, no number) · `game <npCommId>` (full list, rarity %) · `news` · `stats` · `snapshot` (commits a baseline — only on his explicit ask)
- steam: `steam-profile` · `steam-games` · `steam-game <appid>` (achievements + global rarity %) · `steam-wishlist`

### shapes and quirks that bit before

- `games` and `steam-games` are BARE ARRAYS; `game` is one object (`groups`, `trophies` with `earned`, `grade`, `rarity`, `group`, counter `progress {current, target}`)
- `playSeconds` / `lastPlayedAt` can be null → guard. steam playtime is already seconds. 0.0 h + a lastPlayedAt = one launch created the list
- `progress` = base + dlc, NOT a platinum flag (cult of the lamb: 89 % with platinum earned) → read the platinum trophy's `earned`; base game → `group == "default"`
- a psn title gets an npCommId only after its first launch; owned ≠ listed
- cross-gen = two npCommIds (elden ring `NPWR25264_00` ps4, `NPWR25067_00` ps5) → disambiguate by platform, never merge
- psn and steam share no ids → match by name, name the platform of every number
- steam has no platinum; psn has no wishlist api (`steam-wishlist` only)
- an error naming «Game details» privacy = a steam setting flipped, not an empty library (`steam-profile` → `visibility` 3 = public)
- never guess an id; never pass `pnpm -s` (pnpm 12 removed it, no json)
- secrets: `.env` holds NPSSO, `STEAM_API_KEY`, `STEAM_ID64` — never ask for, never print
- full manual + id cache (project side): `/mnt/project-files/tools/trophy-sys.md`

## 2. steamac — steam on the mac, in a vm

`/Applications/FX Steam Launcher.app` ([fxgl/steamac](https://github.com/fxgl/steamac)): valve's arm64 SteamOS (the Steam Frame image) in a libkrun vm. chain: game dx9–11 → DXVK (Proton, x86 via FEX) → Venus → MoltenVK or KosmicKrisp → Metal. this is how windows-only steam games (gta iv, 2026-11-01) run with no pc.

- `scripts/steamac-play.sh` — launch with the caps the app can't save (fxgl/steamac#50): gpu 10 GiB, `MESA_KK_COMPILE_THREADS=4`, control fifo `~/.local/share/steamac/control.fifo` (a live pipe, stays there)
- `~/Applications/FX Steam (safe).app` — his dock launcher: an applescript applet that runs `scripts/steamac-play.sh` (repointed 2026-11-02 when the scripts moved here; adhoc-signed, re-sign with `codesign --force -s -` after any edit)
- `scripts/steamac-ssh.sh [cmd]` — shell into the vm: `steamos@127.0.0.1:2222`, key `~/.ssh/steamac_ed25519`; only while the vm runs («connection refused» = vm off). first run: `--install-key`
- `scripts/steamac-askpass.sh` — prints the SteamOS user password from the keychain (`es.fxgam.steamac.guest-password`); used by `--install-key`, never echo its output into a chat
- `scripts/steamac-update.sh` — swaps the app for the latest github release: sha256 + gatekeeper + team-id `V25VKGTW55` checks, quits the vm first, trashes the old app. settings and the SteamOS disk in `~/Library` stay
- `scripts/swap-watch.sh` — read-only, mac swap / memory pressure every 5 s; run it when a game stutters

inside the vm: steam library `~/.local/share/Steam/steamapps/common/`, manifests `appmanifest_<appid>.acf`. windows mods (asi loaders like gta iv's FusionFix) usually need the steam launch option `WINEDLLOVERRIDES="dinput8=n,b" %command%` (🔎 general proton practice, not yet tested in this vm).

- `~/Library/Application Support/es.fxgam.steamac/` — `steamos.img` (sparse ~150 GiB disk, 110 GiB used) and `game-stats.json`: the launcher's per-session report per appid (fps avg / p50 / 1 % low, hitches/min, driver, proton, memory). read it before calling a game «runs well» — gta iv 2026-11-01: p50 60, avg 47, low 15, 65 hitches/min; tested fine: against the storm, manor lords, system shock, noita, dwarf fortress; satisfactory p50 20

## 3. where every game piece lives — the map

facts about a game go in its place below, never in this skill.

- 🗂 project files (claude.ai project «stuff», `/mnt/project-files/`, an rclone drive, no history) — `games/<game>/index.md` + topic files, `games/README.md` (the layout), `games/_finished/`, `tools/trophy-sys.md` (manual + id cache), `tools/web-bot-blocked-fetch.md`
- 🧠 project memory (same project, `team/silo`) — his taste, queue, verdicts, thread rules. cloud only
- 📄 claude docs `dima-<game>` — his pinned per-game doc, url in that game's `index.md`; `dima-games-inbox`
- 📓 notion `games` root (`31a63143-8240-808b-9a6f-e8d7e099ca48`, `ntn` via `~/frame/script/op-run.sh`, `x:notes`) — one child page per game (rogue legacy 2, life is strange remastered, bg1ee, bg2ee, alters, factorio, elden ring, dark souls 1 + 3, nioh, dave the diver, game dev tycoon, ios). the play-next list moved to obsidian 2026-11-02
- 🪨 obsidian vault (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/`, `x:notes` hazards: icloud last-writer-wins, writes on his ask) — `games/play next.md` (the owned-games pick list), `sv/` stardew valley, `z_cotl/` cult of the lamb, `z_rim/` rimworld, `gear/console.md` (ps5 pro + dualsense edge)
- 🏆 trophy-sys code — `~/projects/bytes/apps/trophy-sys` (skills `trophy-sys-run`, `trophy-sys-verify`); research `~/frame/docs/research/npsso-renewal.md` (BYT-85: NPSSO lives ~60 days, a new browser sign-in renews it), `trophy-sys-notes-store.md` (BYT-102)
- 🌐 page cache — `~/.local/share/web-bot-blocked-fetch/<game>/` (psnprofiles, wiki dumps)
- 💾 local saves — `~/Library/Application Support/HelloGames` (nms mac build), `~/Library/Application Support/Steam` (mac steam), `~/.local/share/Hinterland` (the long dark), `~/.local/share/StardewValley`
