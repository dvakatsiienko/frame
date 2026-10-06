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
