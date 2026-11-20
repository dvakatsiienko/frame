# fleet mods — the cc mods every session works through

**scope:** the mods of plugin `x` (`plugin-x/mods/<name>`), the fleet's live channel to dima. one section per mod, one line per part a session meets. how a mod is built: `plugin-x/mods/AGENTS.md`.
📌 a `--bg` session draws no board: its orbit and phases stay unseen (2026-10-11), so its asks also reach its coordinator in its ping.

## 🗂️ x-mod-stash — the board

- **🪐 orbit — asks for dima.** an ask goes through the tool `mcp__x-mod-stash__orbit`, never into a reply; the tool's own text holds its ops and every rule of an ask, read there.
  - orbit switched off in 🎛️ settings → every member puts its asks in the reply as one ➡️ line each, the subject first, the pick naming its whole outcome
  - in mobile mode the board is out of his reach: open asks and phases print in the ⏳ fence (`x:mobile-mode`)
- **🌔 phases — the session's own plan, live.** every session keeps its next moves (≤7) through orbit's `plan` op (`lines`), reset at a turn end whenever they moved: codie's coding plan, sixth sense's review plan, the coordinator's lane plan; parked → what it waits on. dima opens any thread and sees where it is.
  - a new session seeds them the turn it starts, from its brief, spec or tickets; nothing to do yet → empty is right
  - a `--bg` session writes no phases: no board draws them (PK-364: 95 % of `--bg` orbit calls, ~165k tokens in the wing days); its asks still go to orbit, where glide shows them
  - a line leads with its subject; the mod's «no phases yet» nudge after 3 tool calls is the guard
- **🛼 glide — a lane's progress, fleet-wide.** one card per running lane on every board, its steps in order with «← we are here»; only the coordinator and a wing, on a lane it runs, write it; any other session's call is refused. the card is drawn, never read into a session's context; its subcard shows a member's asks as a read-only view, the asks themselves going to its coordinator (dima's o67 tick, 2026-11-11)
- **🐦‍🔥 second wind runs itself** (FRM-505, dima's o175): at 55 % context the mod sends the notice, at 65 % it is a must; finish the step, write the handoff, and the mod compacts and ingests at the turn's end; the thresholds live in 🎛️ settings

<!-- why: subject-first asks, dima 2026-10-10: the board's long lines got cut. -->
<!-- why: replies named asks by oN id; dima's o112 counted 65 unglossed-id reminders on 10-14. -->
<!-- why: his thread runs many lanes at once, and a reply's ask block got missed, pasted back unchanged or rewritten mid-read (2026-10-10, FRM-381) -->

## 🛡️ x-mod-guard — only the destructive floor is refused

- refused: a delete (`rm`, `find -delete`), a kill by pattern, a discard of uncommitted git work, a force push, a remote delete, `--no-verify` and identity flags, a raw merge, a herdr close of a live thread; every other command runs. the list: `plugin-x/mods/x-mod-guard/FTR.md`
- a refusal stops one command, never the session, and names its safe door (`trash`, `x lane merge-auto`)
- a refusal that looks wrong is a guard bug: one line to the coordinator, never a route around it

## 🔒 x-mod-holds — one writer per file

- a session's first edit of a file holds it until the file is committed, the session ends or it sits idle 30 min; another session's edit is refused, naming the holder and when it took the hold
- ask the holder or the coordinator; a Bash write takes no hold, so an edit goes through `Edit`

## 🫥 x-mod-redact — secrets never land in a transcript

- an api key or token a tool prints is masked in the transcript and in what the model reads: `‹sk-ant…1a2b3c4d›` (first six chars, a hash); a value in that shape is this mod at work, not a broken tool or a missing key
