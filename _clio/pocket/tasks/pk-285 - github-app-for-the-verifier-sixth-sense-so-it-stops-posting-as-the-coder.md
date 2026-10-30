---
id: PK-285
title: github app for the verifier (sixth sense), so it stops posting as the coder
status: open
assignee: []
created_date: '2026-10-29T14:50:00Z'
updated_date: '2026-10-30T16:16:00Z'
due_date: '2026-10-30'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 101010
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1 (2026-10-29 16:49, dima): the fact that we don't have a verifier GitHub app is a novelty for me … let verifier use Coder GitHub app for now … it is actually not good that the verifier currently uses the coder identity to post on GitHub, so let's create a pocket item to create a GitHub app for verifier at some point. (x-reviewer-cc is the ci cloud reviewer on bytes, not the verifier's.)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W485 (2026-10-29 16:49, dima): the verifier app: you're right, and i was wrong.
W486 (2026-10-29 16:49, dima): it exists as x-reviewer-cc, used by bytes' review workflow and its keychain items.
W487 (2026-10-29 16:49, dima): the spec now renames it to x-sixth-sense-cc, and makes the 🔎 verifier write through its own app.
W488 (2026-10-29 16:49, dima): also recorded: x-cw → x-cloud-chat.
W489 (2026-10-29 16:49, dima): wait, i was wrong. i forgot that we have a reviewer as well.
W490 (2026-10-29 16:49, dima): in that case, reviewer shouldn't be used by verifier, because the reviewer GitHub app is used by the CC Cloud reviewer (EG (?) Cloud app that is installed on bytes).
W491 (2026-10-29 16:49, dima): it's a CI code reviewer, but the fact that we don't have a verifier GitHub app is a novelty for me.
W492 (2026-10-29 16:49, dima): i thought we had that, but it's a drift out of scope. let's not create it for now.
W493 (2026-10-29 16:49, dima): let verifier use the coder GitHub app for now, as he currently does, and let's plan to create a GitHub app for verifier later as well.
W494 (2026-10-29 16:49, dima): it is actually not good that the verifier currently uses the coder identity to post on GitHub, so let's create a pocket item to create a GitHub app for verifier 2 at some point.
W495 (2026-10-29 16:49, dima): q1. yes, let's have everyone named according to our lib naming first-hand.

correction 2026-10-29 17:00 (wishkeeper): W485–W488 above are clio's 16:40 reply quoted back in dima's paste, not his words; W487 (x-reviewer-cc → x-sixth-sense-cc) was reversed by dima at W489–W493. the want here is W489–W494.

2026-10-30 16:50: the same outcome on linear — FRM-467's sixth sense posted its clean verdict through x linear comment and it landed under actor «codie»; sixth sense needs its own linear identity beside the github app (its retro, ~/.local/state/x/lanes/mods-lane-3/2026-10-30-FRM-467-sixth-sense-retro.md line 5)

W634 (2026-10-30 16:57, dima): let's solve PK-285.
W642 (2026-10-30 17:12, dima): okay, but it wants an avatar drawn the same as clio, coder and reviewer have.
<!-- SECTION:NOTES:END -->
