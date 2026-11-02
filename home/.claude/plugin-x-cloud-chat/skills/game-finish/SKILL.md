---
name: game-finish
description: load when dima says he finished, platinumed, dropped or wants to archive a game, or asks to resume an archived one.
---

# game-finish — close a game so nothing is lost

the step detail: `/mnt/project-files/games/README.md` § finishing a game. the why: memory `game-finish-flow`. this skill is the order.

## 1. mini-interview first

- four or five short questions in one message, easy to answer by voice:
  - what hooked you, and what dragged
  - the moment you'll remember
  - would you replay it, and on what condition
  - who is it for
  - your score, in %
- wait for the answers; a skipped question is fine, never re-ask

## 2. review and score

- his raw words → `_finished/_archive/<game>/review-raw.md`, untouched
- a full review → groomed in his voice (`x-cloud-chat:writing-for-humans`), its own tab in [dima-games-scores](https://claude.ai/artifact/Pxb9tVghk6PFEHbwDLejsj)
- a row in its 🏆 scores table (his named exception to no-tables), read first since his edits win:
  - **game** in bold
  - built for, and played on
  - finished, as a month
  - score, his number only
  - verdict: his few words, linked to the review tab when one exists
- no finish date in his words → the tracker: the last story trophy's `earnedAt` (psn) or the completion achievement (steam); no achievements → last played, said as such

## 3. archive his doc

- every tab of `dima-<game>` exported byte-exact to `_finished/_archive/<game>/doc/<NN>-<tab>.md` + `doc/manifest.md`
- the doc is deleted by him, or by me on his word only
- resume = one rebuilt doc from `doc/`, same tabs and order; a line starting `: ` is escaped as `\: `

## 4. my side

- `_finished/<game>.md`, the folder into `_finished/_archive/<game>/`, a README «finished games» line, memory `games-journal`, taste lessons (never the review) to `games-taste-record`
- the game's threads renamed `🏁 <game> ✦ N`

## 5. next pick

- a landed standing game (memory `games-taste-queue`) is the next game
- otherwise `game-research`, what-next variant; his pick → `game-seed`
