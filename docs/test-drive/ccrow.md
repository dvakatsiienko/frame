# test drive — ccrow, cclio's parked adviser

window: 2026-10-06 → 2026-10-20 (two weeks from the first live wake). ticket: [FRM-327](https://linear.app/x-com/issue/FRM-327). the build: `ccrow/AGENTS.md`.

## the arms

opus 5.5 medium vs fable 5.1 medium. live from day 1 since 2026-10-06 (dima: «enable it live, continue measures») — the paired silent phase ran day 1 only: notes were logged, not sent, and the other arm answers the same packet as a `claude -p` one-shot (a paired, blind comparison). days 4–14 live, alternating by day; `wake` prints the restart line when the running arm is the wrong one.

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
- 2026-10-06 · day 1 silent, paired · 16 notes; 4 graded ok (the uncommitted pile before implement-spec, flagged from 17:46, ahead of cclio; .scratch absent in worktrees) · dima: «i also think it is very useful and worth sharpening» → live from day 2, a fleet member

- 2026-10-08 · run 2 of refresh-crew-coordinator-adviser landed: the contract moved into `x:crew-adviser` (timing hold + `also held`, `predicts:` lines, 4 new or reshaped hunts, a 1-in-5 holdout to 10-20). 19:16 live note (5h wall) → ok, acted on. effort stays medium on both arms (dima: fable high is too much)
- 2026-10-09 keep-hot, parked overnight (session 9c8d2cd8): the stash ping fired every 50 min from 01:47 to ~11:51 local; after the 03:27 ping the turn read 299,003 cached and wrote 95, so the cache held warm across each gap. it pinged a parked session all night, ~11 pings × ~299k cache reads (cost inferred, not measured)
