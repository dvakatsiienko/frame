---
id: PK-362
title: 'steamac vm disk: shrink 256gb to 192gb'
status: open
assignee: []
created_date: '2026-11-09T12:38:00Z'
updated_date: '2026-11-11T16:33:00Z'
labels:
  - s
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

PK-362:W7 (2026-11-09 15:23, dima): log your notes and pause until i have more space; can't probe it, no space.
15:23 wing 2, the state to resume from:
- vm /home: 12.3 GB free of 254.4 GB (dima's read); steamos.img 299 GB apparent, 252 GB allocated; mac 184 GiB free
- the cap can't drop to 192 today: ~242 GB used; first under ~180 GB
- door 1 trim: fstrim -v /home over ssh, then du the img; gives the mac space back only if libkrun passes discard, unprobed
- door 2 shrink in place, vm off: resize2fs (ext4 inferred, lsblk unread), then the partition, then truncate the img and sgdisk -e; back up the img first
- door 3 a fresh 192 GB disk and re-downloads, sign-ins redone; the old disk's delete door in the app unknown
- upstream: no shrink issue on fxgl/steamac (v1.9.13); a feature ask drafted on his o10, posts only after his read
kept: 2026-11-09 — paused on dima's word until the mac has space

PK-362:W8 (2026-11-09 15:08, dima): steamac disk, 256 → 192 gb: reassign this topic to wing 2. your channel is busy and i have clarification questions. (moved from PK-368:W8)

15:31 wing 2: the Shrink Disk feature ask posted on dima's o11 tick: https://github.com/fxgl/steamac/issues/91

15:46 wing 2, a correction, wishkeeper siesta 3: my 15:22 «no shrink door, README only Grow Disk» came from a README read cut at line 219. steamac v1.9.13 has Settings → Advanced → Reclaim Disk Space… (SteamOS running): the guest fstraps /home, virtio-blk discard punches holes, the file shrinks on APFS only, capacity stays (README 338–343, release notes «Closes #73»). so door 1 is that button, no ssh. today it frees about 12 GB at most (dima: 12.3 GB free of 254.4). the ext4 /home is the README's word (line 332), no longer an inference. units: the image is 299 GB = 278 GiB apparent, 252 GiB on disk (du -h). #91 asks a question #73 already answered: a correcting comment goes to dima first.

typo above: «fstraps» reads «fstrims».

15:57 the correction comment on fxgl/steamac#91 posted on his o15 tick: https://github.com/fxgl/steamac/issues/91#issuecomment-6741843407

2026-11-09 23:12 wing 2 halts: handed back unlabelled; still dima's «i tell when» (20:17)

2026-11-11 wing 1 (dima o35): later, one at a time: a vm disk shrink, his word and the vm idle first
<!-- SECTION:NOTES:END -->
