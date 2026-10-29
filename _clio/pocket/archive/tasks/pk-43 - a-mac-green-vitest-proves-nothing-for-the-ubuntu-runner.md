---
id: PK-43
title: a mac-green vitest proves nothing for the ubuntu runner
status: done
assignee: []
created_date: '2026-10-09 13:24'
updated_date: '2026-10-09 13:58'
due_date: '2026-10-12'
labels:
  - s
dependencies: []
priority: next
type: question
ordinal: 10500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
#79 verifier 10-09: both 10-07 main reds touched only .md and failed vitest on ubuntu while it passed on the mac; no local gate can catch that. dima 16:24: its own item. options to weigh: a pre-push ci-equivalent run in a linux container, or ci on main gating faster with an auto-revert
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
probe 10-09 16:5x: runner twin = clean clone (no git-crypt filter → ciphertext, like the runner) + empty HOME + CI=1 + vitest. 43 s (clone 2 · install 31 · vitest 10), green on main. red-proof: 25fd2450 (10-07 red 1) → the same 4 recipe-shape fails as ci. red 2 (job-market ciphertext) not replayable, the purge dropped its files; the twin's gmail/blocklist.json reads .GITCRYPT, so the class is covered. script: cclio scratchpad runner-twin.sh

solved 10-09 16:5x: script/runner-twin.sh + pnpm test:twin + lefthook pre-push runner-twin, 8 s, red-proven on the 10-07 head. tests HEAD (the main checkout's push), not each pushed ref
<!-- SECTION:NOTES:END -->
