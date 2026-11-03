---
id: PK-315
title: 'x-mod-stash wisp: a --bg session''s second wind compacts but never ingests'
status: open
assignee: []
created_date: '2026-11-03T19:13:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
from the side channel, 21:12 (dima's word 21:09). seen: crow 20:43 — orbit second-wind with crow-1 ran /compact (boundary 20:43:59), no /x:handoff-ingest row followed; crow idled on the summary until a nudge at 21:01; crow-1 sat in the store 18 min; dima's shot shows /compact drawn twice. code: runWind queues both at once (plugin-x/mods/x-mod-stash/hooks/register.tsx:2529-2535); its catch only toasts, which a --bg session never shows; the mod reloaded in crow's session at 20:48, mid-gap. cause (inference): the cli engine drops the second queued command after a compact (engine.md:62 probed on desktop only), or the 20:48 reload cleared the queue. proof: a second wind on a throwaway --bg session, no mod reload. fix ideas: after the compact, check the ingest ran and re-run it (store key still refreshing + the slug still in the store); crow's wake flags a pending handoff of its own. home after the proof: a mods rider (a fix, no new surface).
<!-- SECTION:DESCRIPTION:END -->
