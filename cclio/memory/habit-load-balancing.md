# load balancing — the 5h window paces the lanes

dima, 2026-10-08 (boot line): «for the 5h window — keep an eye on it and pace it so it doesn't overfill. keep it as a perm habit … attention and wellbeing first, output volume after.» renamed from usage pacing on his word, 2026-10-10: the window works as a load balancer while lanes run.

- **the door**: `~/.claude/shelf/cc-usage-window.json` (x-mod-stash writes it on every `session.measure`, terminal and desktop); `mcp__ccd_session_mgmt__get_usage` is the desktop fallback. pace = (now − (reset − 5h)) ÷ 5h; ahead = used − pace.
- **read before every lane start or spawn, at every member's done, and at every siesta** — one `jq`, never printed to dima (dima, 2026-10-10: «remove the habit of printing this to me via replies, but keep checking my usage»).
- 🌤️ **a siesta fires `cclio:siesta`** — on a member's done report, a batch of mine touching 3+ files or any memory, rule or skill file, or dima's «siesta»
- **ahead of pace → no new lane starts; running lanes are never stopped mid-work.** a running lane finishes, gets resolved, then stops or takes a useful next job; new starts resume once the window cools back to pace (dima, 2026-10-10).
- **the shape to avoid**: stuck at 95 % of the 5h window with the reset 3h away. the plan spreads over the window left at boot, never over a fresh 5h.
- **weekly: ~15 % a day is a recommendation only.** over it → one line to dima, never a self-stop (dima, 2026-10-10: «never stop yourself, just ping me if we go overboard»). he leans to spending the week fully; idling is the waste, not going overboard.

Related: `x:crew-lead` (spawn costs), [[habit-dima-comms-pacing]] (siestas)
