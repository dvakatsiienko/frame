---
name: product-docs
description: Load BEFORE reading or writing an app's product map — «product docs», «the map», `product/MAP.md`, «what does <feature> do», «draft the map», «map lines», exit lines for an app that has a map, a coder or verifier brief that names map lines.
argument-hint: "[draft|update|read] <app dir>"
---

# product-docs

An app's product docs are two files with two owners. The **map** is ours: one line per feature,
each line a check the app must pass. It answers «what does X do» in one read and supplies the
exit lines a verifier checks.

## the two files

- `PRODUCT.md` — impeccable's: character, users, purpose, principles. Hand edits are allowed. Never
  put features here: every impeccable session loads the whole file.
- `product/MAP.md` — ours, never read by impeccable. The feature ledger.

`DESIGN.md` stays impeccable's own (`document` writes it after a build, and its sidecar json
regenerates with it).

## the line shape

The map opens with a 3-line legend, then groups features under `## <route> — <view>` headings:

```md
- 🧭 asked, not built yet (a new ask, an experiment) · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- decision: lines record a choice and its reason

## /projects — project list

- ✅ search filters the list
  - given the list holds more than one project
  - when the user types in the search field
  - then only projects whose name contains the text stay visible
  - decision: <the choice> — <why dima made it>
- 🧭 export shows progress
  - given a project is open
  - when the user presses export
  - then a step list fills live until the file downloads
```

An experiment keeps each variant as its own 🧭 line; the pick becomes a `decision:` line and the
losing variant's line is deleted.

- one line per feature, a noun phrase, what the user gets. Small features get a line too (a
  sidebar toggle is one line with no given/when/then).
- given/when/then lines describe what someone sees at the running app, never internals.
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
3. Write the given/when/then lines for what he kept. Mark each line ✅ only when its check passes
   in the app's verify recipe; otherwise 🧭.
4. Commit `product/MAP.md` and the app's `AGENTS.md` pointer line:
   `- product/MAP.md — every feature and its check. Read your section before changing what the app does.`
5. Report the cost: minutes and a rough token count for the draft. The pilot measures this.

## update — every change to what the app does

- a new feature → its line lands 🧭 in the same commit as the first code, or earlier.
- the coder flips 🧭 → ✅ in the commit where the check passes in the verify recipe.
- cclio flips ✅ → 🔎 when dima confirms at close. Nobody else sets 🔎.
- a changed behaviour → edit its given/when/then lines in the same commit.
- a removed feature → delete its line in the same commit.
- a choice dima made about a feature → a `decision:` line under it.

## exit lines

A spawn ask for an app with a map takes its exit lines from the map: «build MAP lines under
`## /projects — project list`: export shows progress». The ask may add steering lines on top.

No map → hand-written exit lines, and the app's `AGENTS.md` carries `map: none — <reason>`
(not drafted yet, or none by choice).

## completion criterion

Every feature the change touched has a line whose status matches the verify recipe, and no
code change in the diff lacks its map line.
