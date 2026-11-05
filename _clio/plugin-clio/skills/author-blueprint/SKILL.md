---
name: author-blueprint
description: load BEFORE drawing, reading back or automating in a blueprint — «blueprint», «draw it», «show me visually», «diagram», «figjam», «n8n», «workflow», «canvas», «draw.io», an n8n automation to build or fix, dima's edit to read back.
---

# author-blueprint — draw it, read his edit, build from it

a **blueprint** (`rules/fleet-vibe.md`) lives in `~/frame/_clio/blueprints/`; its `AGENTS.md` holds the doors, names and files, `PRODUCT.md` the want. the n8n facts, verified 2026-10-18 on 2.43.7: [references/n8n.md](references/n8n.md).

a mapped area (`blueprints/AGENTS.md`) is planned on its board first, built after dima agrees.

## draw

1. read the real files first and map them one to one: a tile names its file, my own reading (a weak spot) is labelled so
2. readable for dima, before the first tile: [references/readable.md](references/readable.md) — big tiles, one idea each, an emoji from its set opening every title and the board's name
3. the tool: Excalidraw — a scratch script patches `board.excalidraw`, never read whole: one stable id per element, a prefix per section, every arrow bound both ways; a tile moved onto a band added later sinks under it, so it takes a new top index
4. done: `pnpm render <board>` exits 0 (every text inside its tile), `pnpm crossings <board>` adds none, the png's changed area cropped and read, `versions.json` and `bv-label` bumped, then the file path

## read his edit back

- before every board edit: `pnpm read-back <last commit's copy> <board>`, never the raw json; each tile or note of his that asks something is answered by its own words
- his notes, text elements starting with 💬, print first
- n8n (automations only): GET the workflow and diff it against the last export semantically, never the raw json; `/workflows/{id}/history` is the base when no export exists
- done: the new export committed beside the old one

## write without breaking him

- PUT replaces the whole workflow: GET → edit → PUT with its `versionId`; never the CLI import on a live flow (it overwrites his unsaved tab)
- connections are keyed by node name: a rename rewrites every connection that names it
- a published workflow re-publishes on PUT; `?publishIfActive=false` keeps it a draft

## automate

- an automation earns its place by removing a named failure of ours; the workflow's sticky note names it
- state goes to a data table, failures to one shared error workflow, a shell step only through an allowlist
- every POST from a script runs `curl -sf` with a `jq -n --arg` body, and its failure prints
- done: a real input ran end to end and its row or result was read back
