# craft-fleet-flow — the path from dima's idea to the thing in his hands

the coordinator's map; the picture: [Fleet Flow v2](https://claude.ai/artifact/G8Z3kZtebCK8hSYRfsdac3). who talks to whom is `rules/fleet-flow.md`. **this file is lane init's one home** (§ lane init): `cclio:shape-idea`, `cclio:shape-lane` and `cclio:shape-lane-dispatch` hold the steps and point here for the rules; the words live in `rules/fleet-vibe.md`.

<!-- why here: moved out of rules/fleet-flow.md on dima's word (2026-10-06, FRM-309): only cclio picks lanes and owns the gates, so no other session pays for it -->

## ten stages, three kinds of work

each stage names its gate, its owner, its door and its wait budget.

1. **drop** — gate: every item gets a pocket item with a status and a place in its order; owner: cclio; door: `cclio:boot`; wait: the session it lands
2. **shape** — gate: a shaped ticket; owner: dima and cclio; door: `cclio:shape-idea` when dima picks it, else the wish folded straight into a full ticket (`cclio:pm`); wait: one session
3. **design** — gate: dima's pick on the boards, joined to the ticket; owner: the designer; door: `x:crew-designer-interview`, `x:crew-designer`; wait: dima's word on when (2026-10-21: he watches the 5h window himself). its place after shape-idea and before the sign is a trial, tested on speak v2
4. **sign** — gate: dima's ✍️ sign on the chunk; owner: dima and cclio; door: `cclio:shape-lane`; wait: one session signs many chunks
5. **dispatch** — gate: dima's pick of signed chunks, the spawn word; the rest, from the spec to the 🟢 greenlight, is `cclio:shape-lane-dispatch`; owner: cclio; wait: the turn he picks
6. **build** — gate: the exit lines pass, each test proven by making it fail; owner: the coder; door: `x lane commit`, `mods:live`, `run-<app>`; wait: the ticket's estimate, then a ping
7. **verify** — gate: the verifier says clean, or its round-3 stop goes to cclio; owner: the verifier; door: `x:crew-verifier`; wait: 3 rounds
8. **land** — gate: merge state clean and the deploy Ready, where «no run» is never green; owner: cclio merges by the gate in `docs/knowledge/pr-flow.md` § core — risky paths named in the look card, a self-edit and the brake waiting for dima unless his sign pre-approved the merge (dima, 2026-10-22: he does not read prs); cclio pushes; door: `x lane merge-auto`, `x lane ci-wait`; a self-edit his word or sign approved lands through `gh pr merge` (a stack: `gh stack merge <pr> --squash --yes`) once merge-auto's own dry run passes on every layer, with `merged-by-x` labelled by hand (until: merge-auto takes his word, the cli rider in PK-265); the turn it lands, its spec dir moves to `.scratch/_archive/<feature>/` and its round line joins `docs/test-drive/review-rounds.md`; wait: the pr median
9. **look** — gate: one look card (what, where, try, proven, not checked — never empty), with a shot for anything rendered; owner: dima; door: `SendUserFile`; wait: his next time at the keyboard
10. **fold** — gate: a repeat lesson leaves as a guard, a verb, a check or a ticket, and a stopgap line carries `until: <ticket>`, and a changed mapped area gets its blueprint redrawn once the steers land (`cclio/blueprints/AGENTS.md`); owner: cclio; door: `cclio:halt`, `x fleet flow`; wait: the same day

the lane is the ticket's first body line, `lane: main|side|quick|shift`, the kind word only. cclio proposes it and silence accepts; a coder pings at a named trigger and cclio promotes. a lane's 🛼 glide title reads `<topic> — <what>`, one colon only, the card head's (dima, 2026-10-12).

- **freebie** — done in place, no ticket, no spec: drop, build, land, look; a small UI ask on atelier or speak still goes to a coder with its `DESIGN.md` + a screenshot, and leaves a `docs/test-drive/design-drift.md` rounds line
- **quick lane** — on main, no pr, no sign, a spec, a verifier on dima's yes/no in his pick (`main:<base sha>`): drop, dispatch, build, land, look, fold; a prototype is a quick lane that never lands
- **side lane** and **shift** — worktree, pr and verifier: every stage; an app or redesign opens with shape and design

## lane init — the contract (dima, 2026-10-23, PK-263)

🌠 wish → shape-idea, when picked → a shaped ticket → shape-lane → **✍️ signed** → **dispatch** → **🦭 sealed** → the coder starts → **🟢 greenlight** → build

- **where each thing lives**: the ticket holds the wish, the 🎯 done test and the `## signed` block (format: `cclio:pm` `references/body.md`); the 📐 spec (`.scratch/<feature>/spec.md`) holds the how and the exit lines; the lane plan holds the order of the coder's tickets
- **shape-idea is a pick**: the wish fold proposes «shape-idea or not» per wish (`craft-pm` § wishes) — a new app, a new feature or a change to how a product part works goes through it; plain, mechanical work becomes a full ticket straight away
- **shape-lane signs**, over a ticket or a pocket item (the sign creates the linear ticket until the pocket/linear grill settles it): one or many chunks per grill round, a safety-net re-grill after shape-idea, the real shaping otherwise
- **a sign carries what dispatch needs**: the done test, the milestone, the lane kind, the repo, the order among its siblings, and a merge pre-approval when the chunk edits the guards, the review workflows or merge-auto
- **re-sign**: a change to a signed ticket — dima's new wish, cclio's extend, merge or split — gets a proposed re-sign, `shape-lane` again plus an appended `✍️ re-signed <date> — <what changed>` line; a tiny change may skip the grill, never the line; after dispatch a re-sign re-seals the spec
- **a lane = one milestone's signed chunks**, in the milestone's order, one glide step each; a running lane takes a joiner only when it is signed and from the same milestone
- **📐 a spec on every lane with a member** — side, shift, quick, a designer or research lane; a quick lane needs no sign
- **the main lane may be signed too** (a trial, dima o110, W140–W141): our own steps as one chunk, `lane: main`, no coder and no spec; its 🛼 glide card is its progress
- **size**: a chunk is S by default, M allowed and watched as a trial (`memory/_reminders.md`); no split rule
- **dispatch is shift-safe**: anything that needs dima — a signed decision the code broke, a merge his sign did not pre-approve, a round-3 stop — parks that chunk with its reason in its spec, and the next signed chunk runs
- **the docs**: `PRODUCT.md` is written at dispatch when the chunk makes or changes an app, a skill or a fleet tool; the coder writes the FTR lines and glossary words in the build, held by `x lane gate`

the done test, read at every halt with `x fleet flow --days 14`: the `#dima-caught` lines, the `#brief` lines and the pr open → merge median per repo all go down.
