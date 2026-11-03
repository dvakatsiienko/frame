---
name: game-play-fold
description: load when dima says «fold», «fold everything» or «wrap up» in a 🎮 play thread or 🔍 game thread of the «stuff» project — the thread's last turn.
---

# game-play-fold — end a game thread, nothing lost

`game-play-boot` opens a thread, this ends it: everything folded, the thread resolved. the next thread boots from the folder alone. his rules: memory `fold-protocol`, `games-inbox-outbox`. a game that is finished goes to `game-finish` instead.

## 1. live numbers first

- trophies and progress from the `firelink` tracker; never stored as current state, only as a dated log line

## 2. sort the thread into the folder

`/mnt/project-files/games/<game>/`; re-read each file just before patching, patch in place, never rewrite a whole file.

- his words and in-game reports → `corrections.md`, dated, newest first; an older line it beats is marked superseded
- decisions, one line of why each → his doc `dima-<game>` in place, after a `sinceRev` read; a superseded line struck through with its date
- where he is and the exact next step → the «▶ next» block at the top of `index.md`, rewritten; a step waiting on him reads «waiting on you: …»
- facts learned → the topic file (`trophies.md`, `tips.md`, …), each sourced or marked 🔎
- tool gotchas paid for → one line each under `## 🔧 gotchas` in `index.md`
- one dated line in `index.md`'s run log
- taste and cross-game rules → project memory (`games-journal`, the taste files), never the folder

## 3. sweep once more

- the 📬 q&a tab, open comments on every tab, `dima-games-inbox` (this game's and «any game» items): answer, then delete the swept inbox items
- 📌 answered q&a pairs are his to clear

## 4. the last reply, then resolve

- one reply: what went where, each file linked, and «safe to start a fresh thread»
- `set_thread_resolved` true; the thread name stays `🎮 <game> ✦ N`
