---
name: game-prep
description: load when dima picks a game to play next, or asks to seed, set up or prepare a game — the per-game mini-db in project files plus his dima-<game> claude doc, verified missables and a trophy route. uses game-research for the digging.
---

# game-prep — seed a game before he starts it

dima, 2026-11-02: «game-prep — everything you need to seed the initial data bank for a game. this includes your mini db, and my files (docs). request varies from game to game but overall shape is outlined in a skill.» the model runs: cloudpunk and spiritfarer, 2 Nov 2026; nms, 16 Oct 2026.

📌 the one rule behind all of it: **everything he relies on is verified**. beyond: two souls cost him a full replay from a missed run-shaped requirement.

## 0. boot

- mac link first (`connect_device` if the desktop commander's `start_process` is missing, end the turn)
- the tracker through `firelink`: does he own it, on which platform, ps4 vs ps5 list. a never-launched psn game shows only a `CUSA` id and has no trophy list in the tracker yet: say so
- `grep -ril "<game>" /mnt/project-files/games/`: a folder may already exist from research

## 1. the trophy truth

- **psnprofiles guide first**, fetched on the mac: `pnpm -C ~/frame --silent web-bot-blocked:fetch "<psnp guide url>" --out ~/.local/share/web-bot-blocked-fetch/<game>/psnp-guide.md` (1 firecrawl credit). find the url with `WebSearch site:psnprofiles.com/guide <game>`
- read the guide's **comments** too: missable corrections surface there
- **powerpyx second** for gaps and a cross-check; platget or truetrophies only when both lack it. no powerpyx guide → say so, don't guess a url
- several trophy lists (ps4 + ps5) → name both, say which one he'll earn
- **every missable checked against two sources.** a disagreement goes in the doc as a 📌 callout naming both sides, playing it safe

## 2. size it — propose, he confirms in a word

- **S, short or linear**: my side `index.md` + `trophies.md` (+ `tips.md` if earned); his doc is a 🚀 main tab + 🏆 trophies tab + 📬 q&a
- **L, sandbox or long**: add `platform.md`, `mechanics.md` / `economy.md`; his doc grows a tab per topic
- the full shapes: memory `game-seed-framework`, `games-db-layout`

## 3. my side — `/mnt/project-files/games/<full-kebab-name>/`

- `index.md` with its fixed sections (▶ next, 🪪 identity incl. doc url + native platform, 📂 files, 🔧 gotchas, ❓ open, 📜 log)
- `trophies.md`: the whole guide parsed, the cross-check, every disagreement, sources at the end
- facts carry their source; unverified lines say so

## 4. his side — the doc `dima-<full-game-name>`

- one claude doc, tabs: **🚀 main** (run-shaped stuff and settings to pick at new game on top, then missables in the order he meets them, then tips), **🏆 trophies** (progression order: when in the run each one pops, grindy and missable first), **📬 q&a**
- layout: memory `doc-format` (emoji lines without bullets, `---` between sections, bold key items, caveats in `>` callouts, sources and claude notes at the end only, no tables). read-aloud: no inline dates or links
- remind him once to switch the doc to serif
- one playthrough, always: batch trophies, never plan a replay a single run can carry

## 5. hand-off

- memory `games-queue-now`: the pick, its platform, the doc url
- the reply (or the new 🎮 thread's opener, named per `threads-setup`): link + attach his doc and `dima-games-inbox`, then a short pre-start brief — run-shaped requirements, the missables and where they are, settings to pick, a few tips. under 80 words if he's away
