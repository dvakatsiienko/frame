---
id: PK-467
title: >-
  fleet weak spots: how to query the whole system for what bottlenecks it, top 5
  directions to optimize
status: open
assignee: []
created_date: '2026-11-24T11:46:00Z'
updated_date: '2026-11-24T11:50:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-467:W1 (2026-11-24 13:44, dima): slight deviation from a plan.

PK-467:W2 (2026-11-24 13:44, dima): During recent time I observed that our flows get issues here and there all the time, like hung fleet, roasted CPU, communications issues, and overall not-good peaks, like with the zoo layout for Herdr or with

PK-467:W3 (2026-11-24 13:44, dima): The worst incident was the guard that we were building for a month and then deleted because it locked out everyone.

PK-467:W4 (2026-11-24 13:44, dima): Also our system still keeps growing.

PK-467:W5 (2026-11-24 13:44, dima): We also have the CLI, which I still don't know if it is worth the effort that we put into building.

PK-467:W6 (2026-11-24 13:44, dima): I still doubt that we have it because, for example, we build a lot around linear there.

PK-467:W7 (2026-11-24 13:44, dima): If we, for example, would move out from linear to something else, then the whole build is kind of not needed anymore.

PK-467:W8 (2026-11-24 13:44, dima): Because of those thoughts I wanted to ask you some general question, which I don't expect to take immediate actions on, but I wanted more to know what's wrong with the system.

PK-467:W9 (2026-11-24 13:44, dima): Here is my query.

PK-467:W10 (2026-11-24 13:44, dima): It looks like this:

PK-467:W11 (2026-11-24 13:44, dima): ask wing what bottlenecks fleet flow, me and my system.

PK-467:W12 (2026-11-24 13:44, dima): suggest stop 5 areas/directions where, why and how to optimize

PK-467:W13 (2026-11-24 13:44, dima): I want you to propose how to query our system as a whole.

PK-467:W14 (2026-11-24 13:44, dima): For example if I asked you to find the weakest spots in our whole flow (including all levels, the comms, the linear, the tickets, the summoning of everyone, and how we do stuff usually), how would you propose to hunt those weak spots? ❓

PK-467:W15 (2026-11-24 13:44, dima): How would you do that? ❓

PK-467:W16 (2026-11-24 13:44, dima): plus: is system checkup helps with my query or it is something different? ❓

PK-467:W17 (2026-11-24 13:44, dima): (i initially wanted system checkup to answer that query i just asked)

PK-467:W18 (2026-11-24 13:50, dima): any recipes applicable with my ask? ❓

PK-467:W19 (2026-11-24 13:50, dima): and also: how to automate my ask? ❓

PK-467:W20 (2026-11-24 13:50, dima): so i don't repeat it next time? ❓

PK-467:W21 (2026-11-24 13:50, dima): (answer before starting)

PK-467:W22 (2026-11-24 13:50, dima): fold as a part of system-checkup? ❓
<!-- SECTION:NOTES:END -->
