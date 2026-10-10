# test drive — cc-plugin-you-should-know

window: 2026-10-06 → 2026-10-13 (one week). dima's terminal sessions, user scope.

## what it is (day 0, read from the 2.1.291 binary by the advicer source lane)

- a built-in mod on `turn.step`, skips subagent steps; fires on every 6th step of a main session
- runs `model.fork({prompt})` on the session's own model and cache, no tools, one answer
- prompt: help the human understand their work; default to nothing («the bar is very high»), skip what was discussed and what was offered before
- shows one card (≤120 words, «You should know» / «Heads up») above the prompt: Learn more · Knew this already · Chat in main session · Dismiss
- 📌 user scope → every session gets it, `--bg` coders included; the card is a mod panel, likely absent in the desktop Code tab ([#99217](https://github.com/anthropics/claude-code/issues/99217)) — an inference until a round shows it

## turn on

terminal `claude` → `/plugin` → Installed → «Show disabled» → `cc-plugin-you-should-know` → Space

## stress list

- a card that taught dima something new — the main metric: useful cards per day
- a card on a topic already discussed — the dedup claim
- «Knew this already» — does the next card avoid the topic
- «Chat in main session» — what it injects into the thread
- a long coder session (`--bg`) — does it fire there, and what it costs
- the Code tab — does a card render at all
- cost: the fork's tokens per card, from the transcript

## log

one line per round: date · session · card topic · useful / known / noise · tokens · note

- 2026-10-10 · store + transcripts, cc 2.1.296 · 32 sessions tracked, cards in 26 · all `entrypoint: cli`, 31 of them cclio `--bg` crew spawns dima never reads; 0 of 6 desktop sessions since the first tracked one · cost ≤ ~$21 api-equivalent: the gap between each session's `cost-state` and its logged main-thread usage, 4.9 % of their $427 opus, ~1.1 % of $1,910 across 229 sessions since 10-06 — an upper bound, the gap holds other side calls too · it forks far less than every 6th step would predict (~16 % of cache reads vs a 2.8 % gap)

## verdict

dropped, 2026-10-10 — turned off in `settings.json`. not because of the feature: dima likes it and wants it, but he works in the desktop app ~99 % of the time, where it never fires, and in the terminal it only reaches unattended `--bg` sessions. it goes back on the day it works in the desktop app.
