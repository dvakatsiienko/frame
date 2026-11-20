---
id: PK-462
title: >-
  research log: every research dima asks for, dated, its query, his wishes and a
  summary, kept past its files
status: done
assignee: []
created_date: '2026-11-20T17:54:00Z'
updated_date: '2026-11-20T18:08:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 77000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-462:W1 (2026-11-20 19:54, dima): i often ask you to research topics, like this ui sdk, or other stuff i probe, try or want to try, and not all of it gets a test drive. the ui sdk is a sound idea but raw: i don't want it even in a test drive now, because it can't prove itself yet and may be just hype; yet the idea is sound, and it can evolve into something more useful.
PK-462:W2 (2026-11-20 19:54, dima): broadly, i want a research history system: a log of our research and my interests, whether or not we picked a thing for a test drive. what we research and pull into a test drive is visible, we know about it.
PK-462:W3 (2026-11-20 19:54, dima): when i ask for research and we set no test drive, even for a promising tool like the ui sdk, the research files get deleted at some point and we forget about it. i want the log and history of my research requests, so you can query my requests and results to know what i'm interested in; maybe even keep the history of some research.
PK-462:W4 (2026-11-20 19:54, dima): ❓ is it worth creating a log for the research? each entry: the date, roughly the query, the wishes behind it (what we researched it for), a brief summary; maybe not the full research files, since they get deleted, but the summary is worth keeping.
PK-462:W5 (2026-11-20 19:54, dima): the structure: a folder with files by date and topic, easy to query, easy to search, and easy to restructure in the future. ❓ how do you think?

PK-462:W6 (2026-11-20 19:59, dima): ❓ how do you make this habit work in every way? wouldn't you forget about it?
PK-462:W7 (2026-11-20 19:59, dima): what i expect: we research a topic once (today, the ui sdk); in 2 months i want to refresh that area, given we are still not test-driving or using it.
PK-462:W8 (2026-11-20 19:59, dima): the new research is combined with the previous one, or at least considers it: each new research queries the research log for earlier research on its topic, leaving unrelated topics out. ❓ is it possible?

PK-462:W9 (2026-11-20 20:06, dima): when we research a topic we already researched, i see three ways: 1. rewrite the research doc fully; 2. merge it, a refresh that actualizes instead of a full rewrite; 3. keep the old research and create a new file for each new research, even on the same topic.
PK-462:W10 (2026-11-20 20:06, dima): i think the last one is best, because it keeps the history, but i may be wrong; ❓ propose how best to keep the research history, i'm not sure about my pick.
20:06 round 1 settled by his o25–o31 ticks: a) one-offs only, a repeat points to its recipe; the name research-log; the entry shape; the command writes it; earlier entries read first; look-again watches; the ui sdk research is entry one

ticket: FRM-675
close: PK-462:W1 moved; PK-462:W2 moved; PK-462:W3 moved; PK-462:W4 moved; PK-462:W5 moved; PK-462:W6 moved; PK-462:W7 moved; PK-462:W8 moved; PK-462:W9 moved; PK-462:W10 moved (all to FRM-675's wish block)
<!-- SECTION:NOTES:END -->
