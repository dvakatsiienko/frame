# craft-fleet-flow — the path from dima's idea to the thing in his hands

the coordinator's map; the picture: [Fleet Flow v2](https://claude.ai/artifact/G8Z3kZtebCK8hSYRfsdac3). who talks to whom is `rules/fleet-flow.md`.

<!-- why here: moved out of rules/fleet-flow.md on dima's word (2026-10-06, FRM-309): only cclio picks lanes and owns the gates, so no other session pays for it -->

## ten stages, three kinds of work

each stage names its gate, its owner, its door and its wait budget.

1. **drop** — gate: every item gets a pocket item with a status and a place in its order; owner: cclio; door: `cclio:boot`; wait: the session it lands
2. **shape** — gate: dima says «shaped», skipped only on his word; owner: dima and cclio; door: `cclio:shape-idea`, `grilling`, `research:lanes`; wait: one session
3. **design** — gate: dima's pick on the boards; owner: the designer; door: `x:crew-designer-interview`, `x:crew-designer`; wait: dima's word on when (2026-10-21: he watches the 5h window himself)
4. **ticket** — gate: cclio writes and preflights the exit lines (`x brief preflight` passes; never dima's to review), a side lane seals its exit lines from the spec (`cclio:shape-lane` § 2.5), and no exit lines means no spawn; owner: cclio; door: `cclio:shape-lane`, `cclio:pm`; wait: the turn the work is agreed
5. **brief** — gate: `x brief check` passes and the verifier yes/no is asked; owner: cclio; door: the spawn preflight; wait: before the spawn
6. **build** — gate: the exit lines pass, each test proven by making it fail; owner: the coder; door: `x lane commit`, `mods:live`, `run-<app>`; wait: the ticket's estimate, then a ping
7. **verify** — gate: the verifier says clean, or its round-3 stop goes to cclio; owner: the verifier; door: `x:crew-verifier`; wait: 3 rounds
8. **land** — gate: merge state clean and the deploy Ready, where «no run» is never green; owner: cclio merges by the gate in `docs/knowledge/pr-flow.md` § core — risky paths named in the look card, a self-edit and the brake waiting for dima (dima, 2026-10-22: he does not read prs); cclio pushes; door: `x lane merge-auto`, `x lane ci-wait`; the turn it lands, its spec dir moves to `.scratch/_archive/<feature>/` and its round line joins `docs/test-drive/review-rounds.md`; wait: the pr median
9. **look** — gate: one look card (what, where, try, proven, not checked — never empty), with a shot for anything rendered; owner: dima; door: `SendUserFile`; wait: his next time at the keyboard
10. **fold** — gate: a repeat lesson leaves as a guard, a verb, a check or a ticket, and a stopgap line carries `until: <ticket>`, and a changed mapped area gets its blueprint redrawn once the steers land (`cclio/blueprints/AGENTS.md`); owner: cclio; door: `cclio:halt`, `x fleet flow`; wait: the same day

the lane is the ticket's first body line, `lane: <name>`. cclio proposes it and silence accepts; a coder pings at a named trigger and cclio promotes. a lane's 🛼 glide title reads `<topic> — <what>`, one colon only, the card head's (dima, 2026-10-12).

- **freebie** — done in place, no ticket: drop, build, land, look; a small UI ask on atelier or speak still goes to a coder with its `DESIGN.md` + a screenshot, and leaves a `docs/test-drive/design-drift.md` rounds line
- **quick lane** — on main, no pr, a verifier optional, on dima's yes/no (`main:<base sha>`): drop, ticket, brief, build, land, look, fold; a prototype is a quick lane that never lands
- **side lane** — worktree, pr and verifier: every stage; an app or redesign opens with shape and design

the done test, read at every halt with `x fleet flow --days 14`: the `#dima-caught` lines, the `#brief` lines and the pr open → merge median per repo all go down.
