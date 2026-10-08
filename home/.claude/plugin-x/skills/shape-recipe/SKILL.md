---
name: shape-recipe
description: Load BEFORE creating, reshaping or running a recipe — «recipe», «refresh <x>», «nurture <x>», «run the <x> recipe», a research about to be repeated, a branch (design, voice, tooling) that will need refreshing again. typed as `/x:shape-recipe <name or idea>`.
argument-hint: "<recipe name to run, or the thing a new recipe would keep fresh>"
---

# shape-recipe — the recipe engine

A **recipe** is a repeatable procedure that keeps something fresh: it researches, distills into the
artifacts it owns, prints findings, and logs the run. Some recipes are plain execution scripts.
This skill holds everything recipes share; each recipe holds only what is its own.

Contents: the folder · recipe.md · log.md · names · running one · the shared vectors · creating one ·
practices.

## the folder

`~/frame/recipes/<name>/` — readable by every session, cclio and coders alike.
- `recipe.md` — the recipe (below)
- `log.md` — one line per run; the run count is its line count
- `scripts/` — helpers the recipe owns, when it has any
- `last/` — the last run's raw output, overwritten each run; raw research never piles up

## recipe.md

frontmatter:
```yaml
kind: refresh | nurture | run   # research → distill · groom an existing system · plain execution
cadence: <when it should run>   # «every cc minor», «monthly», «on dima's word»
artifacts: [<path>, …]          # what it keeps fresh, pointed at, never housed here
script: <package.json key> | none
was: [<old name>, …]            # after a rename; the shape test fails while a live file still names one
```
the heading is `# <folder name>`, nothing else — the shape test checks it.
sections, most important first:
1. **contents** — only when the file passes 100 lines
2. **the want** — dima's words in «», dated. no want, no recipe: ask him for it
3. **the run** — numbered steps; each ends on a done-line; a check step carries «go back to step N»; each names its freedom: `script` (exact), `template` (a shape, some room), `open` (judgment)
4. **vectors** — research vectors in dima's wording, re-groomed with him each run; analysis vectors for local evidence
5. **findings** — what the run's closing print must cover beyond the shared shape

## log.md

`- YYYY-MM-DD · <outcome in one line> · <minutes> · <agents and tokens or $> · <what changed: artifacts, or «noop»>`

## names

kind-first, then the main artifact it refreshes, so the recipe sits beside its target:
`refresh-guide-go` → `x:guide-go`, `refresh-monorepo` → the monorepo research; a recipe that keeps one fleet member true is named after the member (`refresh-coordinator`). a recipe's script
shares the stem (`refresh-agent-ops` ↔ `pnpm agent-ops:report` ↔ `docs/knowledge/agent-ops.md`).

## running one

0. **a rerun grooms the recipe before it runs it** (dima, 2026-10-08): read `recipe.md` as the thing under review, not as the plan — is every want line still true, does every vector serve a want line and ask today's question, do the artifacts and the lanes still exist, and does the recipe as a whole do what it was made for? the test: «would i want to run this to refresh myself and the fleet?» — a no on any line is printed with the groom and fixed with dima, never in silence, and no lane launches before his word on the groomed recipe. done: each vector names the want line it serves or is listed as orphaned, and dima said «run it»
1. read `recipe.md` and the last 5 lines of `log.md`. done: you can say what changed since the last run
2. re-groom the vectors with dima: print them with the shared vectors below, he cuts and adds. done: his word on the list. (open)
3. research, all lanes at once from one brief: the `researcher` agent (sources, code, docs) + `pnpm research:lanes <brief>` (exa + parallel). raw output → `last/`. done: every lane landed or failed out loud
4. distill — clever-merge into each artifact: keep what still holds, add only what is new and useful, delete what the run proved stale. raw research never lands in an artifact. done: every artifact in `artifacts:` read and touched or named «unchanged»
5. the findings print, one message to dima: what is new · what it changes in our setup · tools to try (a test drive, `habit-test-drive`) · steps that could become a script · the recipe's own weak spots. a noop run says «noop» and stops there. done: printed
6. append the log line, update `recipe.md` only where the run proved it wrong. done: `log.md` has today's line

## the shared vectors — every refresh run asks these on top of its own

skip one only by naming why it does not fit (a job-market run has no «agent use» of a tool).

research, the outside world:
- **the delta** — changelogs, release notes, new versions and rebrands since the last run's date
- **audience: agents** — how the tool or practice reaches its best agent use: what an agent should call, read or avoid
- **good and bad practices** — the do's and don'ts, with the reason
- **pitfalls** — gotchas, tricky parts, known problem areas, open issues upstream
- **prior art** — existing tools and solutions for what we do by hand
- **alternatives** — better tools than ours, already working, so we don't build them; what we could borrow from one we don't adopt whole
- **established patterns** — what is proven to work elsewhere and can be adopted as is
- **cost** — price, free tier and quota changes for anything we pay or might pay for

analysis, our own evidence:
- **what broke for us** — the flawlog (`#dima-caught` first), coder and verifier retros, test-drive logs since the last run
- **the artifact against reality** — every claim the artifacts hold re-checked on the current build, or marked stale
- **drift** — vendored or copied files against their recorded upstream commit

## the owner — a recipe is shaped by the role that lives off its artifacts

dima, 2026-10-08: «recipes are special, they are not plain scripts, they want intention. but there are
too many of them, so it is hard for me to update them all — you, the coordinator, should act in a
special way here.» so:

- **every recipe names its owner** in frontmatter — `owner: coordinator | coder | designer | fleet` —
  the role whose work the artifacts feed. dima writes the want; **the owner writes and grooms the
  vectors from its own seat**: «what would make me better at this job next week?» — never a list of
  topics about the subject
- **every half has a done-test**: what the run changes (rows flipped, a grid re-sized, ≤3 verdicts
  — add / adopt / drop — or `noop`). a half without one does not run
- **vectors start from our own evidence, then look outside**: the flawlog, the retros, the test-drive
  logs and the flow numbers since the last run say where the owner failed; outside research is pointed
  at that, never at the whole subject
- **the groom is the owner's duty at every rerun** (step 0): the owner proposes cuts and adds, dima verdicts
  in one block; a recipe dima has to rewrite by hand is a recipe its owner neglected
- **the owner is a seat, never a spawn**: whoever holds that seat next grooms the vectors as a last act
  of its session (the next design lane grooms `refresh-art-kit`); no seat due → cclio proxies with the
  seat's skill loaded and says so. nobody is spawned for a groom

## creating one

a branch (design, voice, a tool stack) or a research with several vectors that will run again becomes a
recipe the same session: the folder, `recipe.md` with dima's want quoted from the thread, an empty
`log.md`. the tell is writing research vectors from scratch for a subject researched before.

## practices

- ✅ one recipe per artifact family; two recipes that refresh one file merge
- ✅ artifacts live where their readers look; the recipe's `artifacts:` is the map back
- ✅ a claimed fact in a findings print carries its source or «?»
- ✅ noop is a real outcome — a run that found nothing new changes nothing
- ✅ every run asks «can a step here become a script?» and names the step
- ❌ a recipe that houses its artifact, or keeps raw research past the distill
- ❌ a re-groom skipped because «the vectors look fine» — stale vectors give confident answers to old questions

**completion criterion:** for a run — `log.md` holds the line and the findings print reached dima; for a
new or reshaped recipe — `pnpm test` passes the recipe shape test (`script/lib/recipe-shape.test.ts`).
