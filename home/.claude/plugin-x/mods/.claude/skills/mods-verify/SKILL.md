---
name: mods-verify
description: Load BEFORE verifying a change under `home/.claude/plugin-x/mods/` — «verify a mod», «prove the mod», «mods:typecheck is green», «claude plugin test», «red-proof», a sixth sense round on a mod pr.
---

# mods-verify

prove a mod change with evidence the engine produced. the gates, `mods:live`, `mods:probe` and `red-proof`'s flags: see `mods/AGENTS.md`; this file holds only sixth sense's habits.

## prove

- a mod change is proven by `claude plugin test <a scratch copy>` plus a headless `claude -p --settings <file>` run, so the live mod is never the test bench (FRM-356)

- a model-backed part (the enhancer) gets one live run beside its mocked tests — `claude -p --model claude-haiku-5-5` with the real prompt files; the mocks hid the snippet expansion the live run found (FRM-382 sixth sense)
- `claude -p` inside a `while read` loop eats the loop's stdin; pass `</dev/null` (FRM-382 sixth sense)
- `mods:live` cannot show bold, the desktop layout or a real 5h reset; those stay dima's eye each round, said in the report (FRM-382 codie)

## typecheck

- a fresh worktree's `pnpm mods:typecheck` checks nothing until the engine types are copied in; seed the tree first with `x lane seed <path>` (FRM-382 sixth sense)

## mutations

- most real findings come from mutations: swap one anchor, watch the test go red, restore it, through `red-proof` (FRM-382 sixth sense: 6 of 8 findings)
- a mutation anchor matches a whole line, never a substring: `) : null}` matched a deeper-indented twin and broke the module load (FRM-382 codie)
- every tick or marker door gets a mutation proving its refusal test bites, and every rewrite door a probe inside a compound line (`&&`, `|`, `#`, a newline) (FRM-427 sixth sense retro)
