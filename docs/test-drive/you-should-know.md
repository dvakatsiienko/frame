---
status: frozen
until: 2026-10-30
---

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

## frozen, 2026-10-14 — an upstream bug

meant to run in the desktop app, but it never does: its `turn.step` check passes only with a terminal surface or its own above-prompt render, which the desktop never reaches (0 of 16 big desktop sessions vs 32 terminal, 10-06 → 10-10). no desktop ban in the code. upstream: [claude-code#100843](https://github.com/anthropics/claude-code/issues/100843). off everywhere while frozen (dima, 2026-10-14: it may run in the background with no output); turned back on in `_clio/.claude/settings.json` when it thaws. thaws when #100843 closes fixed; the read: `.scratch/memory-sweep/you-should-know-desktop.md`.

## verdict

(10-10: dropped, then reset on 10-14 — dima wants it the day it works in the desktop app)

## the reminder, moved here (2026-10-11, o139)

⏰ 🔬 you-should-know test drive, one week to 2026-10-13 — the built-in `cc-plugin-you-should-know`, on in dima's terminal sessions (user scope, so coders get it too); walk the stress list in `docs/test-drive/you-should-know.md`, one log line per card. on 10-13: keep on, keep for dima only, or off. dima 2026-10-06: «how to test drive it? can i test drive now?» — set 2026-10-06

## reset 2026-10-14 (dima, o90)

**test card:** we believe the «you should know» card helps dima in cclio's thread · we test it by enabling it for cclio's folder only, every other session off · we measure cards shown per day in cclio's desktop thread and dima's keep/dismiss · we're right if it shows in cclio's desktop thread at least daily and dima keeps more than he dismisses.
**kill rule:** research after the 10-14 second wind proves the card cannot render in a desktop-app thread → dropped.
**first:** research whether the card works in a desktop-app thread (he saw a screenshot that says it does; it never popped in cclio's thread), then check the cclio-folder-only enablement is actually on.
