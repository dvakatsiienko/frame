---
id: PK-304
title: 'api credits channel: plan where the $200 a month goes (shape-idea)'
status: open
assignee: []
created_date: '2026-11-03T08:43:00Z'
updated_date: '2026-11-06T16:23:00Z'
labels:
  - m
  - wing-1
dependencies: []
priority: next
type: wish
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PK-304:W1556 (2026-11-03 10:37, dima): 💳 the $200 api credits — where they go ← look more precisely where we could spend them, because it actually matters.
PK-304:W1557 (2026-11-03 10:37, dima): it's a free channel for us in that case, well, almost free, with a $200 limit.
PK-304:W1558 (2026-11-03 10:37, dima): let's plan upfront what we can do with that.
PK-304:W1560 (2026-11-03 10:37, dima): or did you tell me about this specific case: even if i sign in with cc with api billing, i will still not be able to spend that? ❓
PK-304:W1561 (2026-11-03 10:37, dima): if so, propose how to spend them.
PK-304:W1665 (2026-11-03 10:29, dima): the included api credits ($200 on ultra) don't work in claude code, so they add no coding value.
PK-304:W1666 (2026-11-03 10:29, dima): where/how to spend them then? ❓
PK-304:W1678 (2026-11-03 10:58, dima): also, i spotted that i actually have $100 on the account currently as well.
PK-304:W1679 (2026-11-03 10:58, dima): is this part of my current $100 plan, or what? ❓
PK-304:W1680 (2026-11-03 10:58, dima): we theoretically can use it even now somehow? ❓
PK-304:W1681 (2026-11-03 10:58, dima): if so, how to probe it? ❓
PK-304:W1687 (2026-11-03 11:13, dima): so we create a question mark.
PK-304:W1688 (2026-11-03 11:13, dima): what about `expires`? ❓
PK-304:W1689 (2026-11-03 11:13, dima): i want it to never expire.
PK-304:W1690 (2026-11-03 11:13, dima): is it a good practice, or fine practice, to set it to no expire? ❓
PK-304:W1691 (2026-11-03 11:13, dima): i don't like to recreate keys often.
PK-304:W1692 (2026-11-03 11:14, dima): damn, i did not copy a key; create a new one (delete the old).
PK-304:W1693 (2026-11-03 11:14, dima): and create a 1p entry.
PK-304:W1694 (2026-11-03 11:17, dima): done, and 1p entry renamed to anthropic-api-key.
PK-304:W1695 (2026-11-03 11:17, dima): correction: new name anthropic-api-golden.
PK-304:W1696 (2026-11-03 11:32, dima): are you sure you used this retro via API? ❓
PK-304:W1697 (2026-11-03 11:32, dima): current usage still shows $100 on the dashboard in the browser pane.
PK-304:W1698 (2026-11-03 11:37, dima): well, that just spent 55$ of usage. that's a lot.
PK-304:W1699 (2026-11-03 11:37, dima): how much weekly usage in my current plan would that use if run without an api key? roughly? ❓
PK-304:W1705 (2026-11-03 10:37, dima, o4 steer): i prefer my plan.
PK-304:W1706 (2026-11-03 10:52, dima, o9 steer): let's try to adjust surface usage, but let's make it via some easy switch.
PK-304:W1707 (2026-11-03 10:52, dima, o9 steer): when, for example, we use that $200 on API, we could easily switch everything back to subscription mode.
PK-304:W1708 (2026-11-03 10:52, dima, o9 steer): ideally, it works via some kind of single switch or environment variable, maybe.
PK-304:W1709 (2026-11-03 10:52, dima, o11 steer): yes, i never buy API credits.
PK-304:W1710 (2026-11-03 10:52, dima, o11 steer): i only use the gifted ones.
PK-304:W1711 (2026-11-03 10:52, dima, o12 steer): should i create a new key right now, or is it better to do it when it's the appropriate time? ❓
PK-304:W1712 (2026-11-03 10:52, dima, o12 steer): if now works, let's have one now.
PK-304:W1713 (2026-11-03 10:52, dima, o12 steer): go open a browser pane and do everything.
PK-304:W1714 (2026-11-03 11:06, dima, o15 steer): auto-reload off, so the balance does not pull from my wallet.
PK-304:W1715 (2026-11-03 11:06, dima, o16 steer): let's try! any other option other than jev? ❓
PK-304:W1716 (2026-11-03 11:06, dima, o16 steer): jev requires prep steps and a proper understanding of how to actually tune it, so it can be a redundant work-time effort to spend it on jev.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
kept: 2026-11-03 — FRM-224 (nvim) is a false match; no linear ticket owns the api credits; the five candidate uses are in clio's 10:39 reply; shape-idea runs after mods lane 4's first final (dima's o8)

PK-304:W1559 (2026-11-03 10:37, dima): claude code works with a few modes. it works via subscription mode and api mode, so i could actually sign in to cc via api, and maybe that way i would use api credits.

kept: 2026-11-03 — W1665–W1666, W1678–W1681, W1687–W1699, W1705–W1716 joined from the 11:xx turns: the key, the switch (o9), gifted credits only (o11, o15), the batch retro spend; round 2 of shape-idea grills them

PK-304:W1567 (2026-11-03 10:43, dima): 🛠️ where we could spend them (ideas, nothing built).

label fix (wishkeeper 12:20): W1665 and W1567 are clio's reply lines dima quoted — context, not his wants; grill 2 cites his «←» answers, never these.
<!-- SECTION:NOTES:END -->
