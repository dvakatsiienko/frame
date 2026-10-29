# load balancing — the 5h window paces the lanes

dima, 2026-10-08 (boot line): «for the 5h window — keep an eye on it and pace it so it doesn't overfill. keep it as a perm habit … attention and wellbeing first, output volume after.»
- **the door**: `~/.claude/shelf/cc-usage-window.json` (x-mod-stash writes it on every `session.measure`, terminal and desktop); `mcp__ccd_session_mgmt__get_usage` is the desktop fallback. pace = (now − (reset − 5h)) ÷ 5h; ahead = used − pace.
- **read before every lane start or spawn, at every member's done, and at every siesta** — one `jq`; the number itself is never printed to dima (dima, 2026-10-10: «remove the habit of printing this to me via replies, but keep checking my usage»).
- 🌤️ **a siesta fires `cclio:siesta`** — its triggers live in that skill's «when»
- **ahead of pace → the side lane parks gracefully**, in every mode: a day with dima near the keyboard, a side lane beside the main one, a shift while he is afk (dima, 2026-10-21: «the parallel lane and our main lane burn the 5-hour window faster than it recovers, so we go over the pace often. I keep an eye on it myself, but you should also keep an eye on it and handle it gracefully»):
  - nobody stops in place: the lane finishes its meaningful chunk, then parks until we are back on pace; nothing new starts before that; the first siesta back on pace resumes it (`shape-lane-dispatch` § 6)
  - informative, never blocking: no approval ask, one line to dima — «we're over the pace; I told the side lane to park after its chunk»
- **the shape to avoid**: stuck at 95 % of the 5h window with the reset 3h away. the plan spreads over the window left at boot, never over a fresh 5h.
- **«what could we spend spare quota on?»** (dima, 2026-10-20) → the spare-quota items under FRM-184's «from the pocket», the skill eval (was PK-119) first
- **the weekly window is dima's to watch** (2026-10-21: he dropped the ~15 %/day ping); never a self-stop on it, he leans to spending the week fully.
