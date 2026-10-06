# fleet flow — who talks to whom, and the path work takes
**scope:** the comms model between fleet members, and the ten-stage path from dima's idea to the thing in his hands (FRM-309; the picture: [Fleet Flow v2](https://claude.ai/artifact/G8Z3kZtebCK8hSYRfsdac3)). the per-member contracts stay in their briefs
(`x:crew-coder`, `x:crew-verifier`, `craft-spawning`); this file is the map they hang on.

## the loop

dima steers cclio. cclio does the small nonblocking bits herself and delegates the rest, research
included. every reply to dima comes back through cclio; a member's own chat is a workbench, not a
channel — dima may step into it and steer there, and the member answers him there.

## per member — talks to, hears from, reply lands as

- **cclio**
  - talks to dima and every member
  - hears from all
  - lands as: the board in dima's tab
- **coder**
  - talks to cclio (one ping per assignment) and to its verifier
  - hears from cclio, the verifier, and dima when he drops in
  - lands as: a linear comment + the ping
- **verifier**
  - talks to the coder, one round line per round to cclio
  - hears from the coder
  - lands as: a dispute or a round-3 stop goes to cclio
- **designer**
  - talks to cclio (one ping per spread) and to dima when he drops in
  - hears from cclio (the brief) and dima
  - lands as: the canvas link, one line per take
- **cw** — a peer: either side opens the exchange, the shared store carries the handoffs
- **cc cloud**
  - hears from cclio (the brief, then `SendMessage` steers)
  - cannot talk back yet
  - lands as: a pr, read by cclio; its transcript through `--teleport` (`x:crew-cloud`)

## silence

a question dima has not answered means he is in another thread. the member does not wait on it:
a timed question goes to cclio, and cclio relays (the mechanics are in each brief). an ended turn
has no clock — a member watching for dima's answer arms its own timer.

## the path — ten stages, five lanes

each stage names its gate, its owner, its door and its wait budget.

1. **drop** — gate: every item gets a flowlog line with a status and a lane; owner: cclio; door: `cclio:boot`; wait: the session it lands
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
