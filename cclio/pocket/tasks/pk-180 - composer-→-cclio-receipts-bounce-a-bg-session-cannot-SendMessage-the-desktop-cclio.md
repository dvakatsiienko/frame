---
id: PK-180
title: >-
  composer → cclio receipts bounce: a --bg session cannot SendMessage the
  desktop cclio
status: open
assignee: []
created_date: '2026-10-18 13:41'
updated_date: '2026-10-18 13:44'
due_date: '2026-10-21'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-18: «composer can't reach you out». composer's [done] receipt for b-1018-1 was refused: ListAgents showed «🦉 cclio [2486fc]» (busy, Desktop), the bare name and the [ref] form both refused, and the brief named the session id a9a89164, which the listing does not show. this session's socket /tmp/cc-socks/64978.sock is bound, so it is not the known unbound-socket bug. the prep still landed on disk. find the door (a file receipt the boot polls, or the right address) and fix crew-composer + the boot brief.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: until the weekly reset (2026-10-19 07:00) — dima 10-18: today is the parse, the answers, the small stuff and the viz-tool shape; the pocket is solved after the reset

16:44 update: composer's ack reply DID land here (uds:/tmp/cc-socks/66909.sock → this session), so the channel works; the first [done] bounced on the address (the brief gave a session id and a desktop title). likely fix: the brief names the sender's ListAgents name exactly («🦉 cclio») — prove it on the next composer chore
<!-- SECTION:NOTES:END -->
