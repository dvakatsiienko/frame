---
name: shape-recipe
description: Load BEFORE creating, reshaping or running a recipe — «recipe», «refresh <x>», «nurture <x>», «run the <x> recipe», a research about to be repeated, a branch (design, voice, tooling) that will need refreshing again. typed as `/cclio:shape-recipe <name or idea>`.
argument-hint: "<recipe name to run, or the thing a new recipe would keep fresh>"
---

# shape-recipe — the recipe engine

The procedure for running, grooming and creating a recipe. **two flows**: on a new name it creates
(§ creating one); on an existing recipe it sharpens — step 0's grill re-asks the want, the vectors and
where the gains land every time, with or without a run after it, because recipes evolve (dima, 2026-10-14). **What a recipe is, its folder, the
`recipe.md` and `log.md` shapes and the names: `~/frame/recipes/AGENTS.md`** — read it first; the
shape test (`script/lib/recipe-shape.test.ts`) proves it.

## running one

0. **every run is shaped with dima first, a create and a rerun alike — a grill, never a tick list** (dima, 2026-10-13, o151: «fully shape a recipe each time … everything changes and recipes go stale — my wants, the vectors, and what we want out of recipes themselves»). read `recipe.md` and the last 5 lines of `log.md` as the thing under review: is every want line still true, does every vector serve a want line and ask today's question, do the artifacts still reach the readers who should use them, and does the recipe as a whole do what it was made for? then load `mattpocock-skills:grilling` and run its ❓ rounds as written, the frontier only (want first; the vectors and where the gains land in the next round), each question with its choices and a ➡️ pick and each also an orbit ask (`habit-dima-comms`): his want first («what do you want out of this recipe now?»), then the vectors printed with the shared ones from `recipes/AGENTS.md` for him to cut and add, then where the gains land. the owner brings its proposed cuts and adds into the round (a recipe dima has to rewrite by hand is a recipe its owner neglected); a groom printed as fixes to tick is not this step. done: the round answered, the recipe edited from it, dima said «run it», and on that word `groomed: <today> (dima)` is in the frontmatter — `pnpm research:lanes` refuses a brief under `last/` without it
1. research, all lanes at once from one brief built by `pnpm recipe:brief <name>` (the recipe's want and vectors plus the shared vectors, verbatim): the `researcher` agent (sources, code, docs) + `pnpm research:lanes <brief>` (exa + parallel). raw output → `last/`. done: every lane landed or failed out loud
2. distill — clever-merge into each artifact: keep what still holds, add only what is new and useful, delete what the run proved stale. raw research never lands in an artifact. done: every artifact in `artifacts:` read and touched or named «unchanged»
3. the findings print, one message to dima, in the research-print shape of `x:research` (the headline, then the ~3 sections that carry most); on top of it, every recipe print names its checklist items and its `open` vectors. a noop run says «noop» and stops there. done: printed
4. append the log line, update `recipe.md` only where the run proved it wrong. done: `log.md` has today's line

## the shared vectors

they live in `recipes/AGENTS.md` § the shared vectors, the recipe contract every run reads; `pnpm recipe:brief <name>` puts them in the brief verbatim.

## the owner — a recipe is shaped by the role that lives off its artifacts

dima, 2026-10-08: «there are too many of them, so it is hard for me to update them all — you, the
coordinator, should act in a special way here.» so:

- **every recipe names its owner** in frontmatter — `owner: coordinator | coder | designer | fleet` —
  the role whose work the artifacts feed. dima writes the want; **the owner writes and grooms the
  vectors from its own seat**: «what would make me better at this job next week?» — never a list of
  topics about the subject
- **done = the run happened** (the want, `recipes/AGENTS.md`): every lane landed or failed out loud, the print reached
  dima, the log line is written. a run that finds nothing to change is a full run; a change is
  adopted on dima's word, never made because the run must produce one. the weight of a recipe is
  its want and its vectors, sharpened at every groom. a vector with no sources prints as `open`
- **a brief is built by `pnpm recipe:brief <name>`**, never by hand: a hand brief re-describes the want and the lanes answer the reframing
- **outside research is pointed at where the owner failed** (the flawlog, the retros, the test-drive logs since the last run), never at the whole subject
- **the owner is a seat, never a spawn**: whoever holds that seat next proposes its vector cuts and adds
  as a last act of its session, in its retro (the next design lane for `refresh-art-kit`); cclio runs the
  groom and the grill from them, with the seat's skill loaded, and says so. nobody is spawned for a groom

## creating one

a branch (design, voice, a tool stack) or a research with several vectors that will run again becomes a
recipe the same session: the folder, `recipe.md` with dima's want folded from the thread, a
header-only `log.md`. the tell is writing research vectors from scratch for a subject researched before. its first
run starts with step 0's grill like any other, and `groomed: <today> (dima)` lands on his word, before any lane.

## practices

- ✅ a claimed fact in a findings print carries its source or «?»
- ✅ every run asks «can a step here become a script?» and names the step

**completion criterion:** for a run — `log.md` holds the line and the findings print reached dima; for a
new or reshaped recipe — `pnpm test` passes the recipe shape test (`script/lib/recipe-shape.test.ts`).
