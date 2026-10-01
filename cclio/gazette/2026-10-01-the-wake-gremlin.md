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

## trail

- shipped: speak wake gremlin located (main thread blocked after wake) · medium = every model's effort baseline · sonnet 5.5 refresh · dima's lens ideas in studio
- open: speak lane 10-01/02 (gremlin + normalizer coder, shape lens + public + fable designer) · wispr add probe · jev program · «what i missed» view
- state: frame c1ab1513, no coders · cclio 0.3.88 · x 0.11.191
