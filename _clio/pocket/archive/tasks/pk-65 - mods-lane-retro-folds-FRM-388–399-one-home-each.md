---
id: PK-65
title: 'mods lane retro folds (FRM-388–399), one home each'
status: done
assignee: []
created_date: '2026-10-11 19:26'
updated_date: '2026-10-12 17:11'
due_date: '2026-10-12'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
from ~/.claude/shelf/retros/2026-10-11-mods-lane-coder.md, lane l4 ended 22:21 (dima). each candidate → its home, decided at the halt:
- x registry lint: refuse a verb deeper than the dispatcher supports (FRM-388's three-word verb fell to «edit») → an x ticket
- x mods edit push: print the overlay pass count; refuse a pull of a file a stale pull already holds → an x ticket
- a new guard rule says up front whether it reads the typed or the rewritten command → one line in plugin-x/mods/x-mod-guard FTR or mods/AGENTS.md
- cclio:shape-lane seal: read the app's AGENTS rules against the exit lines (FRM-398's «refused» exit vs mods' «warn-only until a verifier's clean») → one seal line
- a board or band change: a shot of the board with every card open, and the redraw cost measured, before the brief (FRM-397 strip, the sticky board) → one shape-lane line
- cclio: re-read a member's state before sending a steer; queued steers crossed its reports 3× → craft line or nothing (the queued-steer re-check already exists)
- the guard's door text still spells `--as coder`: `x-mod-guard/hooks/rules.ts:236`, `FTR.md:170`, `tests/linear.test.ts:54` (wishkeeper 22:30) → a coder job through `x mods edit`
- `x lane mutate` moved to PK-68 (the x lane verbs)
- from the FRM-400 coder retro (2026-10-11): `x mods edit push --add` takes one comma list, a second `--add` silently replaces the first, and its usage line hides it → fix the flag or the usage line
- FRM-400: `x mods edit test` prints the first ❯ line (a manifest warning) as the error and hides the real ✘ → print the ✘ line
- FRM-400: `mods:live --as <dir>` that swaps the mod in the child's own CLAUDE_CODE_PLUGIN_DIRS (as mods:probe does), so a before/after board look is one command
- FRM-400: `x lane commit` formats but does not organise imports; biome's organizeImports refused one commit
- from the 10-11 halt flush: `x mods edit push` runs `claude plugin validate` on the dev copy and refuses on red (it broke the live stash twice, FRM-385); a refused push prints «nothing written», never «synced» (3 readers took a refusal for success); `x mods edit test` takes `--add` like push; x-mod-stash re-primes the phases nudge after `/clear` (`isPrimed` is process-wide)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: behind the 2026-10-12 drops — dima: «don't rush the memory sweep — solve everything new turn by turn, quality first, then plan the next moves from the new drops»

19:26: the mods-code lines → lane l12 item 6; the x mods edit lines → the cli lane (PK-94); the shape-lane seal lines stay cclio's.

done 20:12: mods lines → lane l12 item 6, x mods edit lines → PK-94 (cli lane), seal lines → cclio:shape-lane (cclio plugin bumped).
<!-- SECTION:NOTES:END -->
