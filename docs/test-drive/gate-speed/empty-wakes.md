# Empty wakes of clio's main session, before and after 83fe5188

## Fix start
`83fe5188` found: 2026-11-05 20:31:44 +0200, "pr-watch: wake clio only on a stamped green, a red check or a conflict".

## Sessions counted (main `🦉 clio`)
- 9939ff19-1907-40f1-a889-f458e677ef48 (2026-11-05 14:50Z to 11-06 01:37Z). Predecessor, titled `🦉 clio` in the transcript; not in sessions/*.json any more (inferred main: same cwd and title).
- 89a213e9-b64e-4fdc-b88d-0cce686988a7 (2026-11-06 11:43Z to 18:53Z). Named exactly `🦉 clio` in sessions/*.json.
- Excluded: wing 1 (2e3b8126), wing 2 (f0ffdfb0), `clio (side)` aa782c73, probes, and ~10 tiny untitled files of 38-47 lines.

## Classifier
- Turn start = a user-role record that is not a tool_result.
- app wake = holds `finished a turn`, `<task-notification`, `side-sessions-event` or `Cross-session idle notice`. Openings seen (both windows, 29 h, turn-starting only): task-notification (~50), `The session "🌗 🔧 codie: mods lane 5` 65, `The session "🦉 clio (side)"` 55, `The session "⚡ 🔧 codie: mods lane 5` 8, `The session "🦉🪽 clio: wing 2"` 6, `[Cross-session idle notice]` 14. No separate Monitor or watch event shape exists in the transcripts; pr-watch arrives as one of the above (inferred).
- member = text starts `Another Claude session sent a message` (a note that only quotes a cross-session-message is an app note, not a member).
- Not wakes (excluded, `meta`): skill bodies, `Stop hook feedback`, /compact and handoff-ingest plugin lines, image stubs. Everything else = dima's.
- bare reply = turn after an app wake with assistant text under 200 chars. The "changes nothing visible" part is read only by tool names: "read-only" = no tool calls or only Read/Grep/Glob/ToolSearch. Bash is not readable cheaply, so it counts as a change (this undercounts bare). Text length alone is the headline.
- Mid-turn deliveries (transcript `queued_command` attachments) start no turn of their own; counted separately as deliveries.

## Baseline: 2026-11-05 18:49 to 20:20 local (1.52 h)
- app wakes 24 (turn-starting); bare by text length 15 (reminder said 14: close); bare read-only 4.
- member: 2 turn-starting, 12 with mid-turn deliveries (reminder said 54: FAR OFF). Retried once counting mid-turn deliveries, then retried with the window read as UTC; still 12 and 16. The 54 came from a count I cannot reproduce.
- dima-typed 3.

## After: 24 h from the fix, 11-05 20:31:44 to 11-06 20:31:44 local (window ends 20:31, now is 20:53)
Main was alive only about 13.9 h of the 24 (a gap 03:37 to 13:43 local, nobody running).
- app wakes 263 turn-starting (392 with mid-turn); bare by text 158; bare read-only 79 (76 with no tool at all).
- member: 85 turn-starting, 156 with mid-turn.
- dima-typed 43.

## Rates per hour
| | baseline (1.52 h) | after, per clock hour (24) | after, per live hour (13.9) |
|---|---|---|---|
| bare replies (text) | 9.9 | 6.6 | 11.4 |
| bare read-only | 2.6 | 3.3 | 5.7 |
| members, turn-starting | 1.3 | 3.5 | 6.1 |
| members, with mid-turn | 7.9 | 6.5 | 11.2 |
| dima-typed | 2.0 | 1.8 | 3.1 |

## Reading
- Per live hour, bare replies did not fall (11.4 vs 9.9); per clock hour they look lower only because of the idle night. Members rose. Dima typed more per live hour, so load is not equal.
- Sample is tiny on the baseline side (24 wakes, 91 min); the member baseline did not reproduce, so that comparison is weak.
