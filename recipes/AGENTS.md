# AGENTS.md: recipes

a **recipe** is a repeatable learning run: it researches one area wide and deep, then sharpens the
matching part of the fleet (a skill, a memory file, an app's knowledge) with what it found. every
recipe shares one shape, and this file is it; running, grooming and creating one is `clio:shape-recipe`.

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
- `retire-log.md` — a nurture recipe's prune proposals dima answered «keep», each with his reason, so none resurfaces unchanged; born by the first keep
- `scripts/` — helpers the recipe owns, only when it has any
- `last/` — only for a recipe that runs lanes: the current run's briefs and raw lane output. gitignored, cleared when the next run's distill finishes, never named in `log.md` or `artifacts:`

nothing else lives in the folder: the artifacts live where their readers look, and `artifacts:` is the
map back.

## names

kind-first, then the main artifact it refreshes, so the recipe sits beside its target:
`refresh-guide-go` → `x:guide-go`. a recipe that keeps one fleet member true is named after the member
(`refresh-crew-coordinator`). its script or verb shares the stem (`refresh-fleet-ops` ↔ `x fleet ops`).
two recipes that refresh one file merge. a refresh recipe's artifact carries its stem or the stem's last word (`refresh-code-storage` → `code-storage.md`), and the shape test reds one that does not; a member-named recipe is exempt.

## recipe.md

frontmatter, in this order:

```yaml
kind: refresh | nurture   # research → distill · groom an existing system
owner: <seat> | [<seat>, coordinator]   # coordinator | coder | designer | fleet: the seat whose work the artifacts feed
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
4. `## the run` — binding run rules as a short list, then numbered steps; each step ends on a `done:` line and names its freedom (`script`, `template`, `open`). the shared steps of `clio:shape-recipe` are named, never restated. the last step logs the run. the last run is the newest line of `log.md`, never a field; a recipe may carry one `- suggest a run when: …` line in `## the run`, after the run rules and before step 1 — clio suggests, dima runs
5. `## vectors` — `### research` (the outside world, in dima's or the owner's words), `### analysis` (our own evidence), optional `### cut` (vectors he settled). never last run's answers: those live in the artifact
6. `## artifacts` — one bullet per `artifacts:` entry: what it holds, how the distill treats it. never the artifact's content
7. `## findings` — what this recipe's print adds to the shared parts, and its checklist, re-checked every run. never past verdicts

## log.md

```
# <folder name> — run log

- YYYY-MM-DD · <outcome> · <minutes | ?> · <lanes and cost | ?> · <artifacts changed | noop>
```

- one line per run, oldest first, exactly five ` · ` fields; an unknown field is `?`, never dropped
- the outcome is one clause, the verdict or the delta as a headline («2 rows flipped», «noop»)
- at most 280 characters a line; past 8 KB the oldest lines move to `log-<year>.md`
- the log answers «did it run, what changed, where». findings, numbers and decisions live in the artifact; todos go to the pocket; dima's wants go to `## the want`

<!-- failure: log lines restated their artifacts at ~400 characters, one log reached 5 KB. outcome: the 10-07 cut, the 280-character cap. -->

## the check

`script/lib/recipe-shape.test.ts` runs in the pre-commit `pnpm test` and proves this file's shape on every recipe. it also catches drift in content: a line restating the shared vectors below or `clio:shape-recipe`'s run steps, and a backticked repo path or `x:<skill>` that does not exist. a change to the shape here lands with its check in the same commit.

## the shared vectors — every refresh run asks these on top of its own
<!-- moved from clio:shape-recipe (dima o73, 2026-10-12): a list in a skill was read and still missed -->
skip one only by naming why it does not fit (a job-market run has no «agent use» of a tool).

every vector's finding, shared or the recipe's own, is read against our flows: name the step, file or habit of ours it shows wrong, or «nothing» — the want's «use what comes back to find mistakes in our own and the fleet's flows» above.

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
