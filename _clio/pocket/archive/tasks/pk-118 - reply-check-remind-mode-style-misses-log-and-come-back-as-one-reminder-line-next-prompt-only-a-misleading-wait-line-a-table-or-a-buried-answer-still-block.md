---
id: PK-118
title: >-
  reply-check remind mode: style misses log and come back as one reminder line
  next prompt; only a misleading wait line, a table or a buried answer still
  block
status: done
assignee: []
created_date: '2026-10-13 16:58'
updated_date: '2026-10-14 12:24'
due_date: '2026-10-14'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 1500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima o165 + o168 (order: after the recipe merge, before step 9) + o171 (cclio does the reply-check.py side). skipped at 19:25, wishkeeper caught it 19:58; the hook blocked on style misses 3 times since. first: drop circled-digits, bare-ticket and wait-paren, which the stash mod now fixes on screen (coder 660c8d71). file: ~/.claude/shelf/hooks/reply-check.py
<!-- SECTION:DESCRIPTION:END -->

halt flush 2026-10-13 (o181): add a log-only check — «can't / cannot / impossible» with no backticked command in its paragraph (two unproven can'ts in one day: 18:33 PK-98, 19:26 the hook claim).

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
done 15:26: blocks only a 🔭 on ccrow, cclio's 🔭 without dima, a table, a buried answer; never during a second wind (writing/refreshing). style misses (stamp, ·-list, grill fence, unglossed id, dead link) log + return as one ↩️ line on the next prompt via `reply-check.py --prompt` (UserPromptSubmit in settings.json). unproven can't: log-only. 20 tests, every new branch red-proven.
<!-- SECTION:NOTES:END -->
