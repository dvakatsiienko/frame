---
id: PK-19
title: '[56] count bare fleet words in cclio''s replies, mod it if it grows'
status: open
assignee: []
created_date: '2026-10-09 10:38'
labels: []
dependencies: []
priority: later
type: test-drive
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 56 · status line was: open · test-drive

- dima, 2026-10-08: «pocket it and count error occurrences, if it grows — mod it». the miss: «that becomes a wisp» printed plain, where the rule says **✨ wisp**, bold with its badge
- the count: at each halt, 🪶 sifter counts this session's replies that print `wisp`, `wish`, `siesta` or `freebie` without the bold + badge (`lane` is left out — too common as a plain word, false positives). one line per halt in `docs/test-drive/reply-check.md`
- 17:51 dima approved the autofix instead: x-mod-stash bolds + badges a bare fleet word pre-render (sent to the mods coder). the halt count now reads the fixer's own hit counter — a hit is a miss of mine it caught. shipped 18:14 (mods coder, live-proven): hits live in x-mod-stash's store under `words:<yyyy-mm-dd>:<sid>`
<!-- SECTION:DESCRIPTION:END -->
