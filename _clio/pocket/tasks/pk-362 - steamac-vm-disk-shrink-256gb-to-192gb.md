---
id: PK-362
title: 'steamac vm disk: shrink 256gb to 192gb'
status: open
assignee: []
created_date: '2026-11-09T12:38:00Z'
updated_date: '2026-11-09T13:20:00Z'
labels:
  - s
  - clio-wing-2
dependencies: []
priority: next
type: task
ordinal: 50000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-362:W1 (2026-11-09 inbox, dima): i grew the vm's allocated space to 256gb with «grow disk», but i want 192gb

PK-362:W2 (2026-11-09 inbox, dima): «grow disk» only increases the allocated space; it cannot decrease it

raw drop (2026-11-09 inbox, dima): **clio main (when have a free spot)**: my steam fx launcher — i extended vm allocated space to 256gb via «grow disk» feature but no want set it to 192gb. although «grow disk» only allows to increase allocated space not decrease. how to decrease it?

PK-362:W3 (2026-11-09 inbox, dima): how do i decrease it? when you have a free spot ❓

2026-11-09 15:05 clio, the read: steamos.img is 278 GB apparent, 252 GB on disk, the mac has 184 GiB free; steamac has no shrink door, only Grow Disk. a shrink is a hand job on the raw image: shrink /home's filesystem offline, then its partition, then truncate the file; any slip loses the games. cheaper doors: leave it (252 GB is real use, not reserve) or a fresh 192 GB disk plus a game re-download. inference: /home is ext4 as on stock SteamOS, unchecked

PK-362:W4 (2026-11-09 15:20, dima): the vm shows 12.3 GB free of 254.4 GB (lots of games downloaded for testing), so the actual cut is paused; trimming later, no space atm.
PK-362:W5 (2026-11-09 15:20, dima): i want an answer to how to reduce the vm's allocated size: to have a smaller one, do i create a new slice, download the games there, then delete the old one? ❓
PK-362:W6 (2026-11-09 15:20, dima): are you sure there is no way to reduce the allocated size to the current disk? it would be good to grow and shrink the vm's allocated size both ways.
15:22 wing 2: gh search fxgl/steamac shrink and «disk size»: no issue; latest v1.9.13; README names Grow Disk and new disks only. answered in the thread.
<!-- SECTION:NOTES:END -->
