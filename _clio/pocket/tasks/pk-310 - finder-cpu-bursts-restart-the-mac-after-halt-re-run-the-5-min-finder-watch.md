---
id: PK-310
title: 'finder cpu bursts: restart the mac after halt, re-run the 5-min finder watch'
status: done
assignee: []
created_date: '2026-11-03T14:11:00Z'
updated_date: '2026-11-05T14:57:00Z'
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
<!-- SECTION:NOTES:END -->
