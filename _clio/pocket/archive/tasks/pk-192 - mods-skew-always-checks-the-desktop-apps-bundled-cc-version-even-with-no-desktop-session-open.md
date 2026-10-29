---
id: PK-192
title: >-
  mods:skew always checks the desktop app's bundled cc version, even with no
  desktop session open
status: done
assignee: []
created_date: '2026-10-18 17:15'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-25'
labels:
  - xs
dependencies: []
priority: later
type: task
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (its next step after step 4).

dima, 2026-10-18: «I want mods to point to the latest CC version possible, but since the desktop app CC version lags a bit behind the terminal one, I think we should point to the CC version that ships with the desktop app.» today `pnpm mods:skew` (home/.claude/plugin-x/mods/skew.ts) checks only the versions live sessions report in ~/.claude/sessions/*.json, so with no desktop session open a mods commit passes on the terminal's newer engine alone (10-18: desktop 2.1.299, terminal 2.1.301). the fix: read the desktop app's bundled cc version from the app and add it to the checked set; a version with no event list on disk prints «unchecked» as today. done when a mods commit with only a terminal session live still names the desktop version in its skew line.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-431

close: moved — FRM-431 carries this item (its body lists «pocket PK-192») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
