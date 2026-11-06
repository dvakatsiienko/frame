# rules-lazy — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are sixth sense's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## loads

- ✅ a prompt with a ticket id loads linear-flow
  - when dima's prompt names `FRM-12`
  - then linear-flow is in context before the reply
  - decision: a task notification counts as a prompt — `UserPromptSubmit` fires on it
  - decision: cloud chat's `pm_guide` tool is removed (dima, 2026-10-11: cloud chat never does linear work)
- ✅ a clio session loads linear-flow at its start
  - given a session starts, clears or compacts in `_clio/`
  - then linear-flow is in context before the first prompt
  - decision: clio boots with ticket ids in context — 17 replies named a ticket before any other trigger
- ✅ the first linear command or pr waits for the rule
  - given linear-flow is not loaded
  - when the session runs `linear issue view`, `gh pr create` or `x lane pr-open`, or writes a `- ticket:` line
  - then the call is refused once with the rule attached, and the retry passes
  - decision: refuse once — injected context alone lands after the command is already written
- ✅ one load per session
  - given linear-flow is loaded
  - when a later trigger fires
  - then nothing is injected or refused
- ✅ a compaction reloads
  - given a session compacted after a load
  - then linear-flow loads again at the compaction, and `memory-load-agents-md` loads each `AGENTS.md` again at its next trigger
  - decision: reload at the compaction, never at the next trigger — codie named its ticket a minute after one, no trigger between
- ✅ a subagent loads on its own
  - given the parent session loaded linear-flow
  - when a subagent runs `linear`
  - then the subagent's call is refused once with the rule attached — it shares the parent's session id, never its context

## the first edit loads its guide

- ✅ a first source edit is refused once, naming its guide
  - given a session or subagent without the guide in its own context
  - when it first edits a `.ts`, `.tsx`, `.go`, `.py` or `.sh` file
  - then the call is refused once naming the guide; the retry and later edits pass
  - decision: only the edited path counts, a command naming `.ts` fires nothing
- ✅ a loaded guide costs nothing
  - given a real `Skill` call past the last compaction, in the caller's own transcript
  - then nothing is refused; a parent's load, a mention and an unreadable transcript still fire
- ✅ a touched subject brings its shelf file
  - given `charm.land` in written text, `go get charm.land`, `go mod init`, a cask-changing `brew` verb or `mo uninstall`
  - then the call is refused once naming its `x knowledge read`
  - decision: `brew list --cask` and `brew info --cask` fire nothing, 6 of 7 replayed cask fires were reads
- ✅ a cost question brings the model cards
  - given a prompt with a token, cache or cost question
  - then the rule naming `references/model-cards.md` loads
  - decision: a question word opens the sentence, or «how much», «how many»: 13 of 14 looser hits were prose in briefs

## misses

- ✅ a miss is logged
  - makes: a `miss` line in the hook's log, naming the signal
  - given a session where linear-flow never loaded
  - when a reply names a ticket id, a `linear.app` link or a `- ticket:` line
  - then the Stop hook logs a miss
- ✅ the replay gate
  - given the last 14 days of clio and codie transcripts
  - when `pnpm memory-load:replay --days 14` runs
  - then 100 % of linear signals come after a load
  - a signal in a tool call is also a tool trigger, so it hits by construction; the replies are the real measure
- ✅ each row's fires print
  - when `pnpm memory-load:replay --days 7` runs
  - then every row prints its fires, once per transcript, grouped by tool and hit
- ✅ the guide share reads a refused call as no edit
  - given a transcript with refuse, load, retry
  - when `pnpm memory-load:guide-share --transcript <path>` runs
  - then the guide counts as loaded before the first edit
