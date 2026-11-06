---
name: firelink
description: Load BEFORE any question about Dima's games — what he owns, played, earned or wishlisted on psn or steam (trophies, achievements, platinum, rarity, «what's left», «what to play next»), any item, quest, mechanic or tip question about a game he plays, a wiki, psnprofiles or guide page to read, or where a game's notes live — and before launching, updating, debugging or shelling into the steamac vm (FX Steam Launcher, SteamOS, proton, the rockstar launcher in it).
argument-hint: "<trophy-sys verb> [arg] | vm play | vm ssh [cmd] | vm update"
---

# firelink — every door into dima's games

four doors, one skill: **psn** and **steam** through trophy-sys, **game pages** (wikis, psnprofiles, guides) through the mac's fetch, and **steamac**, the vm that plays his windows steam games on the mac. § 4 maps where every other game piece lives.

**lane** — `cc`: Bash, the scripts below · `cloud-chat` desktop: the `x-cloud-chat__firelink_tracker` and `x-cloud-chat__firelink_steamac` mcp tools (the same scripts, read-only, no `snapshot`) · `cloud-chat` / project thread: the mac's desktop commander, `mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process` (the unprefixed one runs in the cloud vm, never count it).

`<base>` = `~/frame/home/.claude/plugin-x/skills/firelink`.

## 1. trophy-sys — psn + steam, the only truth

`~/projects/bytes/apps/trophy-sys`: psn through the unofficial `psn-api` (NPSSO), steam through the Steam Web API (key). call it BEFORE answering; never answer from memory, a note or a guide site. tracker down or mac unreachable → say so and stop.

```zsh
<base>/scripts/trophy-sys-cli.sh <verb> [arg] [--out <file>]   # clean json to a file, prints path + shape
```

parse the file with a short `python3`, never read it whole.

- psn: `profile` · `games` (whole library, takes no number) · `game <npCommId>` (full list, rarity %) · `news` (earned since the last baseline) · `stats` · `stats-sync` and `snapshot` write state: only on his explicit ask
- steam: `steam-profile` · `steam-games` · `steam-game <appid>` (achievements + global rarity %) · `steam-wishlist` (`priority: 0` = unset)
- mac build or windows-only, per game: `<base>/scripts/steam-platforms.py [--mac | --windows-only]` (store api, cached; first run ~15 min)

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

## 2. game pages — wikis, psnprofiles, guides

the cloud refuses psnprofiles, fandom, miraheze, wikipedia and steam; the mac reaches them:

```zsh
ls ~/.local/share/web-bot-blocked-fetch/<game>/   # cache first: a seed leaves the psnp guide and comments here
pnpm -C ~/frame --silent web-bot-blocked:fetch "<url>" --out ~/.local/share/web-bot-blocked-fetch/<game>/<name>.md   # then rg it
```

- 📌 the verb only: a raw `curl` through the mac is blocked as bot-check circumvention; `WebSearch` finds urls
- trophies: the psnprofiles guide and its comments first, powerpyx second, never powerpyx as his main read
- a mediawiki takes an article url; a search url or a missing title fails with «no wiki page», then `--index <wiki host>`
- a value, price or stat question reads the infobox (`== Infobox ==`), which the plain extract drops
- an answer no page states is an inference from absence, said as one
- cross-checks and measurements: [references/web-bot-blocked-fetch.md](references/web-bot-blocked-fetch.md)

## 3. steamac — windows steam games on the mac

