---
id: PK-453
title: 'Raycast MCP: probe what it opens for the fleet, adopt or drop'
status: done
assignee: []
created_date: '2026-11-18T18:01:00Z'
updated_date: '2026-11-19T14:16:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: later
type: task
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 2026-11-18 20:01: «create pocket item. we solve in a few days (not today, not tmrw). and fold a known capabilities list to probe when we get there.»

source: Raycast 2.13 (2026-11-18), https://www.raycast.com/changelog — a local MCP server, the extensions it reaches chosen by him.

capabilities to probe (from the 2.11–2.13 notes):
- clipboard history: read, search
- snippets: list, create
- quicklinks: list, create
- browser tabs and history: read
- Focus sessions: start, stop
- applications: find, uninstall, Auto Quit setup
- Raycast Settings: read — the one that matters: does it reach hotkey bindings (read, change)? his ask: «can you change a ray hotkey binding, or peek settings inside ray?»
- Store, Organizations, Extension Development: listed, scope unknown

the bar: our rule is cli over mcp; it earns a place only if it opens a door we lack today (hotkeys, settings) — else drop. today's door: import/raycast (hand-imported config, .rayconfig exports).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
20:01 kept: 2026-11-18 — dima's word: a pocket item solved in a few days, not today or tomorrow (20:01); his word outranks the today–tomorrow rule

23:16: handed back at wing 1's halt: open, no date on dima's 20:01 word («in a few days»); main or the next wing 1 takes it

PK-453:W1 (2026-11-19 16:12, dima): can you do a quick websearch and verify whether raycast mcp is a pro-plan-only feature? if it is, it is dead weight; i have no plans for ray pro. in that case, drop it fully.
16:14 close: dropped on W1 — Raycast MCP is Pro-only: the pricing table's Raycast MCP row reads Not included under Free (https://www.raycast.com/pricing), the manual says «The Raycast MCP Server is available with Raycast Pro» (https://manual.raycast.com/ai/model-context-protocol)

16:15 close: PK-453:W1 done: the item dropped on it (dima 16:12)

close: W1 done, the item dropped on it (dima 16:12)
<!-- SECTION:NOTES:END -->
