---
id: PK-121
title: 'wispr:add refuses a phrase that is a dictionary word unless --force'
status: done
assignee: []
created_date: '2026-10-13 17:07'
updated_date: '2026-10-14 12:26'
due_date: '2026-10-15'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 10100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
halt flush 2026-10-13 (o181): «hold» → halt went in at 20:03 against dima-signals («skip an add whose heard side is a real word»), reverted by a soft delete. check /usr/share/dict/words in script/wispr-add.ts.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
done 15:33: script/wispr-add.ts refuses a heard side made only of /usr/share/dict/words words (exit 2) unless --force; probed: hold, now know refused; Quards → chords passed (a mapping the dima-signals rule names).
<!-- SECTION:NOTES:END -->
