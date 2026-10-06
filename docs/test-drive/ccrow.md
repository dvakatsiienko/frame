# test drive — ccrow, cclio's parked adviser

window: 2026-10-06 → 2026-10-20 (two weeks from the first live wake). ticket: [FRM-327](https://linear.app/x-com/issue/FRM-327). the build: `ccrow/AGENTS.md`.

## the arms

opus 5.5 medium vs fable 5.1 medium. days 1–3 silent: notes are logged, not sent, and the other arm answers the same packet as a `claude -p` one-shot (a paired, blind comparison). days 4–14 live, alternating by day; `wake` prints the restart line when the running arm is the wrong one.

## what each run logs (`~/.local/state/ccrow/notes.jsonl`)

arm, the exact model id from the transcript, effort, tokens in/out, seconds, mode, the note or `none`. verdicts: `pnpm ccrow:vet ok|miss <note-id> <why>` → `verdicts.jsonl`.

## stress list

- a systematic-mode wake during planning (a grilling, a spec)
- a day-mode wake on an ordinary lane
- a precompact wake
- the halt's «how is cclio doing overall» note
- dima talking to it directly from the Code tab or iOS
- the pin across an arm switch: the switch restarts the job, so does the pin survive, and does an idle-stopped ccrow resume on a socket line without one? (dima 2026-10-06: «i have to pin each time? not good, can this be automated?»)
- a dropped ask, an unverified claim, a repeated stumble — does it catch the ones the flawlog later holds?

## the gates (parallel's, 2026-10-06)

≥70 % of surfaced notes actionable · <1 interruption per hour · ≥1 validated catch per week · cost per run stated.

## log

one line per day: date · arm · wakes · notes / none · ok / miss · tokens · note
