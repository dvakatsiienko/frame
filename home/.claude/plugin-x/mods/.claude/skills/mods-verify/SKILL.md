---
name: mods-verify
description: Load BEFORE verifying a change under `home/.claude/plugin-x/mods/` — «verify a mod», «prove the mod», «mods:typecheck is green», «claude plugin test», «red-proof», a sixth sense round on a mod pr.
---

# mods-verify

prove a mod change with evidence the engine produced. the gates, `mods:live`, `mods:probe` and `x verify red`: see `mods/AGENTS.md`; this file holds only sixth sense's habits.

## prove

- a pr's new mod tests are proven red on base's source by `x lane verify-tree <head> --revert <base> <hooks paths> -- pnpm mods:test <mod>`, in the verify tree, so the live mod never sees the swap
- a mod change is proven by `claude plugin test <a scratch copy>` plus a headless `claude -p --settings <file>` run, so the live mod is never the test bench (FRM-356)

- a model-backed part gets one live run beside its mocked tests — `claude -p --model claude-haiku-5-5` with the real prompt files; the mocks hid the snippet expansion the live run found (FRM-382 sixth sense)
- `claude -p` inside a `while read` loop eats the loop's stdin; pass `</dev/null` (FRM-382 sixth sense)
- `mods:live` cannot show bold, the desktop layout or a real 5h reset; those stay dima's eye each round, said in the report (FRM-382 codie)
- `grep -i skipped` over every `--extra` probe log: a skipped hook reads green (FRM-499 sixth sense)
- a probe needing a quiet window past `FIELD_QUIET_MS` sleeps real time, `test(name, { timeout }, body)` (FRM-492 sixth sense)
- a new warn-only rule sits inside the run's one exit, after `next`, so every enforced rule reads first (FRM-486 sixth sense, FRM-513 codie)
- `mods:live click` misses a wide emoji chip: it reads found, no press lands, exit 0; time a press by another door until `live.ts` counts cell width (FRM-513 codie)
- a gate's row carries one real plant through the real hook before a clean (FRM-473 sixth sense)
- a change to a list other hooks grow gets a `Promise.all` row with a prompt in it (FRM-501 sixth sense)
- a rows probe of a Bash rule runs `pnpm mods:probe <mod> --rows <tsv>`; a row needing a test's setup runs `pnpm mods:test <mod> --extra <file>`, its setup copied from `ticks.test.ts` or `orbit.test.ts` until FRM-489 makes it importable, never a `cp -R` of the mods tree (FRM-510 sixth sense)
- a change to quiet's hold or delivery ends on `pnpm mods:quiet-delivery-test`: a model-free test ping to clio, read held → delivered (FRM-501)
- a 5 s timeout on a shifting set of tests, or the retired bash door's «restored fails» at load over 15, is load: rerun serially before judging, until FRM-470's bound lands (FRM-498, FRM-499 sixth sense)

## typecheck

- a fresh worktree's `pnpm mods:typecheck` checks nothing until the engine types are copied in; seed the tree first with `x lane seed <path>` (FRM-382 sixth sense)

## mutations

- a pane that renders several board nodes needs a test seam that plants a throw in one node, so one bad node is proven not to blank the board (FRM-431 codie)
- a plant run from a `--bg` (cli-entrypoint) session is proven with `mods:live --plant` under that entrypoint: user settings' env beats the swapped plugin dirs there (FRM-470 sixth sense)
- most real findings come from mutations: swap one anchor and watch the test go red, through `x verify red`, off the tree (FRM-382 sixth sense: 6 of 8 findings)
- a revert proof mutates behaviour and keeps every module: a deleted file reds on its import, which proves nothing (FRM-477 sixth sense)
- run the head's tests against the base source in a scratch copy, then list the new tests still green: those tests do not bite (FRM-472 sixth sense)
- a mutation anchor matches a whole line, never a substring: `) : null}` matched a deeper-indented twin and broke the module load (FRM-382 codie)
- every tick or marker door gets a mutation proving its refusal test bites, and every rewrite door a probe inside a compound line (`&&`, `|`, `#`, a newline) (FRM-427 sixth sense retro)
