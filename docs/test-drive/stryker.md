---
status: frozen
until: 2026-10-31
dies-when: the verdict line below is written
---

# 🧬 stryker — mutation testing for our ts tests: does each test catch a real bug?

Ticket: none

born 2026-10-15 on dima's word (matt pocock's «mutation testing is awesome» short). `@stryker-mutator/core` +
`@stryker-mutator/vitest-runner` 10.0.0 in frame, config `stryker.config.json`, output in `.stryker/` (gitignored).
our `red-proof` is the hand-run single mutant; stryker runs every mutant of a file.

**test card:** we believe a mutation score shows which of our tests catch nothing, and agents write tighter tests
from its survivor list · we test it by a run on `script/lib` modules a codie or clio touched, survivors read and
killed · we measure the mutation score before and after, minutes per run, tests added per survivor killed, false
survivors (equivalent mutants) · we're right if a run names at least one real gap per module and stays under ~2 min
on a touched file

**kill rule:** two upstream releases still break the vitest 5 runner · survivors mostly equivalent mutants

## stress list

- one touched file, `--mutate <file>` — `script/lib/agent-trailer.ts` (10 tests)
- `--incremental` across two runs — reuse of the previous result
- a mod (outside vitest, its own runner) — the command runner, `--testRunner command` (untried)
- go — gremlins for `x` (untried, later)

## rounds

- 2026-10-15 · day 0 on `agent-trailer.ts` · 45 mutants, 0 killed, 0 % covered, 1 s · ⚠️ not a test verdict: the
  vitest runner never activates a mutant on vitest 5 — upstream [stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210)
  (the per-test name filter matches nothing on vitest 5), watched in x-changedetector · two config workarounds on the
  way: `tsconfigFile` points at no file (typescript 7 has no `parseConfigFileTextToJson`), `ignorePatterns` keep the
  sandbox to `script/` (a socket under `.claude/worktrees` broke the copy) · frozen until #6210 ships

## verdict
