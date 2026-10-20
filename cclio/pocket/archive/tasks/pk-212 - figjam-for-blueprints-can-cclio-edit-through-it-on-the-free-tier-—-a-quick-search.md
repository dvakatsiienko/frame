---
id: PK-212
title: >-
  figjam for blueprints: can cclio edit through it, on the free tier — a quick
  search
status: done
assignee: []
created_date: '2026-10-20 11:02'
updated_date: '2026-10-20 12:51'
due_date: '2026-10-23'
labels:
  - s
dependencies: []
priority: next
type: question
ordinal: 99300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-20, dima: i recalled there is figjam too. i like it, it's the prettiest of all wireframing tools. can you edit via it? can we use it on the free tier, while i have no plans to buy figma pro? do a quick search to explore this option. relates cclio:author-blueprint (the blueprints trial).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-20 answered (researcher, figma docs read 10-20): free plan = unlimited FigJam drafts, 3 team files; the REST api writes no nodes; the official REMOTE figma mcp writes FigJam (generate_diagram from mermaid, use_figma, create_new_file); the desktop mcp needs a paid seat. conflict: one page says drafts are writable without a Full seat, the write-to-canvas page lists paid plans only, and starter gets 20 mcp tool calls a month (whether writes count: ?). verdict: partly — a 2-call probe settles it (offered in orbit).

2026-10-20 15:51 PROBE: figma remote mcp, scoped to ~/frame/.scratch/figjam-probe only; a sonnet claude -p ran whoami (starter plan, View seat), create_new_file (FigJam draft), generate_diagram (mermaid) — all ok, no plan, seat or quota error. board: https://www.figma.com/board/z3uF8ouxtY12wA0IM3t0IG. not checked: that the nodes render (dima opens the link), and how fast the 20-calls-a-month starter cap bites. verdict: a free-plan agent CAN write FigJam.
<!-- SECTION:NOTES:END -->
