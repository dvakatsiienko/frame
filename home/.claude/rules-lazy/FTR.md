# rules-lazy — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## loads

- ✅ a prompt with a ticket id loads linear-flow
  - given a fresh session
  - when dima's prompt names `FRM-12`
  - then linear-flow is in context before the reply, and the log shows `load linear-flow by prompt`
  - decision: a task notification counts as a prompt — `UserPromptSubmit` fires on it (probed live, 2026-10-04)
- ✅ a cclio session loads linear-flow at its start
  - given a session starts, clears or compacts in `cclio/`
  - then linear-flow is in context before the first prompt, and the log shows `load linear-flow by project`
  - decision: cclio owns pm and boots with ticket ids already in context (its start hook, its gazette trail) — the replay found 17 replies naming a ticket before any other trigger, all in cclio
- ✅ the first linear command waits for the rule
  - given linear-flow is not loaded
  - when the session runs `linear issue view`
  - then the call is refused once with the rule attached, and the retry passes
  - decision: refuse once — injected context alone lands after the command is already written
- ✅ commits and prs trigger it too
  - given linear-flow is not loaded
  - when the session runs `git commit`, `gh pr create` or `x lane commit`, or writes a file with a `- ticket:` line
  - then the call is refused once with the rule attached, and the retry passes
- ✅ one load per session
  - given linear-flow is loaded
  - when a later trigger fires
  - then nothing is injected or refused
- ✅ a compaction reloads
  - given a session compacted after a load
  - then linear-flow loads again at the compaction, and `memory-load-agents-md` loads each `AGENTS.md` again at its next trigger
  - decision: reload at the compaction, never at the next trigger — the replay found a coder naming its ticket a minute after a compaction, with no trigger in between
- ✅ a subagent loads on its own
  - given the parent session loaded linear-flow
  - when a subagent runs `linear`
  - then the subagent's call is refused once with the rule attached — it shares the parent's session id, never its context

## misses

- ✅ a miss is logged
  - makes: a `miss` line in the hook's log, naming the signal
  - given a session where linear-flow never loaded
  - when a reply names a ticket id, a `linear.app` link or a `- ticket:` line
  - then the Stop hook logs a miss
- ✅ the replay gate
  - given the last 14 days of cclio and coder transcripts
  - when `pnpm memory-load:replay --days 14` runs
  - then 100 % of linear signals come after a load; below that, fix a trigger or discard
  - measured 2026-10-04, 314 sessions: cclio 1648/1648 (1023 in replies), coder 284/284 (73 in replies); other sessions 345/346 — the one miss names a worktree path (`BYT-105-gremlins`) from `ps` output, not linear work
  - a signal in a tool call is also a tool trigger, so it hits by construction; the replies are the real measure. subagent transcripts are not replayed

## the move

- ✅ linear-flow leaves the resident set
  - given the build landed
  - then `rules/` holds no `linear-flow.md`, and the resident rules shrink by about 3.7 KB
- ✅ cw keeps the rule
  - given cw calls `pm_guide`
  - then the reply carries the full linear-flow text
- ✅ one name for the path loader
  - given the rename landed
  - then a grep for the path loader's old name prints nothing outside history
