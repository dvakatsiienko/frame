---
id: PK-184
title: >-
  firecrawl trial — crawl one docs site into a knowledge file on the free tier,
  scored against exa subpages + parallel extract
status: done
assignee: []
created_date: '2026-10-18 16:35'
updated_date: '2026-10-19 17:06'
due_date: '2026-11-02'
labels:
  - s
dependencies: []
priority: next
type: test-drive
ordinal: 10700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's tick o48, 2026-10-18: a narrow test drive, never a third fan-out lane (PK-177's three lanes agree; files cclio/.scratch/research-firecrawl/). first step: dima signs up for the free tier (1,000 credits, no card), the key goes to 1password dev/firecrawl-golden; card docs/test-drive/firecrawl.md via cclio:shape-test-drive. score: page coverage, markdown quality, credits used.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
10-19: four rounds (docs/test-drive/firecrawl.md, commit 3e49d66b): r1 cc docs 227/227 pages, answers tie with a WebFetch researcher at +52 % tokens, site serves llms-full.txt; r2 n8n serves llms.txt; r3 NMS wiki — the free MediaWiki api beats firecrawl's map (91 of 3,535); r4 PSNProfiles 403 for curl and WebFetch, 200 for firecrawl (the NMS guide: 117k chars, 4 s, 1 credit). verdict ticked: adopt narrow, bot-blocked sites only, live to 11-02 for the cw games thread. 731 credits left.

10-19: verdict ticked — adopt narrow (bot-blocked sites, via pnpm web:read); the trial stays live to 11-02 for the cw games thread.

2026-10-19 20:08 done (dima o106): verdict adopt-narrow ticked (bot-blocked sites through pnpm web:read); docs/test-drive/firecrawl.md carries the trial to 11-02 for the cw games thread.
<!-- SECTION:NOTES:END -->
