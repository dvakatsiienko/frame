---
id: PK-361
title: '_helga folder empty in frame: move data in, make it pretty'
status: done
assignee: []
created_date: '2026-11-09T12:38:00Z'
updated_date: '2026-11-09T13:48:00Z'
labels:
  - s
  - clio-main
dependencies: []
priority: next
type: task
ordinal: 57000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-361:W1 (2026-11-09 inbox, dima): why is the `_helga` folder empty in frame? i expected to see helga's data there

PK-361:W2 (2026-11-09 inbox, dima): if it was forgotten to be moved into frame, move it; if its folder is as messy as `_crow`, take care of it and make it pretty

raw drop (2026-11-09 inbox, dima): **clio main:** why `_helga` folder is empty in frame i exepcted to see helga data there. if it is forgoten to be moved in frame - move. if its folder is same messy as `_crow` — take care of it. and make pretty.

PK-361:W3 (2026-11-09 inbox, dima): why is the _helga folder empty? ❓

2026-11-09 15:05 clio, the answer: _helga emptied on 10-30 (commit d8374fec): its one file was a stale copy of the crew-helga contract that nothing read. helga's runtime state lives in ~/.local/state/helga (msg-watch.txt, skill-lock.bak.json), her contract is the x:crew-helga skill, her start command docs/test-drive/helga.md § the start. nothing was forgotten to move; the empty dir waits for the passport PK-368 proposes

2026-11-09 15:40 clio, correction of the 15:05 note: helga's start command now lives in _helga/AGENTS.md § how it runs, her scripts in x:crew-helga/scripts/

close: PK-361:W1 done (why _helga was empty: the 10-29 rename sweep moved only a boot prompt there, her scripts stayed in _clio/script), PK-361:W2 done (_helga/AGENTS.md born, her scripts moved into x:crew-helga/scripts), PK-361:W3 done (answered on the board, then corrected by dima's 15:08 word)
<!-- SECTION:NOTES:END -->
