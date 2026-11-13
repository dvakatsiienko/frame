# AGENTS.md: fleet stories

one problem's arc over days, told so the next session does not walk it again: what happened, the numbers, the cause, what changed, the line that keeps it away. a wrong call of ours is told plainly, with who made it and what it cost; a problem nobody caused is told the same way.

## the shape

- one dir per story: `<subject>/story.md` is its entry, every other file of that story sits beside it (measurements, briefs, scripts)
- `story.md` opens with frontmatter: `status: open | sealed`, `dates: <first> → <last>`, `tickets: [FRM-N, …]`, `tags: [<words>]`, `fed-by: incidents`
- a fact an agent needs before acting goes to a shelf file in `docs/knowledge/` (`x knowledge read <name>`), linked from the story; the story keeps the arc
- not here: the day's raw flaws (the flawlog), the day's news (the gazette), one answered question (`docs/research/`), a tool on trial (`docs/test-drive/`)

## find one

- by tag: `rg -l 'tags:.*<word>' ~/frame/docs/knowledge/fleet-stories`
- open ones: `rg -l '^status: open' ~/frame/docs/knowledge/fleet-stories`

## the stories

- [cpu-overload](cpu-overload/story.md) — why this mac hit 100 % cpu under the lanes, what held; sealed
- [guard-lockout](guard-lockout/story.md) — the guard clio grew until it locked the fleet out, and its cut to the destructive floor; sealed
- [x-live-on-commit](x-live-on-commit/story.md) — an x change on main is live at its commit, before the read; open until FRM-624
