# card craft — how a subagent card earns its calls

what the 2026-10-19 scout shaping learned, kept for every card and every `refresh-crew-coordinator` run. sources: `_clio/.scratch/shape-scout/` (research.md, neuroarxiv.md, critique.md, read-ceiling.md), archived with the lane.

## the description is the trigger

- the main agent picks a card from its description alone; name the situation it is in («before you read code you have not opened»), never only the task («grep for symbols»)
- lead with «use proactively» plus the moment, then what comes back, then when not to call it
- never name a job cc's own Agent tool text tells the model to keep («a few file reads or searches» → do it yourself): a card aimed there gets 0 calls (scout, 84 codie sessions, 21 days)
- one trigger per card: two that can conflict («not opened this session» vs «a known file») make the pick inconsistent; the `when not` line breaks the tie
- proven only by use: a bare cc run with 10 prompts of the right shape, the picks counted, or the transcript count after a week — reading a description never proves it fires

## the answer is a contract

- the card's body fixes the reply's shape and a line cap; the caller's context is the budget it spends
- a locating card returns pointers (`path:start-end`, the one line that proves it), never bodies or summaries — a quote cannot be wrong the way a summary can
- a truncated answer says so (`cut: N more`); a «found nothing» line says it is a record of the search, not proof of absence
- two passes inside, navigate then confirm, so nothing unconfirmed reaches the caller

## model, effort, tools

- the cheapest tier that finds as much, proven by a race on real tasks at a frozen commit — no paper or vendor note settles Haiku vs Sonnet for a given card
- effort `low` for mechanical cards; a hard review or an exact count moves it per call
- tools: only what the job needs; a read-only card keeps Bash to named read commands, LSP when symbols matter
- `omitClaudeMd: true` unless the job needs fleet memory: ~12k floor instead of ~80–117k

## measure what a card saves before building reach

- the ceiling first: what share of the callers' context the card could replace at most (scout: reads of never-edited files, 8 % of codie tool output, p90 22 %; the earlier 76 % counted base64 screenshots)
- a nudge (a hook, a guard hint) is replayed over past transcripts before it is built: fires per session and the share of wrong fires (a pre-read hint: 9 fires in 87 sessions — not built)
- the pass line is written before the trial: net tokens of card plus caller, quality (sixth sense rounds), never «the card got called»
- a shaping plan goes through `pnpm -C ~/frame crow:plan-critique <file>` before the build
