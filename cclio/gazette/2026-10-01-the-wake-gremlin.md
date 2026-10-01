---
date: 2026-10-01
slug: the-wake-gremlin
tickets: []
posted: {health: no}
---

# 🗞️ cclio's gazette · the wake gremlin

a quick night session, ~01:40–03:30. no builds, no coders. the speak lane stays on 10-01/02.

## shipped

- 🐞 speak's «daemon did not answer in 3 s» found in the log: after wake, an F4 hung 6.5 min and 12 queued presses flushed in one ms, so the daemon's main thread was blocked and the `.main` control socket starved with it · plus a leaked `speak(_:_:)` continuation on 09-30 · elevenlabs out of quota until 10-30, every press runs on kokoro
- 🎯 effort baseline: `medium` for every model, `low` only on need or dima's ask; fable's «always low» retired, design work ≥ medium (`craft-spawning`)
- 🔬 model refresh: sonnet 5.5 at `medium` is a helper, not a coder (exploration ✅, mechanical edits under opus review ✅, second reviewer 🚫); the built-in Explore has used the session model since cc 2.1.198; fable 5.1 design → medium; re-run 2026-12-24 or at haiku 5.5
- 🎬 «insane jev use cases» (ai labs) mapped: rule guard + skill-picker reshape wanted, each with a before/after number
- 🗣️ dima's speak ideas saved for the designer: the F4 lens, smart sentence mode, the Swift angle, starface as taste, the public app (`studio/jobs/speak/dima-notes-lens.md`)
- ⭐ atelier's desk take pinned; all takes live as files in studio

## tricks gained

- wispr's dictionary is a local sqlite table (`flow.sqlite` → `Dictionary`), so a `wispr add` script can replace the clicks
- an artifact delete needs dima's confirm: `/artifacts` → d
- a bare `/init` fires the built-in CLAUDE.md generator, not the cclio boot

## state

- open: the speak lane (wake gremlin + normalizer coder, then shape lens / public / fable designer) · the wispr probe · the jev program · the «what i missed» view · the 4×4 fanout
- frame c1ab1513 local, no coders

⸻ upd 16:55 (checkpoint)

**shipped**
- speak gremlins merged ([#52](https://github.com/dvakatsiienko/frame/pull/52), [FRM-283](https://linear.app/x-com/issue/FRM-283)): the wake hang was an O(n²) meter drain on the main thread, the double voice a late «finished» from a stopped system voice; one voice at a time, F4-over-F4 without the stutter, the normalizer skips paths and ids and reads glued chromium lists; 7 verifier rounds, golden 71/71
- roadmap: order-only edges redrawn, cli pulled to 2026-10-01, trophy-sys planned for the design lane
- Linear cap: auto-archive never fires (projects never close) → `pnpm linear:archive` in every halt, 140 archived
- `pnpm wispr:add`: dictionary words written while Wispr runs; the ⏳ block is one fence with a «wispr adds» section
- «not for» lines on 8 misfiring skills, the stack convention (visx, react-zoom-pan-pinch, rifm, motion, react-query)
- Explore runs on sonnet 5.5 fleet-wide (proven); fast-jev-compaction on at cclio scope, key from 1password via `--values-stdin`
- the jev router is off: its misses are its shape (45 yes/no, no «none», no context); 200 blind-labelled prompts mined for the rebuild ([FRM-268](https://linear.app/x-com/issue/FRM-268) carries the video's 7 uses)

**tricks gained**
- `claude plugin configure <p> --values-stdin` sets a sensitive plugin option with no tty and no echo
- a Linear create that answers «usage limit exceeded» may still create the ticket — search the run marker before a retry
- a capture build plus one real F4 beat any guess about what an app hands the daemon

**state**
- next: checkpoint → speak shape-lite → fable designer a/b → cli grill while it draws
- FRM-283 open until the first F4 after an overnight sleep

## trail

- shipped: speak gremlins merged #52 (wake hang, one voice, normalizer) · roadmap redrawn, cli now · linear:archive + wispr:add · not-for lines + stack · Explore on sonnet · jev compaction on, router off
- open: speak shape-lite → fable designer a/b → cli grill · jev rebuild from the 200-prompt set · atelier ftr baseline · FRM-283 overnight check
- state: frame 165d2ab1 (6 unpushed), no coders · cclio 0.3.90 · x 0.11.192
