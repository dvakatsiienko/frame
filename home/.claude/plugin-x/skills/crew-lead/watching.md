# crew-lead — what a session does, measured; lifetime and stopping

## measured, not read from a schema

- **`--effort` is honoured** on `claude --bg` — pass it every time, it is a flag, never inherited.
  a `Workflow` `agent()` call honours its per-call `effort` too (2.1.258).
- ❗ **a plugin bump does not reach a running desktop-born session** — `/reload-plugins` + `/reload-skills` in a Code-tab codie left it on x 0.11.167 with 0 LSP servers while the cache held 0.11.175 (2026-09-30, the speak codie). a skill or LSP change is tested in a FRESH session; the probe is the session reporting its loaded version, never «i reloaded».
- ✅ **a user-only skill runs when the summon prompt starts with it** — `claude --bg '/run-skill-generator <app> …'` generated 9 run skills with no hands (2026-09-27, cc 2.1.283). the same door as `/x:crew-codie`: a skill a model cannot load is typed by the summon instead.
- ❌ **a prompt runs ONE slash command: everything after it is that command's args, by design** — a `claude -p --model haiku` probe with two matt skills on two lines: line 1 expanded, line 2 became line 1's argument (cc 2.1.289, 2026-10-07; crow read the mechanic right, a typed prompt does the same). re-probed on 2.1.292: two skills stacked on ONE line deliver only the first body too, though the skills docs say up to six stack at the start. mid-message, a `/name` is only a hint the model may act on. a second user-only skill is read from its `SKILL.md` (`sys-skills`).
- ✅ **`claude --bg '<prompt>'` RUNS the prompt** (re-verified 2.1.258; it came up idle on 2.1.239).
  `SendMessage` is still how you brief it later, and the only way to attach `notify_when_idle`.
