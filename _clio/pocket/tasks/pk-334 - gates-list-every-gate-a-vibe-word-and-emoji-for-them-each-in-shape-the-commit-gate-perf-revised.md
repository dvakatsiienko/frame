---
id: PK-334
title: >-
  gates: list every gate, a vibe word and emoji for them, each in shape; the
  commit gate perf revised
status: done
assignee: []
created_date: '2026-11-06T11:45:00Z'
updated_date: '2026-11-07T15:02:00Z'
labels:
  - m
  - wing-1
dependencies: []
priority: next
type: task
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 11-06, for the side channel; rides PK-328
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-334:W1 (2026-11-06 inbox, dima): list all possible gates at all list places, like the commit gate and the red prof gate.
PK-334:W2 (2026-11-06 inbox, dima): i want our gate as a vibe word, and a top-seven emoji, so we treat all gates properly.
PK-334:W3 (2026-11-06 inbox, dima): and maintain them.
PK-334:W4 (2026-11-06 inbox, dima): all gates should have a clear purpose, be relevant, and be in good shape.
PK-334:W5 (2026-11-06 inbox, dima): per wise (?), i spotted that the commit gate should be perf revised: it's slow. optimize it.
raw drop (11-06 inbox, dima): for side channel
raw drop (11-06 inbox, dima): list all possible gates at all list places. like commit gate red prof gate, i want to have our gate as vibe word. and top seven emoji. so we treat all gates properly. and maintain them. all gates should have clear purpose and be relevant and in a good shape. including per wise i spotted that commit gate should be perf revised its slow. optimize it.

from 11-07's retros, for the gates list: a glossary line inside a bullet is refused only after the commit's queue wait, 476 s (cli 5 codie): the gate could read the message before the turn; a one-line crew skill edit shows its size cap only on ci, `script/lib/skill-size.test.ts` runs by hand before a push (cli 6 codie).

x lane commit from _clio with a path not relative to the repo root says «the path list arrived as one word» (x/go/lane.go:167): a path with spaces reads as a lost split; fix the wording, or resolve from the cwd. from the 11-07 flush.

from 11-07's halt commit: memory-lint went red in 0.27 s, and the hook still ran test for 32 s before reporting: a cheap gate that fails first could stop the rest (lefthook runs them in parallel; read before changing).

PK-334:W6 (2026-11-07 16:40, dima): i want all gates to have consistent names: a lot of differently named gates is confusing and not good.
PK-334:W7 (2026-11-07 16:40, dima): let's first start with the list: explain to me, compact and easy to understand, all the gates the fleet has.
PK-334:W8 (2026-11-07 16:40, dima): then propose how to have a unified file, in a way that the fleet is actually aware of it.
PK-334:W9 (2026-11-07 16:40, dima): any time a new gate is invented and added to the fleet, it first always must be added to this list too, so the list always reflects the actual state of all gates.
PK-334:W10 (2026-11-07 16:40, dima): if a gate gets fully deleted across the fleet, it leaves this file too.
16:41: the plain list and the proposal printed to him; waiting on his ticks: the word, the file plus its check.

ticket: FRM-530
close: 2026-11-07 — the want, the list and the clarified want moved to FRM-530, his raw drop stays here; FRM-530:W1 to W10 are this item's W1 to W10, W11 his 16:59 fold

close: PK-334:W1–PK-334:W10 moved to FRM-530:W1–FRM-530:W10, same order
<!-- SECTION:NOTES:END -->
