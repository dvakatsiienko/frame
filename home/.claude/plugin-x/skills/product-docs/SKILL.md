---
name: product-docs
description: Load BEFORE reading or writing an app's product map — «product docs», «the map», `product/MAP.md`, «what does <feature> do», «draft the map», «map lines», exit lines for an app that has a map, a coder or verifier brief that names map lines.
argument-hint: "[draft|update|read] <app dir>"
---

# product-docs

An app's product docs are three files with two owners. The **map** is ours: one line per feature,
each line a check the app must pass. It answers «what does X do» in one read and supplies the
exit lines a verifier checks.

## the two files

- `PRODUCT.md` — impeccable's: character, users, purpose, principles. Hand edits are allowed. Never
  put features here: every impeccable session loads the whole file.
- `product/MAP.md` — ours, never read by impeccable. The feature ledger.
- `CONTEXT.md` — ours, the app's glossary: every domain word the map uses, defined once. Written
  with matt's `domain-modeling` skill; the map, the ui labels and the code use its words.

`DESIGN.md` stays impeccable's own (`document` writes it after a build, and its sidecar json
regenerates with it).

## the line shape

The map opens with a 4-line legend, then groups features under `## <route> — <view>` headings:

```md
- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## /projects — project list

- ✅ search filters the list
  - given the list holds more than one project
  - when the user types in the search field
  - then only projects whose name contains the text stay visible
  - decision: <the choice> — <why dima made it>
- 🧭 export shows progress
  - makes: a csv of the project's rows, downloaded as `<project>.csv`
  - given a project is open
  - when the user presses export
  - then a step list fills live until the file downloads
```

An experiment keeps each variant as its own 🧭 line; the pick becomes a `decision:` line and the
losing variant's line is deleted.

- one line per feature, a noun phrase, what the user gets. Small features get a line too (a
  sidebar toggle is one line with no given/when/then).
- given/when/then lines describe what someone sees at the running app, never internals.
- a feature that leaves something behind gets one `makes:` line first: what it produces and where
  it lands. a view, a toggle or a filter makes nothing and gets none.
- group by what a designer takes in one piece (a view, a flow). The grouping is open: pick what
  fits the app, and regroup when it stops fitting.
- name a thing by the label the ui shows. A region with no visible label takes its code name,
  and the missing label is reported to dima as a finding.
- commands with no ui (scripts, a cli) go under a last `## scripts` heading; a designer skips it.
- over ~150 lines → split into an index plus `product/<route>.md` leaves.

## who reads what

- **dima** — the whole map, to answer «what does X do».
- **a designer session** — the sections for the views in scope, plus `PRODUCT.md` and `DESIGN.md`,
  before any new design or tweak.
- **a coder** — only the section its brief names by heading.
- **a verifier** — the given/when/then lines of the features in scope. Those are its exit lines.

## draft — an app with no map yet

1. Run the app (its verify recipe says how) and walk every view.
2. Count the features first, one line each, no given/when/then yet. Tell dima the count:
   - ≤ 15 → walk them with him through `x:step-by-step`
   - more → one wall-of-text review, dima verdicts inline
3. Write the given/when/then lines for what he kept. Run each check in the app's verify recipe:
   ✅ passes, 🐞 fails, ⬜ not run yet (a destructive path waiting for a scratch server).
4. Pull the domain words the lines use into `CONTEXT.md` through `domain-modeling`, and align the
   lines to its words. A new app runs this order the other way: the glossary first, then the map.
5. Commit `product/MAP.md`, `CONTEXT.md`, the app's `CONTEXT-MAP.md` entry when the repo has one,
   and two lines — the bridge is resident in every session in the repo:
   - the repo's root `AGENTS.md` carries the rule once (add it if missing): «an app with
     `product/MAP.md` updates its map line, and any new domain word its `CONTEXT.md` entry, in the
     same commit as the code (`x:product-docs`)»
   - the app's `AGENTS.md` carries only the pointer: `product/MAP.md` + `CONTEXT.md` — read your
     section before changing what the app does
6. Report the cost: minutes and a rough token count for the draft. The pilot measures this.

## map-first — a new ask becomes a map line before anything else

- a product-shaped ask from dima (a feature, a change, a bug he saw) lands as a map line first:
  🧭 for new behaviour, 🐞 on the existing line for a bug. the ticket and the spawn ask only name
  the lines to build; they never restate them. non-product work (a script, a hazard line) stays a
  ticket bullet.
- **write the line where the map is live.** while a coder's branch is open, the map in its worktree
  is the live copy: the line goes to the coder as a message, never onto main, where it collides
  with the coder's flips. no branch open → main.

## update — every change to what the app does

- lines and `CONTEXT.md` words change in the same pr as the code (on main: the same commit): a new
  feature adds its 🧭 line, a changed behaviour edits its given/when/then, a removed feature
  deletes its line, a new or shifted domain word updates its `CONTEXT.md` entry.
- status flips once, in the pr's last commit: each line whose check now passes in the verify
  recipe goes to ✅, a line that fails goes to 🐞. flipping per step forces partial staging.
- ✅ → 🔎 when dima says a feature holds after using it (a screenshot, «works», «✓») — cclio flips
  that line the same turn, on main or through the live coder. nobody else sets 🔎.
- a choice dima made about a feature → a `decision:` line under it.

## exit lines

- an app with a map takes its exit lines from the map: the spawn ask names the lines to build,
  and the verifier reads their given/when/then plus the pr's own map diff
  (`git diff origin/main... -- product/MAP.md`) — every line the pr adds or flips is an exit line.
  the ask may add steering lines on top; product behaviour never lives only in ticket prose.
- the verifier checks each line, its status, that its `makes:` output exists as written, and
  that every domain word the line uses is defined.
- at close, cclio runs `gh pr diff <n> --name-only`: an app pr that changes source and not
  `product/MAP.md` gets one question — «no feature changed?» — before the merge.
- no map → hand-written exit lines, and the app's `AGENTS.md` carries `map: none — <reason>`
  (not drafted yet, or none by choice).

## completion criterion

Every feature the change touched has a line whose status matches the verify recipe, and no
code change in the diff lacks its map line, and every domain word the touched lines use has its
`CONTEXT.md` entry.
