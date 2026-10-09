# crew-lead — what a session does, measured; lifetime and stopping

## measured, not read from a schema

- **`--effort` is honoured** on `claude --bg` — pass it every time, it is a flag, never inherited.
  a `Workflow` `agent()` call honours its per-call `effort` too (2.1.258).
- ❗ **a plugin bump does not reach a running desktop-born session** — `/reload-plugins` + `/reload-skills` in a Code-tab coder left it on x 0.11.167 with 0 LSP servers while the cache held 0.11.175 (2026-09-30, the speak coder). a skill or LSP change is tested in a FRESH session; the probe is the session reporting its loaded version, never «i reloaded».
- ✅ **a user-only skill runs when the spawn prompt starts with it** — `claude --bg '/run-skill-generator <app> …'` generated 9 run skills with no hands (2026-09-27, cc 2.1.283). the same door as `/x:crew-coder`: a skill a model cannot load is typed by the spawn instead; a `SendMessage` carrying the slash text still does not expand.
- ❌ **a prompt runs ONE slash command: everything after it is that command's args, by design** — a `claude -p --model haiku` probe with two matt skills on two lines: line 1 expanded, line 2 became line 1's argument (cc 2.1.289, 2026-10-07; ccrow read the mechanic right, a typed prompt does the same). re-probed on 2.1.292: two skills stacked on ONE line deliver only the first body too, though the skills docs say up to six stack at the start. mid-message, a `/name` is only a hint the model may act on. a second user-only skill is read from its `SKILL.md` (`sys-skills`).
- ✅ **`claude --bg '<prompt>'` RUNS the prompt** (re-verified 2.1.258; it came up idle on 2.1.239).
  `SendMessage` is still how you brief it later, and the only way to attach `notify_when_idle`.
- ⚠️ **a peer answering in plain prose reaches nobody** — only a message call travels; say so
  in any brief expecting an answer. a Code-tab-born session has cc `SendMessage` + `ListAgents` too (probed 2026-10-04 on cc 2.1.289: a desktop-born sonnet answered cclio's message through its own `SendMessage`, deferred until loaded); the desktop's `mcp__ccd_session_mgmt__send_message` is a second, one-way door. **both, always:** the ping for timing, the transcript (`list_events`)
  for the picture — dima also steers the coder in its own chat, and only the transcript shows that.
- 🚨 **a hang is mine to break** (dima 2026-09-20, after a whole loop stood still — coder, verifier and coordinator all idle): the coordinator is the only member that sees every session, so it is the detector. every member is subscribed (`notify_when_idle`, re-armed on every send); an idle notice with an open assignment → ping the idle member in the same turn with the next concrete step; no reply within ~5 min (a `Monitor` on the registry status, deadline stated) → ping dima if he is around, otherwise re-brief from the member's CST or respawn; a stall is reported the moment it is seen, never folded into a later summary
- 🚨 **a step a member waits on is announced to it in the same turn** (2026-10-02): i re-labeled #120 for its review and told no one; the coder said «the re-label is your call» and waited while i waited on the review. the action and its `SendMessage` go out in one tool batch.
- 🚨 **an idle notice is a check, never a «nothing new»** (dima 2026-09-20, after a coder stalled twice within minutes): on every idle notice read the member's last assistant text (`jq` on its transcript, `~/.claude/projects/*/<sessionId>.jsonl`) — a ⏳ or a question there is a stall, whoever it is addressed to (frame-1b sat 11 min on two asks to dima, 2026-10-06) — then run `git -C <worktree> status --short` + `git log -1` against the coder's last ping; a dirty tree, an unpinged commit or an open assignment → nudge in the same turn. the stall then lasts seconds, unattended
- ⚠️ **`notify_when_idle` subscriptions die on a coordinator restart, silently** — re-subscribe
  after every restart; an empty `SendMessage` costs nothing.
- ⏱️ **a coder idle on its own timer needs no re-arm** — its report message is the signal; three re-arms fired at once on 10-05
- ⏱️ **the idle notice is QUEUED, not immediate** — it drains at your next tool round, so it can
  land after the session it reports was stopped. read the timestamp it carries, never its arrival
  time (2.1.251).
- 🚨 **remote control has ONE owner per session** (loser prints 4090). Start in the terminal, treat
  the desktop Code tab as join-only. 📌 handover direction untested — assert no cause.
- 🚫 **the desktop Browser pane (`mcp__Claude_Browser__*`) exists ONLY in a session the Code tab itself created** — injected via `--mcp-config` at creation, never on resume, never for `claude --bg` or remote-control (sources in `docs/knowledge/fleet-claude-capabilities.md`). a browser-needing coder is a handoff dima opens in a fresh Code-tab session; a terminal-born cclio has no pane. `x:browser-headless` works from either.

## lifetime and stopping

Per-case judgment: keep a coder warm when its context is expensive and the next assignment is
nearby; respawn when the work is unrelated or the context is polluted. **Always stop probes.**
🧪 **until 2026-10-15, the comms-trim check before every stop**: read the member's retro `comms:` line; no retro → one message «did you need cclio at any point and not reach her?» before `claude stop`. a gap found goes to the halt count (dima, 2026-10-08).

- 🚨 **stop with `claude stop <jobId>`, never `kill <pid>`** — four rc sessions killed by pid came
  back with new pids (2026-08-30, cause unconfirmed). the registry file removes itself on exit,
  so `ls` is the whole verification. never pattern-kill.
- `TaskStop` reaches only subagents *this* session spawned.
- ⚠️ **deleting the session in the desktop Code ui does NOT stop it** — measured: card gone,
  process alive. Never report a coder stopped because a ui said so.
- 📌 before closing a spawn, ask what it is still evidence for — «finished its work» and «finished
  being useful» are different states.

**Context size is a cost, not a precision cliff — until our own probe says otherwise**: no
long-context number exists for the 5 family, the last measured knee (opus 4.6) sits past 256k, a
90k boot on a warm 1h cache is ~2 cents a turn. what does cost: a cache gone cold after a >1h gap.
the probe (10-needle recall + one edit at 100k / 400k / 800k) rides `refresh-crew-coordinator` at
every model bump — the curve is per-release.
📌 **the top of the cost curve is measured, not capped**: a coder at 250–460k context, 638 steps in 75 min, took ~85 % of a 5-hour window (2026-09-12). dima's call: no ceiling, no auto-compact below the max — a coder that compacts mid-task forgets the task. cases log in `docs/test-drive/ctx-burn.md`; dig in when the pattern repeats.

**Cost of a reading agent = bodies × size, never agents × a flat number** — the board-sweep
workflow was guessed at ~150k and spent 1.27M for 82 ticket bodies + comments.

**a coder's last act is a retro** (dima, 2026-09-08, after a test that surfaced nine ranked findings): ≤12 lines into `~/.claude/shelf/retros/` (never a message since 2026-10-08; folded at the halt), most important first (the cap lives in `x:crew-dna`), with the WHY stated in the ask — the fleet improves itself only from what its members saw. the shape of the ask matters: name the angles (the brief, the steers, the lane, the reporting, what nobody asked), ask for blunt, name-the-moment specifics. cclio folds it into the flawlog flush. the contract line lives in `x:crew-coder`.

Full evidence base: `docs/knowledge/spawning-mechanics.md`, on demand.
