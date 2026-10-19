---
id: PK-105
title: >-
  nested AGENTS.md split: hunt candidates across frame + bytes, propose the
  tactic
status: done
assignee: []
created_date: '2026-10-13 10:40'
updated_date: '2026-10-13 12:17'
due_date: '2026-10-20'
labels:
  - s
dependencies: []
priority: later
type: wish
ordinal: 100106
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-13: ccrow proposed splitting trophy-sys AGENTS.md into nested AGENTS.md files beside the parts they cover (charts, auth). «that acts as memory lazy loading — it granularizes global resident memory into situational parts. how do we get maximal gains globally? maybe a targeted subagent hunts good candidates across frame and bytes. think how to do this from your side with the most precise tactic and propose it.» pairs with the 10-12 nested-AGENTS.md rule (loads on Read and on a Bash read).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
hunted 10-13: ~/frame/.scratch/research/nested-agents-hunt.md — ~54 resident lines can leave (bytes root ~37, frame root ~15, rules 2) + ~100 in app files; top 3: bytes ui-kit → packages/kit/AGENTS.md, trophy-sys deploy → script/ + src/server/, trophy-sys web → src/web/. found stale: trophy-sys AGENTS.md:97-101 says git-triggered deploys, vercel.json has deploymentEnabled false. waits for dima's pick (orbit).

parked: waits for dima's pick in orbit (researched, nothing left for cclio)

landed 10-13 (uncommitted in bytes): 3 moves, bytes root 158 → 133, trophy-sys 178 → 124, 2 new nested files; 4 Read probes loaded; stale git-triggered deploy lines deleted
<!-- SECTION:NOTES:END -->
