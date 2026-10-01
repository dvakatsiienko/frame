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

⸻ upd 21:45

**shipped**
- `x`, the cli v0 ([#53](https://github.com/dvakatsiienko/frame/pull/53), [FRM-285](https://linear.app/x-com/issue/FRM-285)): one verb registry, `x lane` (a frame worktree pushes through the main checkout, git-crypt ciphertext refused with `x lane unlock`), `x schema`, json for agents; shaped through 5 research lanes, the old 6-ticket chain closed
- speak shaped at a prod grade and designed: 3 arms (opus medium, fable medium, fable high) → dima's 39 canvas comments → one merged take, 25 boards, `decision.md` + `contract.md`; the build ticketed as [FRM-288](https://linear.app/x-com/issue/FRM-288) → 289–292 after a 3-arm adviser trial said «revise»
- speak F4 fixes: list markers and «■» silent, glued bullets pause, Slack grabs with ⌘C, an idle F4 tries ⌘C when accessibility sees nothing
- the atelier ftr ↔ tests baseline ([FRM-286](https://linear.app/x-com/issue/FRM-286)): 20 of 49 lines tested, all partial → the checker as a skill
- the fable adviser researched ([FRM-287](https://linear.app/x-com/issue/FRM-287)): a `--bg` critic on a fixed template, never the built-in `--advisor` (no brief, encrypted output)
- the vorssaint shelf as a door (`pnpm vorssaint:shelf`), iTerm back on frame prefs at line spacing 1.2, models.md refreshed + the Anthropic 5.5 webinar folded

**tricks gained**
- fable 5.1 high draws the best and costs the most: $4–17 a spread, and a long comment session reached $63 — half of it cache reads on a 700k context
- dima picks by commenting on the canvas; ⌘F on an exact board text, and «dima-confirm-N» stickies, beat describing boards in chat
- an adviser on the build plan caught the plan's cut flaws before any coder ran; a cheap arm caught the big four, fable added two real ones

**state**
- next: FRM-289 (the daemon lane) spawns at the 5h reset; design work moves to the start of a fresh window
- the design comms model is the open problem for the next session

## trail

- shipped: x cli v0 #53 · speak shaped + designed (3 arms → merge, 25 boards) + ticketed FRM-288–292 · F4 fixes (bullets, slack, chrome) · atelier ftr baseline · adviser researched + trialled · vorssaint shelf · iterm 1.2
- open: FRM-289 daemon lane at the 5h reset · design comms model · cli opentui v0.1 · jev rebuild · FRM-283 overnight check
- state: frame pushed, no coders · cclio 0.3.90 · x 0.11.197
