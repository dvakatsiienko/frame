---
name: author-blueprint
description: load BEFORE drawing, reading back or automating in a blueprint — «blueprint», «draw it», «show me visually», «diagram», «figjam», «n8n», «workflow», «canvas», «draw.io», an n8n automation to build or fix, dima's edit to read back.
---

# author-blueprint — draw it, read his edit, build from it

a **blueprint** (`rules/fleet-vibe.md`) lives in `~/frame/cclio/blueprints/`; its `AGENTS.md` holds the doors, names and files, `PRODUCT.md` the want. the n8n facts, verified 2026-10-18 on 2.43.7: [references/n8n.md](references/n8n.md). it holds on every tool on trial: FigJam, n8n, Canvas, draw.io.

a mapped area (`blueprints/AGENTS.md`) is planned on its board first, built after dima agrees.

## draw

1. read the real files first and map them one to one: a tile names its file, my own reading (a weak spot) is labelled so
2. readable for dima, before the first tile: [references/readable.md](references/readable.md) — big tiles, one idea each, an emoji from its set opening every title and the board's name
3. the tool: FigJam through the figma mcp (`create_new_file`, `use_figma`); n8n through its api (`noOp` tiles, sticky notes, dima's Tidy up); Canvas or draw.io on his ask, draw.io laid out by `--layout '[{"layout":"elkLayered"}]'`
4. done: one screenshot read back for clipped text and crossing arrows, fixed, then the link in the reply; an n8n board also saves its export as `blueprints/<subject>-<kind>.n8n.json`

## read his edit back

- GET the workflow, diff it against the last export semantically: tiles added, removed, renamed, moved, arrows in and out, sticky text — never the raw json diff
- `/workflows/{id}/history` keeps every version forever: the diff base when no export exists
- every sticky or tile of his that asks something is answered in the reply, by its own words
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
