# the deletion hunt — features that cost more than they give

dima, PK-472:W2 (2026-11-25): «so far we mostly add stuff, and we do not have many activities for actual cleanups and deletion of stuff we do not need. let's have it.» PK-472:W15: «dead weight absence = the fleet is healthy.»

two runs, never mixed: **features** (this one), then **clutter** on his word: old files, retros, caches, unused packages, one named list, one tick; a tick never covers a glob.

## the run

1. **his gut**: ask «what felt useless lately?»; his answer ranks first
2. **the shallow scan, the whole fleet**: every thing with its own door, listed from disk: skills, recipes, trials (`docs/test-drive`), scripts, `x` verbs, scheduled jobs, hooks, checks, tests, memories, chores in our flows, mod parts. only counts that exist: the census and the cli census below, `x fleet growth`, recipe and trial logs. a mod part enters by his gut or its fixes, marked «unmeasured». apps wait for his word
3. **the area**: print the areas from most to least suspect, each with its last deep date from `~/frame/_clio/checkup/deletion-scans.md`; he picks one. one area a run: «it is not a sweep that can be done blindly» (PK-472:W17)
4. **the deep read**: the area's suspects, one `helper` each, about 10: used (real runs, his presses), costs (fixes, turns, upkeep), gave. a working chore is judged by what it caught or changed in 30 days. safe: younger than 30 days, a safety net without his word, his own aliases and raycast unless he asks
5. **the print**: at most 5, in the reply, the shape below
6. **his tick, per item**, then its delete is planned: the tails map (callers, hooks, settings, stores, docs, memory, skills, tests, jobs, tickets, links in `~`, bytes, crow's rules, the cloud chat leaf). a small one is a helper card, a mods or cli one a signed chunk; git is the undo, what git lacks goes to `trash`, named. who deletes and when is decided with the tick (dima, 2026-11-25 17:59), so each block carries it
7. **the log**: one line in `deletion-scans.md`: `- <date> · <area> · <what goes> · <what stays, why>`

done: the area has its line, each ticked item is gone or has its ticket, and `rg --hidden '<name>'` prints nothing outside history (gazette, flawlog, handoffs, pocket archive, dated logs).

## the print

dima, PK-472:W20, PK-472:W21: «it must be very easy to read for me, and clear», «do not have any tech details unless i ask». no path, flag, id or internal label; a blank line between items:

```
✂️ **1. the retro recipe**
**what it is:** a monthly read of how lanes went
**why it's dead weight:** it ran once in three months, and nothing changed after it
**you save:** small in space; one thing less to keep true each month
**you lose:** the history of that one run, kept in git
**who and when:** me, tonight, about ten minutes
```

## the counts

- **install-census** — what is installed and what is used; judgment over counts, a `helper-lite` runs the counts (`duckdb` / `jq`):
  - **the census**: per skill, every scope (plugin, user `~/.agents/skills/`, project `.claude/skills/`, the marketplace plugins and the mods): fire count, last use, token cost, size, from the transcripts in two columns: real Skill calls (model and typed `<command-name>` loads) and reads by hand (a `Read` of a `SKILL.md`, or `cat`/`sed`/`head` on one in Bash; globs and greps excluded), so a skill run read-by-hand (matt's user-only ones, `advise-project-approach`) never shows as unused (dima, 2026-10-14); `/skill-doctor` is never the source, it overcounts ~10× (#92327)
  - **the install hunt**: everything installed, not only what fires as a skill (run #2 of the memory sweep missed the Context7 plugin: an MCP-only plugin fires no Skill call, so the census never saw it, while `rules/fleet-tooling.md` names `ctx7` as the docs door; dima, 2026-10-16: «next memory edit, we don't skip a hunt to delete not-used, stale, or stray marketplace-installed items»): `claude plugin list`, `claude plugin marketplace list`, `claude mcp list` and the folders under `~/.claude/plugins/cache/`, each with its `mcp__…` tool calls and Skill calls from the transcripts; a plugin or server whose job a door in `rules/fleet-tooling.md` or `rules/fleet-doors.md` already does, a disabled one, a marketplace with no installed plugin, and a cache folder with no install are 🔴
  - its ranked list goes to `~/frame/_clio/checkup/install-census.md`, rewritten each run
  - a 🔴 here is a removal, so it is always an orbit ask, one per item, never fixed in place; the memory sweep's prune step reads that list

- **cli-purpose** — are the `x` verbs used, is a hand-typed command worth a verb · `pnpm x:cli-census`,
  judged through `cli-drift-check`; a red line writes one pocket item per 0-call verb through `pocket-add`; plus dima's side (FRM-41): his zsh aliases and functions, raycast
  scripts and pnpm scripts, each absorb / leave / delete with its invoker, use read from `~/.zsh_history`
  — his tools are `granular`, so a verdict here is always an ask
