# x-mod-breather — a breathing meter above the prompt while Claude works

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## the band

- ✅ the meter shows above the prompt while Claude works
  - given Claude is working a turn, the breather is on, and no survey is up
  - then the band shows the meter: on the terminal 3 rows of block bars (`▁`…`█`), on the desktop a 7-row grid of squares
  - then it is gone the moment the turn ends, and never shows while idle
  - decision: the meter, not the old pulse, ripples, dots and wave styles — «a sline-styled blocky audio-wave breather, gruvbox palette, breathes full width, interesting non-linear animation» (dima, 2026-10-08)
  - decision: 3 rows on the terminal, 7 on the desktop — the terminal line is precious (dima, 2026-10-08)
- ✅ the meter breathes the exercise
  - given an exercise is chosen (Coherent Breathing by default)
  - then the meter rises on the inhale from the middle out, holds full, folds back on the exhale, and rests on its floor in an empty hold; one loop is one breath cycle
  - then bars wander and differ from their neighbours, and heights glide between levels instead of stepping
  - decision: one motion for both surfaces (`breath/meter-shape.ts`): the desktop bakes it into the svg's own animation, the terminal samples it ten times a second
- ⬜ the meter wears sline's gruvbox ramp
  - then the bars climb green, yellow, orange (and red at the desktop's top row); an unlit cell is a light gray that follows the theme
  - decision: desktop dark is the gruvbox `#282828` band, desktop light a brighter ramp on a clear band — «light is a bit dim, make it more bright and expressive» (dima, 2026-10-08)
- ⬜ another mod's redraw never restarts the desktop breath
  - given a turn runs on the desktop and x-mod-stash redraws the band (its 4 s poll)
  - then the meter breathes the whole cycle — full inhale, hold, exhale — and never snaps back to its floor mid-inhale
  - the bug (dima's gif, FRM-354): the breath restarted every ~4.46 s, 6 times in 24 s, one blank frame each, so a 5.5 s inhale never finished
  - decision: each render's svg starts its SMIL clock at the breath's own phase (a negative `begin`), so a remount from any mod resumes mid-breath; the desktop recreating an `Svg` on every redraw, same `key` and `source`, is inferred from the gif, not probed
  - decision: the 4 s source is gone too — an open board's tick no longer redraws the band (x-mod-stash's `FTR.md`); a redraw from a real band change still rebuilds the svg, and the phase start covers it
- ✅ a subagent finishing mid-turn keeps the band breathing
  - given a turn spawns a subagent and the subagent finishes while the turn goes on
  - then the band keeps its breath where it was, with no restart and no flicker
- ⬜ the spinner reads the breath
  - given the band is showing and the spinner is on
  - then the spinner's word is the phase and its seconds left: `Breathe in 4s…`, `Hold 3s…`, `Breathe out 5s…`
  - decision: the band carries no phase text; the spinner is the one cue (dima, 2026-10-08: «remove breathe in breathe out text»)

## /breathe

- ⬜ `/breathe` sets the breather, and the settings outlive the session
  - when dima types `/breathe` with `on` or `off`, an exercise (`hrv`, `sigh`, `box`, `478`, or `coherent`, `physiological`, `relax`), `delay <s>`, `spinner on|off`, or nothing
  - then the setting changes and the reply is one status line: on or off, the exercise and its pattern, the delay, the spinner; `help` lists every form
  - makes: one `config` key in x-mod-breather's `$.store`, read at every session start; a key the breather no longer knows (a retired `style`) is ignored
- ⬜ a delay holds the band back
  - given `/breathe delay 20`
  - then the band shows only once Claude has worked 20 s of the turn, and its breath starts there
