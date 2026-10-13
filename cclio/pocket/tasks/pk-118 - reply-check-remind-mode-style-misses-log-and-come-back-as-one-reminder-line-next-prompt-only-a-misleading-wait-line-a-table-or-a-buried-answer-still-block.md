---
id: PK-118
title: >-
  reply-check remind mode: style misses log and come back as one reminder line
  next prompt; only a misleading wait line, a table or a buried answer still
  block
type: task
status: open
assignee: []
created_date: '2026-10-13 16:58'
due_date: '2026-10-14'
labels:
  - s
dependencies: []
priority: now
ordinal: 1500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima o165 + o168 (order: after the recipe merge, before step 9) + o171 (cclio does the reply-check.py side). skipped at 19:25, wishkeeper caught it 19:58; the hook blocked on style misses 3 times since. first: drop circled-digits, bare-ticket and wait-paren, which the stash mod now fixes on screen (coder 660c8d71). file: ~/.claude/shelf/hooks/reply-check.py
<!-- SECTION:DESCRIPTION:END -->

halt flush 2026-10-13 (o181): add a log-only check — «can't / cannot / impossible» with no backticked command in its paragraph (two unproven can'ts in one day: 18:33 PK-98, 19:26 the hook claim).
