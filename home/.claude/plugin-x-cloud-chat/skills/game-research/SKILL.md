---
name: game-research
description: load BEFORE any research about a game or games, just for info — a game's state, patches, roadmap, 60fps or a remaster, platform pick, mods, trophy-guide sites, «what should i play next» candidates. not for seeding a game (game-prep) or finishing one (game-archive).
---

# game-research — wide or deep, for info only

dima, 2026-11-02: «i will occasionally raise similar researches when i go look for a new game.» the model run: the 🔍 games inbox thread of 2 Nov 2026 (terraria/factorio/rimworld state, six calm picks, trophy-guide sites, rdr2 60fps).

the project's memory and `/mnt/project-files/games/README.md` hold the detail; this skill is the order.

## 0. before any search

- **mac first.** the mac's desktop commander (`mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process`) carries the research lanes, the blocked-page fetch and the tracker. no link → `connect_device`, end the turn; research after the link
- **search what we have**: `grep -ril "<game>" /mnt/project-files/games/` and the memory index. a fresh enough file → answer from it, say its date
- **ownership and live numbers come from the tracker** (`firelink`), never from memory or a guide

## 1. pick the depth

- **one fact** (a release date, a price) → `WebSearch` standard, one confirming page
- **a state question** (patch plans, mod ecosystem, why a studio holds an update) → `WebSearch` extended + read the primary pages with `WebFetch`
- **wide or multi-game** → the research lanes on the mac (`x-cloud-chat:research`, the detached `nohup pnpm --silent research:lanes` form), brief + out under `~/.local/share/research-lanes/games/<date>-<slug>/`
- **bot-blocked pages** (psnprofiles, wikis, platprices) → `pnpm -C ~/frame --silent web-bot-blocked:fetch "<url>" --out <file>` on the mac

## 2. how to judge what comes back

- **official vs insider vs rumour**, every claim labelled. an aggregator page that says «official» with no studio post behind it is a rumour (rdr2: a «4K/60 patch» article had no source and was left out)
- **mods and jailbreaks are not options for him** on console: name them as proof the hardware can, never as a path
- **trophy facts**: psnprofiles first, powerpyx second (memory `trophy-sources`); name every disagreement
- **every game named gets its native platform** and which versions are ports (memory `native-platform-rule`)
- a «why hasn't X happened» question gets the reasons ranked, technical vs business, each marked fact or inference
- numbers he'll quote (sales, dates, versions) get one confirming page; otherwise mark them 🔎

## 3. what-next research (he's picking a new game)

- pull both libraries through `firelink` first; recommend from what he owns unless he asks for buys
- **switch genre AND setting** from the game he just finished (dima, 2026-11-02, a rule now). flag any candidate that shares the setting
- **standing games first**: memory `games-taste-queue` § standing games (rdr2 at 60fps). one that has landed jumps the queue
- calm ask → no game that needs a wiki open; flag 30fps console builds; flag restriction trophies
- his list is obsidian `games/play next.md`: add or reorder only, never delete

## 4. the output

- a **read-aloud file**: `/mnt/project-files/games/_research/<topic>-<yyyy-mm-dd>.md` for multi-game or meta topics, or the game's own folder for one game (at least an `index.md` for a game he's only considering)
  - the verdict in the first paragraph, sections of short plain sentences, no inline dates or links, dates as words
  - `## sources` at the end as spoken names; a closing `<!-- claude notes -->` comment for what's unverified, where lanes split and what was left out
- a **game folder `index.md` line** for each game touched: state on today's date, ▶ next (what to watch for)
- **memory**: a new verdict, wish or standing game → `games-taste-queue` / `games-library-verdicts`, dated, his words
- **the reply**: verdict first, three to five bullets on the reasons, the file attached and linked. no md tables
