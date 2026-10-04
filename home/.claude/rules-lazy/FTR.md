# rules-lazy — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## loads

- 🧭 a prompt with a ticket id loads linear-flow
  - given a fresh session
  - when dima's prompt names `FRM-12`
  - then linear-flow is in context before the reply, and the log shows `load linear-flow by prompt`
- 🧭 the first linear command waits for the rule
  - given linear-flow is not loaded
  - when the session runs `linear issue view`
  - then the call is refused once with the rule attached, and the retry passes
  - decision: refuse once — injected context alone lands after the command is already written
- 🧭 commits and prs trigger it too
  - given linear-flow is not loaded
  - when the session runs `git commit` or `gh pr create`
  - then the call is refused once with the rule attached, and the retry passes
- 🧭 one load per session
  - given linear-flow is loaded
  - when a later trigger fires
  - then nothing is injected or refused
- 🧭 a compaction reloads
  - given a session compacted after a load
  - when the next trigger fires
  - then linear-flow loads again; the same holds for `memory-load-agents-md`

## misses

- 🧭 a miss is logged
  - makes: a `miss` line in the hook's log, naming the signal
  - given a session where linear-flow never loaded
  - when a reply names a ticket id, a `linear.app` link or a `- ticket:` line
  - then the Stop hook logs a miss
- 🧭 the replay gate
  - given the last 14 days of cclio and coder transcripts
  - when `pnpm memory-load:replay --days 14` runs
  - then 100 % of linear signals come after a load; below that, fix a trigger or discard

## the move

- 🧭 linear-flow leaves the resident set
  - given the build landed
  - then `rules/` holds no `linear-flow.md`, and the resident rules shrink by about 3.7 KB
- 🧭 cw keeps the rule
  - given cw calls `pm_guide`
  - then the reply carries the full linear-flow text
- 🧭 one name for the path loader
  - given the rename landed
  - then `grep -rn agents-travel` prints nothing outside history