`/Applications/FX Steam Launcher.app` ([fxgl/steamac](https://github.com/fxgl/steamac), on trial: a no-name open-source project, kept only if games run well): valve's arm64 SteamOS in a libkrun vm.

📌 **the vm starts only through `scripts/steamac-play.sh`, never the app or a bare `open`**: those skip the memory caps, which rebooted a 48 GB mac ([fxgl/steamac#50](https://github.com/fxgl/steamac/issues/50)). a running vm keeps the caps it started with.

- `scripts/steamac-play.sh` — launch with the caps the app can't save: gpu 10 GiB, `MESA_KK_COMPILE_THREADS=4`, control fifo `~/.local/share/steamac/control.fifo`; dima starts it from `~/Desktop/steam-fx-safe.app`, a Finder alias of `~/Applications/FX Steam (safe).app` — an applescript applet that runs this script (adhoc-signed: `codesign --force -s -` after an edit)
- `scripts/steamac-ssh.sh [cmd]` — shell into the vm, `steamos@127.0.0.1:2222`, key `~/.ssh/steamac_ed25519`; «connection refused» = vm off; first run `--install-key`
- `scripts/steamac-askpass.sh` — the SteamOS password from the keychain (`es.fxgam.steamac.guest-password`), for `--install-key` only; never echo it
- `scripts/steamac-update.sh` — swaps in the latest github release (sha256, gatekeeper, team-id `V25VKGTW55`), quits the vm first; settings and the disk stay
- `scripts/swap-watch.sh` — read-only mac swap / memory pressure every 5 s, for a stutter
- `scripts/steamac-trace.sh [seconds] [--perf]`, `scripts/steamac-stall.py` — a perf run's tracer and stall catcher: `references/steamac.md` § a perf run
- `~/Library/Application Support/es.fxgam.steamac/game-stats.json` — per-session fps (avg, p50, 1 % low), hitches/min, per appid: read it before calling a game «runs well»

### before any vm work — read [references/steamac.md](references/steamac.md)

it holds the probed vm (proton versions, paths, steamac's own config), what i can do over ssh, the tweak ladder for a game that won't run, and the rockstar launcher. the traps that bite before you open it:
- each game has its own proton prefix (`steamapps/compatdata/<appid>/pfx`): nothing is shared, a launcher or a sign-in included
- gaming mode hides any window steam did not start
- a launch stuck on «Running install script» = a vcredist waiting on an invisible dialog: end its two installer pids, named to dima first
- a remote path with spaces goes in as a script: `steamac-ssh.sh 'bash -s' < script.sh`
- a rockstar game signs in to whatever rockstar account steam is linked to, server-side; never «Resend code» in a loop
- a freeze is a first-time Metal shader compile until `MESA_KK_DEBUG=compiles` says otherwise

## 4. where every game piece lives

facts about a game go to its home below, never into this skill. until every game note moves into obsidian `games/`, check the notion and obsidian lines before saying «no notes».

- 🗂 claude project «stuff» files (`/mnt/project-files/`, cloud only, an rclone drive with no history) — `games/<game>/index.md` + topic files, `games/README.md`, `games/_finished/`, `tools/trophy-sys.md` (id cache), `games/_finished/_archive/<game>/doc/` (finished docs, one .md per tab); its local copy `~/projects/cw/stuff/psn-trophy-tracker-local.md`, last synced 2026-09-19
- 🧠 project memory (same project, `team/silo`) — his taste, queue, verdicts. cloud only
- 📄 claude docs `dima-<game>` — his pinned per-game doc, url in that game's `index.md`; `dima-games-inbox`
- 📓 notion `games` root (`31a63143-8240-808b-9a6f-e8d7e099ca48`, `ntn` through `~/frame/script/op-run.sh`, `x:notes`) — every game page sits under it, sub-pages included (builds, quests); list them: `ntn api v1/blocks/<root id>/children`
- 🪨 obsidian vault (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/`, `x:notes`; icloud last-writer-wins, writes on his ask) — `games/play next.md` (the owned-games pick list, the folder everything moves into), `sv/` stardew valley, `z_cotl/` cult of the lamb, `z_rim/` rimworld, `gear/console.md` (ps5 pro + dualsense edge); the `z_` prefix marks a finished game
- 🔥 `~/frame/firelink/` — what a side chore found: `runs/<game>.md` (vm tuning, numbers, open tries), routes and the rig in its `AGENTS.md`
- 🏆 trophy-sys code — `~/projects/bytes/apps/trophy-sys` (its `AGENTS.md` before any edit); research `~/frame/docs/research/npsso-renewal.md`, `trophy-sys-notes-store.md`
- 🌐 game pages — § 2; the cache `~/.local/share/web-bot-blocked-fetch/<game>/`
- 💾 local saves — `~/Library/Application Support/HelloGames` (nms mac), `~/Library/Application Support/Steam` (mac steam), `~/.local/share/Hinterland` (the long dark), `~/.local/share/StardewValley`
