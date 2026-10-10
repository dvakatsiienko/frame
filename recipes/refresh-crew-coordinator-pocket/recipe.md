---
kind: refresh
owner: coordinator
artifacts:
  - cclio/script/pocket-check.ts
  - cclio/memory/habit-shared-files.md
  - cclio/backlog.config.yml
  - docs/test-drive/pocket.md
script: none
groomed: 2026-10-10 (dima)
---

# refresh-crew-coordinator-pocket

keeps cclio's pocket true to its purpose: no drift, no clutter, easy items never parked, the pocket pulled often.

born 2026-10-10 from PK-34.

## the want

- shaped with dima, 2026-10-09: no drift, no clutter, easy items never parked, pulled often. «readable on your phone is not the requirement for pocket»
- «the pocket is for things to be done first, and for things not meant for the long shelf. linear is the long shelf, for bigger settled wishes i allow to wait. moving an item from the pocket to linear is postponing, not solving. keeping items in the pocket is fine; cluttering it is not» (dima, 2026-10-10)
- «pocket must reflect true state always — i often look at it, stale state is not allowed» (dima, 2026-10-10)
- «the pocket must be efficient for you to work over, and convenient for me to peek inside and edit. ideally it is an agent-friendly framework for managing todos right on my fs, so your access there is fast.» (dima, 2026-10-10)
- «the pocket is flexible and customizable — item types, labels, connections: everything a good ticket management tool could give an agent.» (dima, 2026-10-10)

## the run

- suggest a run when: a Backlog.md minor release, `pocket-check` goes red twice in a week, or the pocket trial verdict (2026-10-21)

1. **groom** (step 0 of `x:shape-recipe`): the vectors below against the last run's line and the birth gate in `cclio/memory/habit-shared-files.md`. done: dima's word, the stamp in frontmatter. (open)
2. **own data first**: the analysis vectors, measured from `cclio/pocket/` (tasks, completed, archive) and its git history. done: the numbers in the findings print. (script)
3. **lanes, from one brief**: `researcher` + `pnpm research:lanes`, pointed at what step 2 showed broken. done: every lane landed or failed out loud. (template)
4. **distill** into the artifacts: a gap closed by a Backlog.md feature replaces our own check, never sits beside it. done: each artifact touched or named «unchanged». (open)
5. **log** today's line. done: `log.md` has it.

## vectors

### research

- Backlog.md, beads, tasks-axi: releases that close our gaps — a stale check, sizes as a field, custom fields, a native waiting state
- new agent-facing trackers since the last run, and what they borrow from human ones
- intake triage: how users of agent trackers turn a fat drop into ordered items without losing one
- staleness: how others detect an item nobody touched, and what they do with it
- the full feature set a ticket tool gives an agent: types, labels, relations and dependencies, milestones, ordering, custom fields; which ones Backlog.md has, which we use, which we miss
- the human side of an agent-first tracker on the fs: board and web views, editor integration, how a person peeks and edits without breaking the agent's files

### analysis

- frontmatter drift: items whose status, size or `ticket:` line disagree with reality
- item age spread: open items by age; an `xs` older than a session is a birth-gate miss
- created vs resolved per week; the open count against the cap of 5
- items that went to linear without dima's word (a postponement posing as a solve)
- `#dima-caught` flawlog lines about the pocket since the last run
- the agent's cost per pocket op: boot tokens for the pocket, cli calls vs raw file reads, failed or retried `backlog` calls in transcripts
- dima's own touches: his edits to pocket files (commits without an `Agent:` trailer) and his «what's next?» asks the order should have answered

## artifacts

- `cclio/script/pocket-check.ts` — the mechanical contract; a vector that finds a new drift kind becomes a check here
- `cclio/memory/habit-shared-files.md` — the pocket's purpose and birth gate; changed only where the run proved a rule wrong
- `cclio/backlog.config.yml` — statuses, types, size labels
- `docs/test-drive/pocket.md` — the trial and its numbers

## findings

the print carries the parts of `x:shape-recipe`: decisions · facts that move something · prior art (only what is interesting) · the checklist · open.

the checklist, every run: the birth gate rule by rule (xs solved, bigger in order, linear on his word, waiting with its line, parked with its reason, done completed) — held or broken, with the count.
