---
id: PK-129
title: >-
  ccrow stale wake: ccrow:stop used a stale id, and a wake packet built 10-13
  20:28 reached the fresh ccrow 18 h later
status: open
assignee: []
created_date: '2026-10-14 11:48'
updated_date: '2026-10-14 11:48'
due_date: '2026-10-16'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 100008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ccrow note 2026-10-14 14:47 (vet 202610132028-opus): packets/202610132028/packet.md mtime 10-13 20:28, meter line from yesterday; ccrow/wake.ts:42 skips only when ccrow is not running, and the stop's stale id left it running. fix: ccrow:stop reads the live id; a wake refuses a packet older than its gap, so a fresh ccrow never advises on a dead state. dima's 10-12 steer on silent loss in comms layers.
<!-- SECTION:DESCRIPTION:END -->
