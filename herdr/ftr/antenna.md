# herdr — sidebar — antenna

wish: FRM-618 · legend and the other areas: [FTR.md](../FTR.md)

- ⬜ antenna lists every thread once, in his order, a still dot per row
  - given threads in two spaces and his saved order
  - when antenna draws
  - then each thread shows once, grouped under its space name in his order, each row its name and a still status dot, never a spinner (PK-349:W1266)
  - decision: antenna replaces x-herdr-agents in the sidebar, the old mod stays in the tree until his word; his order seeds once from `x-herdr-agents.order`, then antenna is its one writer (dima's tick, 16:15)
- ⬜ the ⚙️ cog opens antenna's settings, a small popup beside it
  - given antenna's header
  - when he clicks ⚙️
  - then a small popup opens (never the settings window) with Group by space, Show tabs, Idle time, Context fill, Wait line and Row height; each flip redraws antenna while the popup stays open, and the values live in `~/.claude/shelf/herdr-settings/settings.json` (PK-349:W1270, PK-349:W1271)
  - and with Group by space off the rows list ungrouped in his one order; each detail off leaves that detail alone (PK-349:W1267)
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
