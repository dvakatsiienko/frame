---
status: closed
until: 2026-10-12
---

Ticket: none · pocket PK-79

# knowledge A/B — does a refreshed mods knowledge base change how a coder codes? (2026-10-12)

dima, 19:19: «i'd like to know the difference between a mods coder with knowledge and without knowledge.» two opus 5.5 medium coders, the same task each round: arm A in a detached tree from before the refresh-cc-mods run #4 distill (2df7746e), arm B on main after it (3affcfc7).

## rounds
- round 1, the phases nudge quiet window (pure mod logic): A ~5 min, 2 tests, 0 lookups; B ~5 min, 1 test, 0 lookups — a tie; the task never touched what the distill added
- round 2, quiet's native alarm (needs the 2.1.295 api): A ~4 min, 4 tests, 1 lookup in the types, docs silent on the api; B ~6 min, 7 tests, 1 lookup, docs named the api but not its desktop gap — both found `$.ui.notify` answers `no-surface` on the desktop and fell back to osascript

## verdict
closed, n=2, small. on «how to code it» the refreshed docs changed neither speed nor the outcome: both coders read the generated types directly, which the old AGENTS.md already told them to do. where the knowledge paid is «what to build»: the mainline coder's retro B names a real defect (quiet's silent loss path) that research 6 described before it shipped. so a knowledge refresh earns its keep on design and pitfalls, less on api lookup. confounds: arm B was a warm session, arm A fresh; both tasks were small.
