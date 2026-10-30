# craft-fleet-flow — the path from dima's idea to the thing in his hands

the coordinator's map; the picture: [Fleet Flow v2](https://claude.ai/artifact/G8Z3kZtebCK8hSYRfsdac3). who talks to whom is `rules/fleet-flow.md`. **this file is lane init's one home** (§ lane init): `clio:shape-idea`, `clio:shape-lane` and `clio:shape-lane-dispatch` hold the steps and point here for the rules; the words live in `rules/fleet-vibe.md`.

<!-- why here: moved out of rules/fleet-flow.md on dima's word (2026-10-06, FRM-309): only clio picks lanes and owns the gates, so no other session pays for it -->

## ten stages, three kinds of work

each stage names its gate, its owner, its door and its wait budget.

1. **drop** — gate: every item gets a pocket item with a status and a place in its order; owner: clio; door: `clio:boot`; wait: the session it lands
2. **shape** — gate: a shaped ticket; owner: dima and clio; door: `clio:shape-idea` when dima picks it, else the wish folded straight into a full ticket (`clio:pm`); wait: one session
3. **design** — gate: dima's pick on the boards, joined to the ticket; owner: the designer; door: `x:crew-designer-interview`, `x:crew-designer`; wait: dima's word on when (2026-10-21: he watches the 5h window himself). its place after shape-idea and before the sign is a trial, tested on speak v2
4. **sign** — gate: dima's ✍️ sign on the chunk; owner: dima and clio; door: `clio:shape-lane`; wait: one session signs many chunks
5. **dispatch** — gate: dima's pick of signed chunks, the summon word; the rest, from the spec to the 🟢 greenlight, is `clio:shape-lane-dispatch`; owner: clio; wait: the turn he picks
6. **build** — gate: the exit lines pass, each test proven by making it fail; owner: codie; door: `x lane commit`, `mods:live`, `run-<app>`; wait: the ticket's estimate, then a ping
7. **verify** — gate: sixth sense says clean, or its round-3 stop goes to clio; owner: sixth sense; door: `x:crew-sixth-sense`; wait: 3 rounds
8. **land**
   - gate: merge state clean and the deploy Ready, where «no run» is never green
   - owner: clio merges by the gate in `docs/knowledge/pr-flow.md` § core — risky paths named in the look card, a self-edit waiting for dima unless his sign pre-approved the merge, the brake always waiting (dima, 2026-10-22: he does not read prs); clio pushes
   - door: `x lane merge-auto` (it waits for ci and names why)
   - self-edit path: his sign pre-approved → `x lane merge-auto <pr> --apply`; his typed word → `--dima-ok <pr>` added (x-mod-guard proves the word); a stack layer: `gh stack merge <pr> --squash --yes`, `merged-by-x` by hand
   - the brake is never pre-approved: his word each time, a tick quoting the pr carrying it (FRM-427)
   - archive step: the turn it lands, its spec dir moves to `.scratch/_archive/<feature>/` and its round line joins `docs/test-drive/review-rounds.md`
   - wait: the pr median
9. **look** — gate: one look card (what, where, try, proven, not checked — never empty), with a shot for anything rendered; owner: dima; door: `SendUserFile`; wait: his next time at the keyboard
10. **fold** — gate: a repeat lesson leaves as a guard, a verb, a check or a ticket, and a stopgap line carries `until: <ticket>`, and a changed mapped area gets its blueprint redrawn once the steers land (`_clio/blueprints/AGENTS.md`); owner: clio; door: `clio:halt`, `x fleet flow`; wait: the same day

the lane is the ticket's first body line, `lane: <kind>` (the four kinds: `fleet-vibe` § entities, lane), the kind word only. clio proposes it and silence accepts; codie pings at a named trigger and clio promotes. a lane's 🛼 glide title reads `<topic> — <what>`, one colon only, the card head's (dima, 2026-10-12).

- **freebie** — done in place by me, no ticket, no spec: drop, build, land, look; a bigger one is a **☘️ almost-freebie** (`fleet-vibe`): a helper card i brief and prove (a small UI ask: `DESIGN.md` + a shot, a `docs/test-drive/design-drift.md` line)
- **quick lane** — on main, no pr, no sign, a spec, a sixth sense on dima's yes/no in his pick (`main:<base sha>`): drop, dispatch, build, land, look, fold
- **side lane** and **shift** — worktree, pr and sixth sense: every stage; an app or redesign opens with shape and design

## lane init — the contract (dima, 2026-10-23, PK-263)

🌠 wish → shape-idea, when picked → a shaped ticket → shape-lane → **✍️ signed** → his pick → **🦭 sealed** → **🚀 dispatched** → **🟢 greenlight** → build (the words: `fleet-vibe` § entities, lane init)

- **where each thing lives**: the ticket holds the wish, the 🎯 done test and the `## signed` block (format: `clio:pm` `references/body.md`); the 📐 spec (`.scratch/<feature>/spec.md`) holds the how and the exit lines; the lane plan holds the order of codie's tickets
- **shape-idea is a pick**: the wish fold proposes «shape-idea or not» per wish — the rule is `craft-pm` § wishes
- **shape-lane signs** over a ticket (the fold is its one birth door: `shape-lane` skill § 4): one chunk per grill, or fast mode for chunks needing no call of his (shape-lane § 2); a safety-net re-grill after shape-idea, the real shaping otherwise
- **a sign carries what dispatch needs**: the done test, the milestone, the lane kind, the repo, the order among its siblings, and a merge pre-approval when the chunk edits the guards, the review workflows or merge-auto
- **re-sign**: a change to a signed ticket — dima's new wish, clio's extend, merge or split — gets a proposed re-sign, `shape-lane` again plus an appended re-signed line (format: `body.md`); a tiny change may skip the grill, never the line; after dispatch a re-sign re-seals the spec
- **a lane is one codie plus an optional sixth sense, walking its area's signed chunks in their `blocks` order, one milestone after another** (dima o46, 2026-10-28: «two milestones can be easily solved by one coder lane, one by one»); one glide step per chunk; a joiner must be signed and from a milestone the lane walks; a parallel split is an option, never a rule; mods prefer one lane, since parallel mods codies interfere (o46, o67); a shift walks milestones in the initiative's queue order (dima o112)
- **📐 a spec on every lane with a member** — side, shift, quick, a designer or research lane; a quick lane needs no sign
- **the main lane may be signed too** (a trial, dima o110, W140–W141): our own steps as one chunk, `lane: main`, no codie and no spec; its 🛼 glide card is its progress
- **size**: a chunk is S by default, M allowed and watched as a trial (`memory/_reminders.md`); no split rule
- **dispatch is shift-safe**: anything that needs dima — a signed decision the code broke, a merge his sign did not pre-approve, a roadblock — parks that chunk with its reason in its spec, and the next signed chunk runs; clio drives the side lane fully and tells him as info, a round-3 stop included (dima, 2026-10-27, o60)
- **the docs**: `PRODUCT.md` is written at dispatch when the chunk makes or changes an app, a skill or a fleet tool; codie writes the FTR lines and glossary words in the build, held by `x lane gate`

the done test, read at every halt with `x fleet flow --days 14`: the `#dima-caught` lines, the `#brief` lines and the pr open → merge median per repo all go down.
