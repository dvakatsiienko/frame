---
name: game-research
description: load BEFORE researching a game or games for info — «research», «what's the state of», «is there a patch», «60fps», «remaster», «which platform», «mods», «what should i play next», a trophy-guide site to vet. a game he just picked goes to game-seed, a finished one to game-finish.
---

# game-research — dig, verify, file it read-aloud

his rules live in project memory; this skill is the order. read the leaves it names, never restate them from here.

## 1. before any search

- mac link first: the `mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process` tool; missing → `connect_device` and end the turn (memory `thread-opener`)
- `grep -ril "<game>" /mnt/project-files/games/` and the memory index; a fresh file answers, with its date
- owned, played, earned → `firelink` tracker only

## 2. depth

- one fact → `WebSearch` standard, one confirming page
- a state or «why» question → `WebSearch` extended, then `WebFetch` the primary pages
- wide or several games → `x-cloud-chat:research` lanes, launched detached on the mac, under `~/.local/share/research-lanes/games/<date>-<slug>/`
- bot-blocked page (psnprofiles, wikis) → `pnpm -C ~/frame --silent web-bot-blocked:fetch "<url>" --out <file>` on the mac (memory `web-bot-blocked-fetch`)

## 3. judging what comes back

- label each claim official, insider or rumour; an «official» article with no studio post behind it is a rumour
- console mods and jailbreaks prove the hardware can; they are never his path
- trophies → memory `trophy-sources`; every game named → memory `native-platform-rule`
- a «why hasn't X happened» answer ranks the reasons and marks each fact or inference
- a number he will repeat (sales, date, version) gets one confirming page, else 🔎

## 4. what-next variant

- both libraries through `firelink` first, then memory `games-taste-queue`: standing games, the genre-and-setting switch, the complex-game slot
- his list: obsidian `games/play next.md`, add or reorder only

## 5. output

- a file: `/mnt/project-files/games/_research/<topic>-<yyyy-mm-dd>.md`, or the game's folder for one game (an `index.md` at least)
  - read-aloud shape (memory `read-aloud`): verdict first, plain sentences, `## sources` at the end, a closing `<!-- claude notes -->` for what's unverified and what was left out
- each game touched: its `index.md` gets today's state and ▶ next
- a verdict or wish of his → the memory leaf that owns it, dated, his words
- the reply: verdict, three to five reasons, the file attached
