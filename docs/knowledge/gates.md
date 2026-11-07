---
fed-by: incidents
when:
  - { kind: basename, value: lefthook.yaml }
  - { kind: basename, value: index-run.sh }
---

# gates — every check that can stop work, its job, its cost

Ticket: PK-334. A gate here is a check that refuses: it stops a commit, a push, a merge, a summon or a turn. A nudge that only warns is not one. A new gate gets its line in the same commit; a gate that goes gets its line cut. Cost: `gate-steps.log`, 2026-11-06 22:00 to 11-07 16:30, p50 and p90 seconds at the load of that day.

## core

- **a commit waits for its slowest parallel step**, so one cheap red still waits for the rest: a 0.27 s memory-lint red reported after a 32 s test run
- the commit's cost is the test step, 28 s p50, and the mods suite, 102 s p50 before FRM-521's skip; the rest is under 3 s each, except mods typecheck and replaced doors, 13 s each
- only commit-time gates carry a time; a red in a commit hook never comes from cost or load (`docs/test-drive/gate-speed.md`), so a cpu budget sits at the go doors (FRM-528)

## at commit, files

- format: biome on the staged files, 2 s
- typecheck: the private copy of the commit, 2 s, p90 5
- test: vitest, whole or related to the staged paths, none for a pocket-only commit, 28 s, p90 40
- mods: mods typecheck and skew, on a mods change, 13 s, p90 48
- mods-test: the touched mods' suites, skipped on bytes a green overlay read, 102 s, p90 225; read again on 11-13
- fleet-hazards: a hazard line names its guard, on that file
- memory-lint: a size budget per memory file, merged bullets, a file with no row, 2 s
- replaced-doors: a memory note naming a door x retired, on a memory change, 13 s, p90 26; a go build for one test, the priciest small gate
- git-crypt-rename: a moved encrypted file keeps its filter, 2 s
- retired-names: the 10-29 rename's old forms in an added line, 2 s; temporary, its row says 14 green days and a ticket remove it
- chords-essentials, speak-essentials: bytes' app checker, on that app

## at commit, the message

- commit-msg-lint: the `x:cmt` format
- lane-gate: `x lane gate`, a contract with its glossary, an app's code with its FTR line, a crew or guide skill never only grows
- no-ci-skip-marker: a marker that silently makes no ci run
- session-trailer, agent-trailer: these edit, never refuse: not gates, listed since they share the hook

## at push

- runner-twin: vitest in a clean clone, empty HOME, the ubuntu runner's view, 43 s, p90 64
- mirror: `pnpm frame:link`, the manifest still derives
- on main: `x lane push`'s whole go run

## on the pr

- ci: check + typecheck + test; Test x, `pnpm x-go:test`
- review-round: the ci reviewer's round
- sixth sense: its clean on the head, read by `x lane merge-auto`
- `x lane merge-auto`: clean, required ci, threads closed, a self-edit's word
- `x lane landed`: the after-merge chores; it reports, a red keeps the ticket open

## by hand before a lane or a proof

- `pnpm x-go:gate`: gofmt, vet, staticcheck, go fix, go test
- `red-proof`: a test goes red when its line is mutated
- `x brief check`, `x brief summon`, `x brief preflight`: a brief's names, a summon's steps, a spec's exit lines
- `x lane dispatch`: a chunk carries its sign
- `pocket-check`, `script/wish-cover.ts`, `prompt-groom.ts --day`: the pocket, a wish's lines, the day's prompts

## in a session

- `x-mod-guard`: a risky Bash command, an `Agent` brief, a write outside a fork's tree
- `x-mod-holds`: one writer per file
- reply-check: warns at the next prompt, so a nudge, listed for its name
- `siesta-gate.ts`: a siesta due blocks once
