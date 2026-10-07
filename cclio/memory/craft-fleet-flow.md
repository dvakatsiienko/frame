# craft-fleet-flow — the path from dima's idea to the thing in his hands

the coordinator's map (FRM-309, closed 2026-10-06; the picture: [Fleet Flow v2](https://claude.ai/artifact/G8Z3kZtebCK8hSYRfsdac3)). moved out of `rules/fleet-flow.md` on dima's word (2026-10-06): only cclio picks lanes and owns the gates, so no other session pays for it; who talks to whom stays global there.

## ten stages, five lanes

each stage names its gate, its owner, its door and its wait budget.

1. **drop** — gate: every item gets a pocket item with a status and a place in its order; owner: cclio; door: `cclio:boot`; wait: the session it lands
2. **shape** — gate: dima says «shaped», skipped only on his word; owner: dima and cclio; door: `x:shape-idea`, `grilling`, `research:lanes`; wait: one session
3. **design** — gate: dima's pick on the boards; owner: the designer; door: `x:crew-designer-interview`, `x:crew-designer`; wait: first in the day, on a fresh 5 h window
4. **ticket** — gate: dima approves the exit lines, and no exit lines means no spawn; owner: cclio; door: `x:pm`; wait: the turn the work is agreed
5. **brief** — gate: `x brief check` passes and the verifier yes/no is asked; owner: cclio; door: the spawn preflight; wait: before the spawn
6. **build** — gate: the exit lines pass, each test proven by making it fail; owner: the coder; door: `x lane commit`, `mods:live`, `run-<app>`; wait: the ticket's estimate, then a ping
7. **verify** — gate: the verifier says clean, or its round-3 stop goes to cclio; owner: the verifier; door: `x:crew-verifier`; wait: 3 rounds
8. **land** — gate: merge state clean and the deploy Ready, where «no run» is never green; owner: dima merges, cclio pushes; door: `x lane ci-wait`; wait: the pr median
9. **look** — gate: one look card (what, where, try, proven, not checked — never empty), with a shot for anything rendered; owner: dima; door: `SendUserFile`; wait: his next time at the keyboard
10. **fold** — gate: a repeat lesson leaves as a guard, a verb, a check or a ticket, and a stopgap line carries `until: <ticket>`; owner: cclio; door: `cclio:halt`, `flow:report`; wait: the same day

the lane is the ticket's first body line, `lane: <name>`. cclio proposes it and silence accepts; a coder pings at a named trigger and cclio promotes.

- **freebie** — done in place, no ticket: drop, build, land, look
- **quick** — main, no pr, no verifier: drop, ticket, brief, build, land, look, fold
- **prototype** — throwaway, never lands: drop, build, look, fold
- **feature** — worktree, pr and verifier: every stage, design when it earns it
- **app / redesign** — every stage

the done test, read at every halt with `pnpm flow:report --days 14`: the `#dima-caught` lines, the `#brief` lines and the pr open → merge median per repo all go down.

Related: [[habit-cto]], [[craft-spawning]], [[craft-pm]]
