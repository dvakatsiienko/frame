---
name: game-prep
description: load when dima picks his next game, or says «seed», «set up», «prep» or «start» a game — before writing its project files or his dima-<game> doc.
---

# game-prep — seed a game before he presses start

the rules behind each step: memory `game-seed-framework`, `trophy-sources`, `games-db-layout`, `doc-format`, `thread-opener`. this skill is the order.

📌 every missable and run-shaped requirement is verified by two sources before it reaches his doc; a miss costs him a full replay.

## 1. boot

- mac link first (`connect_device` if `start_process` is missing, end the turn)
- `firelink` tracker: owned, platform, ps4 vs ps5 list. a never-launched psn game is a bare `CUSA` id with no trophy list yet
- `grep -ril "<game>" /mnt/project-files/games/`: research may already exist

## 2. the trophy truth

- psnprofiles guide through the mac fetch, comments included (corrections surface there); find it with `WebSearch site:psnprofiles.com/guide <game>`
- powerpyx for gaps; no guide there → say so, never guess a url
- two trophy lists (ps4 + ps5) → name both and which one he earns
- a disagreement → a 📌 callout naming both sides, the safe play first

## 3. size — propose S or L, he confirms in a word

- S: `index.md` + `trophies.md`; his doc = 🚀 main + 🏆 trophies + 📬 q&a
- L: adds `platform.md`, `mechanics.md` or `economy.md`; a doc tab per topic

## 4. files

- mine: `/mnt/project-files/games/<full-kebab-name>/index.md` (fixed sections), `trophies.md` with the whole guide, the cross-check and sources
- his doc `dima-<full-game-name>`, one doc in tabs:
  - 🚀 main: run-shaped requirements and new-game settings first, then missables in the order he meets them, then tips
  - 🏆 trophies: progression order, grindy and missable first
  - 📬 q&a
- one playthrough: batch trophies, never plan a replay a single run carries
- remind him once to switch the doc to serif

## 5. hand-off

- memory `games-queue-now`: the pick, platform, doc url
- the reply or the 🎮 thread opener (memory `threads-setup`): his doc + `dima-games-inbox` linked and attached, then a short pre-start brief