- ⚠️ **a peer answering in plain prose reaches nobody** — only a message call travels; say so
  in any brief expecting an answer. a Code-tab-born session has cc `SendMessage` + `ListAgents` too (probed 2026-10-04 on cc 2.1.289: a desktop-born sonnet answered clio's message through its own `SendMessage`, deferred until loaded); the desktop's `mcp__ccd_session_mgmt__send_message` is a second, one-way door. **both, always:** the ping for timing, the transcript (`list_events`)
  for the picture — dima also steers codie in its own chat, and only the transcript shows that.
- 🚨 **a hang is mine to break** (dima 2026-09-20, after a whole loop stood still — codie, sixth sense and coordinator all idle): the coordinator is the only member that sees every session, so it is the detector. a member's turn-end note and idle notice are logged only, in `quiet-log:<day>`, no turn; a member on an open lane silent past the 🎛️ wait raises one native alarm, under a shift also one wake of yours; on it, ping the member with the next concrete step; no reply within ~5 min (a `Monitor` on the registry status, deadline stated) → ping dima if he is around, otherwise re-brief from the member's CST or re-summon
- 🚨 **a step a member waits on is announced to it in the same turn** (2026-10-02): i re-labeled #120 for its review and told no one; codie said «the re-label is your call» and waited while i waited on the review. the action and its `SendMessage` go out in one tool batch.
- 🚨 **a silent-member alarm is a check, never a «nothing new»** (dima 2026-09-20, after codie stalled twice within minutes): on every alarm or wake, run `node ~/frame/_clio/script/idle-check.ts <its name>` — its last text, its tree, its last commit and a 🟢 fine or 🟡 stall verdict (a ⏳ or a question is a stall, whoever it is addressed to: frame-1b sat 11 min on two asks to dima, 2026-10-06); hold its last commit against codie's last ping, and a stall, an unpinged commit or an open assignment → nudge in that turn; a spec holding a `pace-park` line is a park, never a stall: no nudge, the siesta back on pace resumes it
- ⚠️ **`notify_when_idle` subscriptions die on a coordinator restart or compaction, silently** — re-subscribe
  after every restart or compaction; an empty `SendMessage` costs nothing.
- ⏱️ **codie idle on its own timer needs no re-arm** — its report message is the signal; three re-arms fired at once on 10-05
- ⏱️ **a wait on `notify_when_idle` needs its own deadline** — quiet comms logs an idle notice, no turn, in every mode; only an exit notice still wakes you, which is why the subscription stays (`plugin-x/mods/x-mod-stash/FTR.md` § quiet comms)
- ⏱️ **the idle notice is QUEUED, not immediate** — it drains at your next tool round, so it can
  land after the session it reports was stopped. read the timestamp it carries, never its arrival
  time (2.1.251).
- 🚨 **remote control has ONE owner per session** (loser prints 4090). Start in the terminal, treat
  the desktop Code tab as join-only. 📌 handover direction untested — assert no cause.
- **codie needing a browser runs `--bg` with `agent-browser`** (`x:browser-headless`), which works from any session; the Browser pane exists only in a desktop thread, and those are only the mods codie and clio's wings (dima o69)

## lifetime and stopping

A member whose chunk is done **parks**: alive, idle, context kept; `claude stop` or `archive_session` only on dima's word (`rules/fleet-vibe.md`), or at his `clio:halt`, whose stop list stands. A new chunk in another area still goes to the parked member, second-winded first when its context is past ~20–25 % ([models.md](models.md) § summon or reuse). **Always stop probes.**

- **a lane whose last member stopped has its 🛼 glide ended at the next siesta or the halt** (`clio:siesta` 2.5, `clio:halt` phase 1.8); a parked lane gets a new card when it resumes
- 🚨 **stop with `claude stop <jobId>`, never `kill <pid>`** — four rc sessions killed by pid came
  back with new pids (2026-08-30, cause unconfirmed). the registry file removes itself on exit,
  so `ls` is the whole verification. never pattern-kill.
- `TaskStop` reaches only subagents *this* session spawned.
- ⚠️ **deleting the session in the desktop Code ui does NOT stop it** — measured: card gone,
  process alive. Never report codie stopped because a ui said so.
- **a wind order to a member says it is a context reset, keep working**: «finish first» read as a stop parked a codie 38 min with runnable steps
- **a member compacted between chunks** re-inits by role (the pick-up list in `SKILL.md`) before its next chunk
- 📌 before closing a summon, ask what it is still evidence for — «finished its work» and «finished
  being useful» are different states.

**Context size is a cost, not a precision cliff — until our own probe says otherwise**: no
long-context number exists for the 5 family, the last measured knee (opus 4.6) sits past 256k, a
90k boot on a warm 1h cache is ~2 cents a turn. what does cost: a cache gone cold after a >1h gap.
the probe (10-needle recall + one edit at 100k / 400k / 800k) rides `refresh-crew-coordinator` at
every model bump — the curve is per-release.
📌 **the top of the cost curve is measured, not capped**: codie at 250–460k context, 638 steps in 75 min, took ~85 % of a 5-hour window (2026-09-12). dima's call: no ceiling, no auto-compact below the max — codie compacting mid-task forgets the task. cases log in `docs/test-drive/ctx-burn.md`; dig in when the pattern repeats.

**Cost of a reading agent = bodies × size, never agents × a flat number** — the board-sweep
workflow was guessed at ~150k and spent 1.27M for 82 ticket bodies + comments.

**codie's last act at each chunk's end is its retro**, its shape in `x:crew-dna`; clio's ask states the why (the fleet improves only from what its members saw) and names the angles: the brief, the steers, the lane, the reporting, what nobody asked; blunt, name-the-moment specifics.

Full evidence base: [references/spawn-mechanics.md](references/spawn-mechanics.md), on demand.

**a coordinator reopening a clean lane names its one round**: the delta, «one round, then merge or stop to me», and a follow-up finding goes to the next chunk unless it passes his brake or hold; `lane-rounds:<lane>` in x-mod-stash's store holds the count (frame#146 went 3 rounds to 6 on an open steer, 2026-11-07).
