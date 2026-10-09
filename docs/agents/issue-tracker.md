# Issue tracker: Backlog.md, local

Specs live as markdown in `.scratch/`; their tickets live as Backlog.md tasks in `.backlog/` (prefix `SP`). Both are gitignored: a spec is a lane's working plan, linear keeps the record. The cli is `backlog` (brew `backlog-md`), run from the repo root or with `BACKLOG_CWD=<repo>`. Never edit a task file by hand: the cli keeps its frontmatter, and a key it does not own is dropped on the next edit.

## Conventions

- One feature per spec: `.scratch/<feature-slug>/spec.md`
- One task per ticket: `backlog task create "<title>" --ref .scratch/<feature-slug>/spec.md --ac "<exit line>" … -l <size>,<role> --priority next --plain`
  - each exit line is one `--ac`; Backlog renders them as checkboxes (`--check-ac <n>` ticks one)
  - size: one of `xs` `s` `m` `l`; role: one of the strings in `triage-labels.md`
  - the feature's tickets share a parent: create the first as the feature task, the rest with `--parent <its id>`
- Order: `--ordinal`, banded by priority (`now` 1000–9999, `next` 10000–99999, `later` 100000+); read it with `--sort ordinal`
- Comments and history go to the task's notes: `backlog task edit <id> --append-notes "<text>"`
- A finished feature is never deleted: its tasks end `done` with a `--final-summary`, `backlog task complete <id>` files them, and the spec dir moves whole to `.scratch/_archive/<feature-slug>/`

## When a skill says "publish to the issue tracker"

Write the spec to `.scratch/<feature-slug>/spec.md`, then create one task per ticket as above. Print the new ids.

## When a skill says "fetch the relevant ticket"

`backlog task <id> --plain`. The user will normally pass the id (`SP-4`) or the feature slug (`backlog search <slug> --plain`).

## Wayfinding operations

Used by `/wayfinder`. The **map** stays a file; each **child** is a task.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: a task with `--ref .scratch/<effort>/map.md`, the question in its description, `--type` unused; the ticket type (`research`/`prototype`/`grilling`/`task`) is the first word of the title.
- **Blocking**: `--depends-on <ids>`. A ticket is unblocked when every task it depends on is `done`.
- **Frontier**: `backlog task list --ready --sort ordinal -s open --plain`; the first one wins.
- **Claim**: `backlog task edit <id> -s claimed` before any work.
- **Resolve**: `backlog task edit <id> -s done --final-summary "<the answer>"`, then append a context pointer (gist + id) to the map's Decisions-so-far in `map.md`.
