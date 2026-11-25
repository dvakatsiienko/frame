# herdr — sidebar — antenna

wish: FRM-618 · legend and the other areas: [FTR.md](../FTR.md)

- ⬜ antenna lists every thread once, in his order, a still dot per row
  - given threads in two spaces and his saved order
  - when antenna draws
  - then each thread shows once, grouped under its space name in his order, each row its name and a still status dot, never a spinner (PK-349:W1266)
  - decision: antenna replaces the old agents list in the sidebar, its mod is deleted with its ♪ sounds, zoo's (dima, 2026-11-24: «if zoo-delete it»); the shared keys are `x-herdr-antenna.order` and `.names`, antenna their one writer (dima's tick, 16:15; renamed 2026-11-25, FRM-620:W53)
- ⬜ the ⚙️ cog opens antenna's settings, a small popup beside it
  - given antenna's header
  - when he clicks ⚙️
  - then a small popup opens (never the settings window) with Group by space, Show tabs, Idle time, Context fill, Wait line (on by default, his o2), Keep hot 🔥, Model and Row height; each flip redraws antenna while the popup stays open, and the values live in `~/.claude/shelf/herdr-settings/settings.json` (PK-349:W1270, PK-349:W1271)
  - and with Group by space off the rows list ungrouped in his one order; each detail off leaves that detail alone (PK-349:W1267)
- ⬜ a row carries keep hot 🔥 and the model, once the deck's
  - given Keep hot 🔥 on (its default) and Model off (its default)
  - when antenna draws
  - then each row shows its 🔥, filled while kept hot, and a press keeps that thread hot as the deck's did; with Model on, each row shows its model and the session's own effort, under it on a two-line row (Wait line on), «opus 5.5 · medium» on one line otherwise, the model alone while no effort was named (FRM-618:W1292, FRM-620:W57)
- ⬜ a drag orders the rows, no sort and no sound button
  - given antenna's rows
  - when he drags one within its space
  - then it lands where dropped and stays after a restart; the header holds only ⚙️ (PK-349:W1265)
  - decision: a row moves within its own space, so a space header never sits between a row and its slot
- ⬜ Tab reaches the threads, Enter opens one
  - given the keyboard in the quill or orbit
  - when he presses Tab
  - then focus walks into antenna's rows, each outlined in the accent, and Enter focuses that thread (FRM-618:W1288)
- ⬜ with tabs hidden the top bar names the focused thread
  - given Show tabs off
  - when the window draws
  - then the pills are gone and the top bar shows the focused thread's name and its wait line, the bar still moving the window (PK-349:W1272, PK-349:W1287)
