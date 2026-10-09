---
id: PK-13
title: '[36] ccrow''s packet diet'
status: open
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-09 11:35'
labels:
  - m
dependencies: []
priority: later
type: task
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 36 · status line was: `open · approved` · tomorrow, after ccrow's own opinion

ccrow's session read 625k chars on 10-07, ~all of it 22 `packets/<wake>/delta.md` files (30–63k each). dima 10-07: «the delta packet drops tool output ← let's try. but let's measure. ask ccrow herself if she wants it?» · «ccrow should survive your checkpoints, unless it grewen big» · on cold cache: «i sometimes go away from kb for ~30 mins, and crow can reach cold cache silently».
- measure first: the tool_result share of a delta packet (one `jq` over today's packets)
- then: the packet keeps dima's messages whole (`<command-args>` included), cclio's replies and peer messages whole, task-notification results capped at ~2k chars with the output_file path, tool-call names; tool_result bodies go. a/b one day of notes against today's
- ccrow 10-07, asked: «yes, drop the tool_result bodies — none of today's catches used them»; the real loss was the 60000-char cut losing dima's lines at a packet's head, a slimmer packet fixes it; she writes each watch item into the note text so a halt restart drops nothing; a cold-cache guard is a keep-hot ping at ~50 min idle, default off, never a skipped wake
- cold cache, measured 10-07: only the 09:20 start wrote cold; the 48-min pause stayed warm (1h ttl on a main session, per the refresh-crew-coordinator researcher lane). a gap over 1h goes cold silently — a guard is ccrow's call
<!-- SECTION:DESCRIPTION:END -->
