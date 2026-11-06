---
id: PK-332
title: 'side channel unloads the main thread: make the habit hold until tilde decides'
status: open
assignee: []
created_date: '2026-11-06T01:25:00Z'
labels:
  - s
  - side-channel-owned
dependencies: []
priority: next
type: task
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1 (2026-11-06 03:25, dima): remember to use the side channel as a way to unload your main thread, at least until we figure out if tilde will unload your own main lane well enough, so a side channel will be less needed. fold this into another side lane and a pocket item, so i will figure out how to solve it with the side channel as well.

the memory line landed, craft-fleet-flow § lane init. the open part, with him in the side channel: what makes it hold in practice, since a line alone decays: a boot step, a hook that offers the channel on a chore, a measure of how much left the main thread.
<!-- SECTION:DESCRIPTION:END -->
