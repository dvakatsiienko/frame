---
status: parked
until: 7 days from the build landing
---

Ticket: none · pocket PK-79 · spec `~/frame/.scratch/primer/spec.md`

# x-mod-primer — does the knowledge core reach the agent, and does the agent use it?

dima, 2026-10-12 16:01: «trace it upfront and test-drive it end to end before trusting it.» parked until the mods coder builds the mod (after mods lane l12); flips to `live` the day it lands.

## the trace — designed before the build

every delivery and every skip writes one line to the stash-style store, `primer-log:<day>`:
- `at`, `session`, `agentId` (when a subagent's call carries one)
- `signal` (`extension` · `basename` · `import` · `command` · `skill`) and its `value`
- `file` (the shelf file), `bytes`
- `verdict`: `delivered` · `deduped` · `capped` · `unwired` (no `## core` or no `when:`)

read: `jq '[to_entries[] | select(.key|startswith("primer-log:")) | .value[]] | group_by(.file)' ~/.claude/plugins/store/x-mod-stash_*.json` (the primer's own store file once it exists).

## the numbers, per day

- deliveries per file, and which signal fired them
- capped skips (the 15k-token cap): more than one a day means the cap or the cores are wrong
- files never delivered in 7 days: a wrong `when:` line
- bytes delivered per session

## the audit — uptake, graded at the verdict

10 sessions that got at least one core, picked at random from the log. for each, read the transcript after the delivery: did the agent act on a line of the core (named it, avoided its trap, used its default), ignore it while the core applied, or did the core not apply? **adopt at 8 of 10 used-or-not-applicable with 0 harmed**. the 10-12 knowledge A/B (`knowledge-ab.md`) says what to look for: a design rule or a trap acted on counts more than an api name.

## rounds

(none yet)
