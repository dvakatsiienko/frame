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

## 2026-11-07 round: the widest day, 11-06 12:00 to 11-07 04:20

From `quiet-log:*` in x-mod-stash's store, every coordinator session (main and wings), read 11-07 04:47: 600 lines, 116 of them flushes repeating held ones, so 484 messages.
- no turn: 177 lone notices logged, 115 held, 75 passed mid-turn
- started a turn: 72, 15 %: 43 done, 24 ask, 3 escalate, 2 untagged; 0 lone notices
- retro card's classifier over main alone: 27 of 368 machine wakes did nothing, 26 only logged, about 14 %
- not read here: alarm keys (FRM-501's second number), and the baseline over 5 codie chunks that FRM-368's gate asks

## 2026-11-12 round: 11-11 12:00 to 11-12 04:00

From `quiet-log:2026-11-11` and `quiet-log:2026-11-12` (store keys are UTC days) in x-mod-stash's store `~/.claude/plugins/store/x-mod-stash_inline-99d499f0f4e0.json`, every coordinator session, lines with `at` in 10:00Z to 02:00Z, read 11-12 14:07: 492 lines, 134 of them flushes repeating held ones, so 358 messages. The 11-11 key held 477 lines, under its 500 cap, so nothing was cut; its first line is 13:34 local.
- no turn: 134 held, 74 passed mid-turn, 25 lone notices logged
- started a turn: 125, 35 %: 69 done, 44 ask, 9 escalate, 3 untagged; 0 lone notices
- the file's Classifier over main alone (`f6de81e0` and `1e70bf35`, both `🦉 clio`; 1e70bf35 resumes f6de81e0 and shares 10558 record uuids, so records are counted once by uuid), read 11-12 14:07: 87 machine wakes, all `<task-notification` (0 member wakes, 0 `The session` or idle-notice wakes); did nothing 1 (bare by text under 200 chars and read-only, 1 %); bare by text 17, 20 %; only logged: not reproduced
- the 11-07 «retro card» classifier: not reproduced, its script is not on disk, so «did nothing» and «only logged» are not counted the card's way
- reading: turn-starting went 15 % to 35 % and empty went about 14 % to 1 % (lower bound) or 20 % (bare by text), and neither pair is comparable. Turn-starting is the same stash-log read on both days, but the 11-07 read (600 lines, source keys not stated) cannot be rebuilt, since the 11-06 key sits at its 500-line cap today; this window has 358 messages against 484, and the mix differs (11-07 held 115 and passed 75 mid-turn against 134 and 74 here). The empty number is not comparable at all: 11-07's 27 + 26 of 368 came from the retro card's own classifier, over a wider window with member and session-ping wakes; here the Classifier section is run on a window where main got only task-notifications, and «only logged» has no definition in it, so 1 % undercounts and 20 % counts every short reply, 16 of them after a Bash call.

## verdict, 2026-11-12 15:55 (dima's o21 tick)
- the quiet hold does its job: over 11-11 12:00 to 11-12 04:00, main took 87 machine wakes, all its own job notices, 0 member wakes, 1 that did nothing; of member messages that started a turn, all but 3 were tagged done, ask or escalate. the re-count reminder is dropped; no further round is planned.

## correction, 2026-11-12 16:35 — the 15:55 verdict is withdrawn
- the 11-12 round's classifier skipped every cross-session message: main's transcript holds 122 «Another Claude session sent a message» rows in that window (wishkeeper's count), and wing 1's siesta recount found 166 untagged or progress pings; «0 member wakes, 1 did nothing» was the instrument's blind spot, not the fleet
- the re-count reminder is back (`_clio/memory/_reminders.md`), due 2026-11-14, with a classifier that reads cross-session rows
