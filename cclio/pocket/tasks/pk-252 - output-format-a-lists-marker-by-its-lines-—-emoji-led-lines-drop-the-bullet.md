---
id: PK-252
title: 'output format: a list''s marker by its lines — emoji-led lines drop the bullet'
status: done
assignee: []
created_date: '2026-10-22T15:23:00Z'
updated_date: '2026-10-22T16:12:00Z'
due_date: '2026-10-23'
labels:
  - xs
dependencies: []
priority: now
type: wish
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1 some lists read better without bullet points: a line with no emoji that serves as a list always has a bullet point
W2 a set of lines that is good to order by numbers gets numbers
W3 a list whose items lead with an emoji is not bullet-listed: a bullet point plus a leading emoji reads poorly; the emoji already marks the line
W4 update the output formatting for everyone with this leading-emoji rule
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-22 18:23 dima, raw (Wispr, 4 screenshots: two «good» lists, a bulleted emoji list marked «bullet points hurt here», the same lines unbulleted marked «better»): «I have some aside asks about output formatting. You and the entire fleet currently print lists in different kinds of shapes, preferring bullet points, which is fine, but there is some granularity for it that I would like to fix. … If a line doesn't have an emoji and it serves as a list, it always has a bullet point. If a set of lines is good to be ordered by numbers, numbers are good. If a list of items has a leading emoji and it looks like a list, it shouldn't be bullet-listed. Why? Because a bullet point plus an emoji that leads a line reads poorly. It reads better if those lines are emoji-led but don't have a bullet point.» then: «Update the output formatting for everyone with this leading emoji thing.»
done 18:25: rules/fleet-output-format.md § shapes «a list's marker by its lines» + § emoji example, resident for every member

close: W1 done, W2 done, W3 done, W4 done — rules/fleet-output-format.md § shapes and § emoji

correction: W3's «the emoji already marks the line» is cclio's gloss, not his words
<!-- SECTION:NOTES:END -->
