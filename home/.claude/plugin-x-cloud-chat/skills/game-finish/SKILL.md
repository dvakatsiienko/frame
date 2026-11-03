---
name: game-finish
description: load when dima says he finished, platinumed, dropped or wants to archive a game, or asks to resume an archived one.
---

# game-finish — close a game so nothing is lost

the step detail: `/mnt/project-files/games/README.md` § finishing a game. the why: memory `game-finish-flow`. this skill is the order.

📌 a finish is done only when the tails check in § 6 is clean; nms left five tails before this step existed.

## 1. close what is open, before anything moves

- his doc's 📬 q&a tab, open comments on every tab, and this game's `dima-games-inbox` items: answered, so nothing open gets archived
- the tracker (`firelink`): final numbers, platinum `earned`, the finish month

## 2. mini-interview

- four or five short questions in one message, easy to answer by voice:
  - what hooked you, and what dragged
  - the moment you'll remember
  - would you replay it, and on what condition
  - who is it for
  - your score, in %
- wait for the answers; a skipped question is fine, never re-ask

## 3. review and score

- his raw words → `_finished/_archive/<game>/review-raw.md`, untouched
- a full review → groomed in his voice (`x-cloud-chat:writing-for-humans`), its own tab in [dima-games-scores](https://claude.ai/artifact/Pxb9tVghk6PFEHbwDLejsj)
- a row in its 🏆 scores table (his named exception to no-tables), read first since his edits win:
  - **game** in bold
  - built for, and played on
  - finished, as a month
  - score, his number only
  - verdict: his few words, linked to the review tab when one exists
- no finish date in his words → the tracker: the last story trophy's `earnedAt` (psn) or the completion achievement (steam); no achievements → last played, said as such

## 4. archive his doc

- every tab of `dima-<game>` exported byte-exact to `_finished/_archive/<game>/doc/<NN>-<tab>.md` + `doc/manifest.md`
- the doc is deleted by him, or by me on his word only
- resume = one rebuilt doc from `doc/`, same tabs and order; a line starting `: ` is escaped as `\: `

## 5. my side

- `_finished/<game>.md`, the folder into `_finished/_archive/<game>/`, a README «finished games» line, memory `games-journal`, taste lessons (never the review) to `games-taste-record`
- memory `games-queue-now`: the «now» line moves to «finished», the next pick moves up; its `MEMORY.md` description follows
- a memory leaf that only serves this game (a cache path, a game-only source rule) → `_finished/_archive/<game>/memory-leaves.md`, then out of memory and the index
- stray copies of this game outside its archive (`games/_backup/`, `games/_docs-archive/`) → named to him, moved into the archive on his word
- the game's threads renamed `🏁 <game> ✦ N`

## 6. tails check — the finish is done when it is clean

- `grep -rn "games/<game>/\|<doc id>" /mnt/project-files --include=*.md | grep -v "_finished/"` prints nothing
- `grep -rln "<game>" /tmp/claude/memory/team/silo/` → every hit is a verdict, a lesson or a ledger line, never a live path or a «now»
- his `play next.md` line is his to remove: one reminder in the closing reply

## 7. next pick

- a landed standing game (memory `games-taste-queue`) is the next game
- otherwise `game-research`, what-next variant; his pick → `game-seed`
