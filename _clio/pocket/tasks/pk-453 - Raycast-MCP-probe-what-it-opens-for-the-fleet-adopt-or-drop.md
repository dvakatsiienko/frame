---
id: PK-453
title: 'Raycast MCP: probe what it opens for the fleet, adopt or drop'
status: open
assignee: []
created_date: '2026-11-18T18:01:00Z'
due_date: '2026-11-21'
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
