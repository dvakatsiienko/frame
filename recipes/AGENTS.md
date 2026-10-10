# AGENTS.md: recipes

a **recipe** is a repeatable learning run: it researches what we want to learn, wide and deep, then
sharpens the matching part of the fleet or its tools (a skill, a memory file, an app's knowledge) with
what it found. every recipe has the same purpose and covers its own area, so every recipe has the same
shape. running, grooming and creating one is `x:shape-recipe`; this file is what a recipe is.

## the want

dima, 2026-10-09:

> recipes are your door to more capability. you're trained on a cut dataset, and time moves while your training doesn't, so treat the feature as your own lever on your learning. search wide and deep with several arms, use what comes back to find mistakes in our own and the fleet's flows, and borrow tools, approaches, even whole frameworks. keep sharpening each recipe and the feature itself, and pick the right shape for every piece of output, never too bloated or too thin.

dima, 2026-10-08: «recipes are special, they are not plain scripts, they want intention.» and on done:
«exit criteria kind of forces you to make changes, but it is not always needed.»

## the folder

`recipes/<name>/`, readable by every session:
- `recipe.md` — the recipe, shaped below
- `log.md` — that each run happened, shaped below
- `log-<year>.md` — older log entries, once `log.md` passes 8 KB; nothing is deleted
- `scripts/` — helpers the recipe owns, only when it has any
- `last/` — only for a recipe that runs lanes: the current run's briefs and raw lane output. gitignored, cleared when the next run's distill finishes, never named in `log.md` or `artifacts:`

nothing else lives in the folder: the artifacts live where their readers look, and `artifacts:` is the
map back.

## names

kind-first, then the main artifact it refreshes, so the recipe sits beside its target:
`refresh-guide-go` → `x:guide-go`. a recipe that keeps one fleet member true is named after the member
(`refresh-crew-coordinator`). its script or verb shares the stem (`refresh-agent-ops` ↔ `x fleet ops`).
two recipes that refresh one file merge.

## recipe.md

frontmatter, in this order:

```yaml
kind: refresh | nurture | run   # research → distill · groom an existing system · plain execution
owner: <seat> | [<seat>, coordinator]   # coordinator | coder | designer | fleet: the seat whose work the artifacts feed
cadence: <when it runs, and any extra trigger>   # the only home of the cadence
artifacts: [<path or x:skill>, …]
script: <package.json key> | <x verb> | none
groomed: <yyyy-mm-dd> (dima)    # only on dima's word
was: [<old name>, …]            # only after a rename
draft: true                     # only while unshaped
```

body, in this order. each section holds only its own kind of line:

1. `# <folder name>`, one purpose line (what it keeps true), at most one 📌 status line. no history past «born <date> from <ticket>», no run results
2. `## contents` — only when the file passes 100 lines; the h2 list and nothing else
3. `## the want` — dima's words in «» or `>`, each dated, plus his standing calls. never research results, steps, or a paraphrase posing as a quote
4. `## the run` — binding run rules as a short list, then numbered steps; each step ends on a `done:` line and names its freedom (`script`, `template`, `open`). the shared steps of `x:shape-recipe` are named, never restated. the last step logs the run
5. `## vectors` — `### research` (the outside world, in dima's or the owner's words), `### analysis` (our own evidence), optional `### cut` (vectors he settled). never last run's answers: those live in the artifact
6. `## artifacts` — one bullet per `artifacts:` entry: what it holds, how the distill treats it. never the artifact's content
7. `## findings` — what this recipe's print adds to the shared parts, and its checklist, re-checked every run. never past verdicts

`kind: run` (`run-diorama`) needs only the frontmatter, the heading, `## the want` and `## the run`; when it carries more, the order is the want, artifacts, the run, vectors (a run reads its artifacts before it draws).

## log.md

```
# <folder name> — run log

- YYYY-MM-DD · <outcome> · <minutes | ?> · <lanes and cost | ?> · <artifacts changed | noop>
```

- one line per run, oldest first, exactly five ` · ` fields; an unknown field is `?`, never dropped
- the outcome is one clause, the verdict or the delta as a headline («2 rows flipped», «noop»)
- at most 280 characters a line; past 8 KB the oldest lines move to `log-<year>.md`
- the log answers «did it run, what changed, where». findings, numbers and decisions live in the artifact; todos go to the pocket; dima's wants go to `## the want`. the 10-07 cut is the reason: lines restated their artifacts at ~400 characters, and one reached 5 KB

## the check

`script/lib/recipe-shape.test.ts` runs in the pre-commit `pnpm test` and proves this file's shape on every recipe. a change to the shape here lands with its check in the same commit.
