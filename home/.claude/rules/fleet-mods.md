# fleet mods — the cc mods every session works through

**scope:** the mods of plugin `x` (`plugin-x/mods/<name>`), the fleet's live channel to dima. one section per mod, one line per part a session meets. how a mod is built: `plugin-x/mods/AGENTS.md`.
📌 a `--bg` session draws no board: its orbit and phases stay unseen in the desktop app (2026-10-11), so its asks also reach its coordinator in its ping.

## 🗂️ x-mod-stash — the board

- **🪐 orbit — asks for dima.** an ask goes through the tool `mcp__x-mod-stash__orbit`, never into a reply; the tool's description holds the ops (add, resolve, follow, plan). an unmarked ask means nothing yet. orbit switched off in 🎛️ settings → every member puts its asks in the reply as one ➡️ line each.
  - a pick names its whole outcome, so a tick needs no follow-up: a rename carries the new name («breather → breathing bars»), a choice its option, never the verb alone
  - a reply names an ask by its subject in plain words; its `oN` id stays on the board, never in the reply
  - one ask leads with its subject, the why in its hidden note (the tool refuses one past 90 chars); an irreversible one leads with ⚠️ and names its exact target; another round is a `follow`, never a second add
  - a member in a lane keeps its asks in its own orbit only; the 🛼 glide card on every board shows them, and dima's tick there reaches the member — never copied into the coordinator's orbit. a member in no lane names its ask in its ping to the coordinator
  - in mobile mode the board is out of his reach: open asks and phases print in the ⏳ fence (`x:mobile-mode`)
- **🌔 phases — the session's own plan, live.** every session keeps its next moves (≤7) through orbit's `plan` op (`lines`), reset at a turn end whenever they moved: codie's coding plan, sixth sense's review plan, the coordinator's lane plan; parked → what it waits on. dima opens any thread and sees where it is.
  - a new session seeds them the turn it starts, from its brief, spec or tickets; nothing to do yet → empty is right
  - a line leads with its subject; the mod's «no phases yet» nudge after 3 tool calls is the guard
- **🛼 glide — a lane's progress, fleet-wide.** one card per running lane on every board, its steps in order with «← we are here»; only the coordinator writes it, any other session's call is refused. the card is drawn, never read into a session's context; a member's asks sit in its subcard, and a tick there joins that member's next turn (FRM-385)

<!-- why: subject-first asks, dima 2026-10-10: the board's long lines got cut. -->
<!-- why: replies named asks by oN id; dima's o112 counted 65 unglossed-id reminders on 10-14. -->
<!-- why: his thread runs many lanes at once, and a reply's ask block got missed, pasted back unchanged or rewritten mid-read (2026-10-10, FRM-381) -->

## 🛡️ x-mod-guard — risky Bash refused

- a floor command (`rm`, a kill by pattern, a force push, `--no-verify`, …) or a known hazard shape is refused, and the refusal names the safe door; it stops that one command, never the session. the list: `plugin-x/mods/x-mod-guard/FTR.md`
- a refusal that looks wrong is a guard bug: one line to the coordinator, never a route around it

## 🔒 x-mod-holds — one writer per file

- a session's first edit of a file holds it until the file is committed, the session ends or it sits idle 30 min; another session's edit is refused, naming the holder and when it took the hold
- ask the holder or the coordinator; a Bash write to a held file is refused too

## 🫥 x-mod-redact — secrets never land in a transcript

- an api key or token a tool prints is masked in the transcript and in what the model reads: `‹sk-ant…1a2b3c4d›` (first six chars, a hash); a value in that shape is this mod at work, not a broken tool or a missing key
