---
id: PK-180
title: >-
  composer → cclio receipts bounce: a --bg session cannot SendMessage the
  desktop cclio
status: done
assignee: []
created_date: '2026-10-18 13:41'
updated_date: '2026-10-18 16:27'
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

2026-10-18 18:35, dima «now»: an n8n mailbox is live — workflow «composer receipts» (wKzQdHFvCe4lNanM, active) takes POST localhost:5678/webhook/composer-receipt into data table composer_receipts (voy4TaHqBxTY6RWJ); a test row read back. x:crew-composer now posts every receipt line there; composer told live. left: the boot reads the table (GET /api/v1/data-tables/voy4TaHqBxTY6RWJ/rows via op-run) beside the SendMessage, and the first real composer receipt proves it.

18:38 correction (ccrow 18:35): the n8n mailbox is dima's automation DEMO, not this item's fix. the bounce was the address — the fix is composer's brief naming the sender exactly as ListAgents shows it («🦉 cclio»), proven on the next composer chore. the mailbox line now runs jq -n --arg + curl -sf || 'mailbox POST failed' (a quoted chore and a dead endpoint both proven).

19:15, dima's tick (o42): boot step 3 now has the composer brief name the coordinator as «🦉 cclio», exactly as ListAgents prints it. left: proven on the next composer chore (its [done] lands by SendMessage, no bounce).

19:24 proven: composer's held [done] for b-1018-1 landed in 🦉 cclio by SendMessage, no bounce — the brief naming the coordinator «🦉 cclio» is the fix. done.
<!-- SECTION:NOTES:END -->
