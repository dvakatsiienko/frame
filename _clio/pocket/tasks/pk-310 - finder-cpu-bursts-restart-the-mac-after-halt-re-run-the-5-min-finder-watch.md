---
id: PK-310
title: 'finder cpu bursts: restart the mac after halt, re-run the 5-min finder watch'
status: open
assignee: []
created_date: '2026-11-03T14:11:00Z'
updated_date: '2026-11-05T15:27:00Z'
labels:
  - xs
  - side-channel-owned
dependencies: []
priority: next
type: task
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-11-03 side channel: Finder bursts to 98-99 % (stack: TFSInfo icon/tag fetch, TNode sync, FileProvider, iCloud), 907 MB after 6 days up; a relaunch did not stop it (16:00-16:05: max 98 %, 8/75 polls >=15 %). dima, o17: «ill try later after halt». after the restart: watch 5 min (script: poll ps every 4 s, sample on >=15 %); bursts survive → iCloud Desktop & Documents sync is the next suspect, his call
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-04 16:45 side channel, a 5-min watch with no restart: 7 of 75 polls at or over 15 %, max 99 %, 450 MB, Finder up 1 day, mac up 7 days: unchanged. stays a wait on his restart; a halt is his word, W197.

2026-11-05 16:57 side channel, after the restart (mac up 3 h, Finder pid 720 up 3 h, read off uptime and ps): 5-min watch, 0 of 75 polls at or over 15 %, max 4.4 %, 125 MB, 0 samples; baselines 11-03 8/75 max 98 % 907 MB, 11-04 7/75 max 99 % 450 MB. iCloud Desktop & Documents sync is on (com.apple.finder FXICloudDriveDesktop and FXICloudDriveDocuments both 1), so sync was not the trigger on its own in this window. the gta4 handoff (cc--research--steamac-gta4-perf, line 43) saw Finder at 100 %, 3 GB, 35 h up on 11-05 night. not checked: a Finder past a day of uptime, where the 3 GB sat. if bursts return: the 3 GB read and iCloud Desktop & Documents sync are the next look, his call.
close: done, bursts gone after the restart (0/75, max 4.4 %, 125 MB); one fresh-boot watch, no long-uptime read

2026-11-05 17:07 side channel, reopened on dima's tick: the 16:57 close covered only a fresh idle Finder; a re-probe under the mods side lane runs now, with footprint, daemons and disk rate. pre-reboot evidence: macOS report 11-04 15:39, 97 % for 93 s, 2,376 MB footprint, stack HandleVolumeDeleted → SynchronizeChildren → FindRenamedChild, a disk mount and eject at 15:36; mounts too rare to explain every burst (inference).

2026-11-05 17:13 side channel, re-probe during the mods side lane, same boot (Finder up 3.3 h): 5 of 75 polls at or over 15 %, max 115 %, footprint 138 MB (94 MB at 17:00), disk p50 0.66 MB/s, max 183, 0 disk mounts in the window: bursts NOT gone, the 16:57 close was an idle window. 3 samples: TFSInfoSizer::SizeFolder, TOperationSizer, TDeepCFURLIterator, getattrlistbulk: Finder walks folder trees to add up sizes; a new lead beside TNode::SynchronizeChildren. com.apple.finder StandardViewSettings calculateAllSizes = 1 in list settings. Finder reports 0 windows, so who asks for the sizing is unproven; the setting as a cause is an inference. no burst lines up with disk rate at 17:08 (0.82 MB/s). daemon column read 0.0 throughout, not proven working. next: dima's call on turning calculate-all-sizes off, then one more watch under a lane.

2026-11-05 17:14 side channel, correction: «Finder reports 0 windows» was a bad instrument (Finder's own AppleScript count). System Events names one open window: /Users/dima/frame, the repo the lane edits. strongest lead (inference, not tested): that window plus calculateAllSizes = 1 makes every repo change re-size the tree. not known: whether it was open during the idle 16:52 watch, and that window's view mode. cheapest test: close it, one watch under the lane.

W1 do everything and measure, hunt a reason.
W2 spawn a research: maybe it is a well known issue, or someone else had something similar? maybe there is a known workaround or a fix?
<!-- SECTION:NOTES:END -->
