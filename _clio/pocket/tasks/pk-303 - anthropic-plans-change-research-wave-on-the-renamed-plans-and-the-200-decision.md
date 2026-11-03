---
id: PK-303
title: >-
  anthropic plans change: research wave on the renamed plans and the $200
  decision
status: done
assignee: []
created_date: '2026-11-03T08:04:00Z'
updated_date: '2026-11-03T10:06:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1528 (2026-11-03 inbox, dima): the claude code usage plans changed a few days ago: they are named differently now, the rules of the plan previously called max changed and it is now called ultra; the previous max x5 is now called max.
W1529 (2026-11-03 inbox, dima): when you have a free window, spawn a research wave on this change: what changed compared to the previous rules, how the new plans work now, and what changes for me with my previously decided plan to buy a $200 plan. ❓
W1530 (2026-11-03 inbox, dima): read this video via yt-transcript transit mode: https://youtu.be/Hq2c7pww1Ds
W1663 (2026-11-03 10:29, dima): ultra ($200, was «max 20x») has no 5-hour limit on a verified account, and 10× pro per week.
W1664 (2026-11-03 10:29, dima): what is «verified account» and how to have it? ❓
W1667 (2026-11-03 10:29, dima): upgrading max → ultra is prorated. buying fresh after a lapse might bring back the «unverified» 5-hour limit (unconfirmed).
W1668 (2026-11-03 10:29, dima): after the switch, check settings → usage: a «current session» bar there means you're not verified yet.
W1669 (2026-11-03 10:29, dima): what does it mean, prorated? ❓
W1670 (2026-11-03 10:29, dima): i planned this: i cancelled now, i wait for the plan to fully stop, rest a day, then buy 200$.
W1671 (2026-11-03 10:29, dima): will this work, or better upgrade without a «pause»? ❓
W1672 (2026-11-03 10:29, dima): i will have some benefits if i upgrade from current plan without it gets expired? ❓
W1673 (2026-11-03 10:29, dima): upgrade from max instead of letting max lapse: auto-renew being off puts that at risk.
W1674 (2026-11-03 10:29, dima): why upgrade from max, not letting it lapse? ❓
W1675 (2026-11-03 10:57, dima): i signed in.
W1676 (2026-11-03 10:57, dima): reddit 403 bot protection? ❓
W1677 (2026-11-03 10:57, dima): did you try the firecrawl workaround? ❓
W1682 (2026-11-03 11:06, dima): new plans.
W1683 (2026-11-03 11:06, dima): i dropped a wrong video link in an inbox related to this question; here is the correct one: /x:yt-transcript transit https://youtu.be/y5TEATUDDfc
W1684 (2026-11-03 11:06, dima): any new info? ❓
W1685 (2026-11-03 11:06, dima): 📌 found a rule clash: 🦉 clio's «never route around a blocked fetch» vs the tooling rule that names firecrawl. logged for a fix.
W1686 (2026-11-03 11:06, dima): fix now, it's freebie.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
raw drop (11-03 inbox, dima): **anthropic plans update**

raw drop (11-03 inbox, dima): Just a few days ago the usage plans changed for Claude Code. Now the plans are named differently and something is changed in the rules for the plan that was previously called Max and is now called Ultra. The previous Max X5 is now Max.

raw drop (11-03 inbox, dima): When you have a free window spawn a research wave to gather information about this change: what changed compared to previous rules, how the new plans currently work, and what changes for me with my previously decided plan to buy a $200 plan.

