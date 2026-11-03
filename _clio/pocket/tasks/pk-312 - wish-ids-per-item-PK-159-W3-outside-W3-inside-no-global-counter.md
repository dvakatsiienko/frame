---
id: PK-312
title: 'wish ids per item: PK-159:W3 outside, W3 inside, no global counter'
status: open
assignee: []
created_date: '2026-11-03T14:29:00Z'
updated_date: '2026-11-03T14:42:00Z'
labels:
  - m
dependencies: []
priority: later
type: task
ordinal: 101010
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
relayed from the side channel 16:28; W-lines from helga's groom of grooms/2026-11-03-1626.raw.md. 📌 wish-cover.ts:12,21,23,33 parse W\d+ and name the merge hazard of two blocks restarting at W1; the colon is picked over a hyphen (range parse) and a plus (url space). new surface across wish-cover, pocket-check, prompt-groom and helga → shape-idea, after the 19:00 reset
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1919 (2026-11-03 16:26, dima, in the side channel): my word IDs get too long… after some time, the number will be like 100k IDs.
W1920 (2026-11-03 16:26, dima, in the side channel): Can we have another identification system so the IDs are shorter? ❓
W1921 (2026-11-03 16:26, dima, in the side channel): I'm not a fan of white space.

decided (dima's tick o19 in the side channel, 16:28, relayed): a wish id cited from elsewhere reads PK-159:W3, bare W3 inside its own item; the colon over a hyphen (wish-cover's range parse) and a plus (a url space)

Q8 (2026-11-03 16:39, clio, quoted by dima): Say PK-312 has W1–W3 and moves to Linear as [FRM-500](https://linear.app/x-com/issue/FRM-500). [FRM-500](https://linear.app/x-com/issue/FRM-500)'s wish block then cites `PK-312:W1`, `PK-312:W2` and so on, always with the prefix.
W1922 (2026-11-03 16:39, dima): But if a PK312 moves to FRM500, then PK312 no longer exists, and it points to the wrong PK: a non-existing ticket.
W1923 (2026-11-03 16:39, dima): Maybe it's better to make it so that if a pocket item moves to Linear, its IDs for chords get converted to the corresponding Linear ticket? Or it's fine? ❓

decided (dima's tick o98, 16:41): a pocket wish moving to linear is renumbered into the ticket's series (PK-312:Wn → FRM-500:Wn); the archived item keeps «moved: W1–W3 → FRM-500:W1–W3». replaces o95's birth-id-forever
<!-- SECTION:NOTES:END -->
