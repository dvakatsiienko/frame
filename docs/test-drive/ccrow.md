# test drive — ccrow, cclio's parked adviser

window: 2026-10-06 → 2026-10-20 (two weeks from the first live wake). ticket: [FRM-327](https://linear.app/x-com/issue/FRM-327). the build: `ccrow/AGENTS.md`.

## the arms

opus 5.5 medium vs fable 5.1 medium. live from day 1 since 2026-10-06 (dima: «enable it live, continue measures») — the paired silent phase ran day 1 only: notes were logged, not sent, and the other arm answers the same packet as a `claude -p` one-shot (a paired, blind comparison). days 4–14 live, alternating by day; `wake` prints the restart line when the running arm is the wrong one.

## what each run logs (`~/.local/state/ccrow/notes.jsonl`)

arm, the exact model id from the transcript, effort, tokens in/out, seconds, mode, the note or `none`. verdicts: `pnpm ccrow:note-vet ok|miss <note-id> <why>` → `verdicts.jsonl`.

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
- 2026-10-10 · ccrow changed ([FRM-380](https://linear.app/x-com/issue/FRM-380)), the /advisor borrow: a `mode decision` wake at cclio's `gh pr merge` (the merge waits ≤ 90 s for the note; a tab ccrow denies the first merge and the rerun carries the note) and at a `claude --bg` spawn (no wait); a push to main stays with the Stop wake. a packet that lost blocks or tool output carries a `cut:` line with the transcript path, and ccrow reads the tail only then. measure from here: decision wakes per day, notes vs `none`, the seconds a merge waited

## /advisor head-to-head — day 0, 2026-10-10

docs ([advisor](https://code.claude.com/docs/en/advisor.md), experimental): a server tool that reads the full transcript, every tool call and result; the main model decides when to consult it (before an approach, on a recurring error, before «done»), no setting forces or caps a call; advice lands inside the main turn (an `Advising` line, Ctrl+O shows it); the advisor model must rank at or above the main model; billed at the advisor's rates against the plan; its transcript read is never cached, re-read on every call; hooks see no `tool.call`, mods see it in `result.serverToolUses`. silent: latency, tokens per call, whether it survives `/clear` or `/compact`. our env: no telemetry or non-essential-traffic switch set, `advisorModel` unset.

stress list — each run in cclio's tab beside ccrow, same fields for both (fired · note · acted on · tokens · seconds):
1. enable: `/advisor fable` in the desktop Code tab — the `Advising` line appears on the first consult; numbers: consults per hour
2. a decision turn (a lane pick, a grill pick): does it fire before the pick, and does its note change the pick — vs ccrow's wake note on the same turn
3. a recurring error (a guard refusal twice): does it fire, and say anything the refusal did not
4. a «done» report: does it catch an unverified claim (the post-clean commit case, FRM-380) — ccrow caught that one at 10:55
5. cost: `/usage` and `get_usage` deltas over one hour with it on vs off; the per-call transcript re-read at ~200k context
6. persistence: `/compact` and a restart — is it still on
7. quiet hours: a turn of plain chat — does it stay silent (ccrow's silence bar is «none»)
verdict question: borrow its timing (consult before an approach / before done) into ccrow, or replace ccrow, or keep both.

### round 1 · 2026-10-10 11:31 · a plan turn (pk-28's audit about to land)
- setup: dima set `/advisor fable` at 11:30; the running conversation keeps **Opus 5.5** as its advisor until `/clear` or `/compact` (the command's own line), so round 1 ran on opus — the fable rounds start after the next compaction (stress item 6 checks the tool is still listed then)
- advisor: fired on cclio's call before the approach; ~600 words; 5 located points — triage the researcher's edits into three buckets (apply · propose with the original · one list for his word), treat a script move or the skill split like a delete (grep the old name, bump), prune only what pk-28 resolved from FRM-267 under the ask-guard, log this round honestly, drop a resolved ask. acted on: all five. tokens / seconds: not yet measured (a sifter pass over `result.serverToolUses` in the transcript); the 5h meter moved 51 → 59 % over 11:15–11:32, mixed with other work, so no isolation
- ccrow, same window (wake 11:26): one located note — cclio steered dima from fable to opus on an unknown the docs answer (fable ranks above opus 5.5), and opus would confound the head-to-head since ccrow runs fable. acted on: yes (the ask is dropped, fable stays)
- the split: advisor reviewed the whole plan before work (process advice); ccrow caught a wrong steer in the reply (a fact check). no overlap.

- 📌 the switch: the conversation that ran `/advisor` keeps opus as its advisor until the next `/compact`; the fable rounds start after it, and stress item 6 checks the tool is still listed then

### round 2 · 2026-10-10 11:53 · a batch plan (11 verdicts, ccrow borrow, two questions)
- advisor (opus, see the switch note): fired on cclio's call after orientation; ~450 words, 6 points — apply the 11 verdicts and drop them from ⏳; the job-market sites sit behind his login, so the door is his mail; flip the stale `/advisor opus` lines; list `advisor` in habit-test-drive; the ccrow borrow is approved ideas, not a sealed lane — shape-lane it, fold idea 1 with FRM-380, log a «ccrow changed» line; answer drift and run-diorama, don't build. acted on: all six. one catch cclio had missed: the stale opus text in two files. 5h meter: 64 % after the round (no clean before-read; next round reads both)
- 📌 desktop finding (dima, 12:06): the Code tab shows no `Advising` line and no advice text; two consults (11:31, 11:53) reached cclio as tool results only. visibility for the operator = cclio relays each advice in the reply