raw drop (11-03 inbox, dima): read [this video](https://youtu.be/Hq2c7pww1Ds) via yt-transcript transit mode.

raw drop (2026-11-03 inbox, dima): **anthropic plans update**

raw drop (2026-11-03 inbox, dima): Just a few days ago the usage plans changed for Claude Code. Now the plans are named differently and something is changed in the rules for the plan that was previously called Max and is now called Ultra. The previous Max X5 is now Max.

raw drop (2026-11-03 inbox, dima): When you have a free window spawn a research wave to gather information about this change: what changed compared to previous rules, how the new plans currently work, and what changes for me with my previously decided plan to buy a $200 plan.

raw drop (2026-11-03 inbox, dima): read [this video](https://youtu.be/Hq2c7pww1Ds) via yt-transcript transit mode.

close: W1528, W1529, W1530 done — research in docs/research/claude-plans-2026-11.md (rename, ultra verification, the api credits, the unverified 5h window, reddit), both videos read in transit; dima picked his lapse plan (o4) and the credits channel moved to PK-304

close: W1663, W1664, W1667–W1677, W1682–W1686 done — answered in the 11-03 thread (verification, proration, lapse vs upgrade, firecrawl vs reddit, the right video, the fetch-rule fix eae1b240)

close: W1663, W1664, W1667, W1668, W1669, W1670, W1671, W1672, W1673, W1674, W1675, W1676, W1677, W1682, W1683, W1684, W1685, W1686 done — answered in the 11-03 thread; the fetch-rule fix landed in eae1b240

W1549 (2026-11-03 10:17, dima): then pk-303 — how plans changed? what changed? ❓
W1550 (2026-11-03 10:17, dima): what should i buy now? ❓
W1551 (2026-11-03 10:17, dima): my $200 plan still valid? ❓
W1552 (2026-11-03 10:17, dima): will i have more usage? ❓
W1553 (2026-11-03 10:17, dima): or is my current $100 plan now more spacious too? ❓
W1554 (2026-11-03 10:37, dima): verified account ← if there is any info on the median time verification takes, will i have my account verified in a day or two, in a week or two, or in a month or two? ❓
W1555 (2026-11-03 10:37, dima): verified account: it directly affects me, because i like the 5-hour window to be gone asap.
W1562 (2026-11-03 10:43, dima): 5h window is the same for $100 and $200? ❓
W1563 (2026-11-03 10:43, dima): with the $100 plan, a fully filled 5-hour window equals roughly 15% of weekly usage, from my observation.
W1564 (2026-11-03 10:43, dima): how will it then be on the $200 plan? ❓
W1565 (2026-11-03 10:43, dima): the same-sized 5-hour window will equal roughly 7.5% of weekly usage, or what? ❓
W1566 (2026-11-03 10:43, dima): if that is the case, then the $200 plan is not so attractive, because the 5-hour window will then be a blocker for me.
W1568 (2026-11-03 10:43, dima): let's plan all of this.
W1569 (2026-11-03 10:43, dima): where best to store this pre-plan? ❓
W1570 (2026-11-03 10:47, dima): yes, exactly. i can have verification 3 weeks after i buy the plan, and will have to spend most of the time with a 5-hour window enabled.
W1571 (2026-11-03 10:47, dima): that's why i clarify: the speed of the account verification process matters for me, and its actual size too.
W1572 (2026-11-03 10:47, dima): if this wasn't covered with research, can you search more about the 5-hour window difference between the $100 plan and the $200 plan? ❓
W1573 (2026-11-03 10:47, dima): i'd like to know the details to plan accordingly.
W1574 (2026-11-03 10:47, dima): let's then shape idea right away, while the topic is hot? ❓

close: W1549–W1555, W1562–W1566, W1570–W1573 done — answered in ~/frame/docs/research/claude-plans-2026-11.md and dima's o4 lapse plan (max ends 11-05, ultra bought fresh 11-06); W1568, W1569, W1574 moved → PK-304 (the shape-idea of where the $200 goes)

close: done, answered in docs/research/claude-plans-2026-11.md and the o4 lapse plan: W1549 W1550 W1551 W1552 W1553 W1554 W1555 W1562 W1563 W1564 W1565 W1566 W1570 W1571 W1572 W1573; moved → PK-304: W1568 W1569 W1574
<!-- SECTION:NOTES:END -->
