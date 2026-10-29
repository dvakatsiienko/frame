---
id: PK-129
title: >-
  ccrow stale wake: ccrow:stop used a stale id, and a wake packet built 10-13
  20:28 reached the fresh ccrow 18 h later
status: done
assignee: []
created_date: '2026-10-14 11:48'
updated_date: '2026-10-14 13:23'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
16:23 done: the stale id half was already fixed (stop.ts reads findSession, not a cached id); the real path was relay.json — a wake parked for a desktop-tab ccrow survived the night. dropStaleRelay drops it past the 30-min gap at every cclio prompt and at ccrow start. 90 ccrow tests, red-proven.
<!-- SECTION:NOTES:END -->
