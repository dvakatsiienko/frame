---
name: game-archive
description: load when dima finishes a game, gets its platinum, drops it, or asks to archive or resume an old one — mini-interview, review, scores doc row, doc export, retrospective, and the hand-off to the next pick.
---

# game-archive — close a game so nothing is lost

dima, 2026-11-02: the finish flow (decision card «export tabs, review in retro») and «after each game, ask me about my impressions. a mini-interview. habit». the step-by-step detail lives in `/mnt/project-files/games/README.md` § finishing a game; memory `game-finish-flow` holds the why.

## 1. mini-interview — always first

- before any archiving, ask **four or five short questions** in one message, easy to answer by voice:
  - what hooked you, and what dragged
  - the moment you'll remember
  - would you replay it, and at what price or patch
  - who is it for
  - your score, in %
- wait for his answers. they seed the review, the scores doc's verdict and the taste lessons. a skipped question is fine, never re-ask

## 2. the review and the score

- his raw words → `_finished/_archive/<game>/review-raw.md`, never edited
- groomed in his voice (`x-cloud-chat:writing-for-humans`), only when he gave a full review → its own tab in [dima-games-scores](https://claude.ai/artifact/Pxb9tVghk6PFEHbwDLejsj)
- **a row in its 🏆 scores table** (his named exception to the no-tables rule; read the doc first, his edits win):
  - **game** in bold
  - **built for** (native platform) and **played on** (what he actually played it on)
  - **finished** (month, «platinum pending», or «dropped»)
  - **score** in %, his number only, never mine
  - **verdict**: his few words; a link to the review tab when a full review exists, plain text otherwise

## 3. archive his doc

- export every tab of `dima-<game>` byte-exact to `_finished/_archive/<game>/doc/<NN>-<tab>.md` + `doc/manifest.md` (tab names and order)
- he deletes the doc, or I do on his word only
- resume later = rebuild one doc from `doc/`, same tabs and order (escape a line starting `: ` as `\: `)

## 4. my side

- `_finished/<game>.md`: verdict + score, how it went, what helps next time, old doc url marked deleted
- the game folder moves to `_finished/_archive/<game>/`, next to `doc/`
- a line in README «finished games»; memory `games-journal` gets the run; taste lessons (never the review text) → `games-taste-record`
- the game's threads are renamed `🏁 <game> ✦ N`

## 5. the next pick

- check memory `games-taste-queue` § standing games first: one that has landed is the next game
- otherwise hand to `game-research` (what-next): **switch genre and setting** from the game just finished, from what he owns
- his pick → `game-prep`
