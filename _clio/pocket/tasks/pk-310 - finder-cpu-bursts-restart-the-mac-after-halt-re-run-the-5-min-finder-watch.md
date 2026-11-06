---
id: PK-310
title: 'finder cpu bursts: restart the mac after halt, re-run the 5-min finder watch'
status: open
assignee: []
created_date: '2026-11-03T14:11:00Z'
updated_date: '2026-11-06T16:13:00Z'
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

2026-11-05 17:59 side channel, W1 W2 answer. controlled runs, 5 min, same churn (50 files every 5 s under ~/frame): A window on ~/frame open, sizes on: 4/75, max 160 %, mean 4.4; B closed, sizes on: 1/75, max 19 %, mean 0.5; C open, sizes on (my off failed, read back true, under lane tests): 11/75, max 99 %, mean 8.9; D open, that window off, global on: 6/75, max 45 %, mean 3.7, sizing in 4 of 5 samples; E open, global off: 0/75, max 9.2 %, mean 1.3, busiest disk, 19.8 MB/s. also 17:27 closed under the lane: 0/75. reason: Finder's list-view Calculate all sizes re-walking the 8.3 GB, 252k-file repo while a window sits on it. applied on his tick: StandardViewSettings ListViewSettings and ExtendedListViewSettingsV2 calculateAllSizes false (read back 0; 0), Finder relaunched 17:54. confound: E is one run on a freshly relaunched Finder; the 11-03 relaunch still burst 8/75 in its first 5 min, so a relaunch alone does not explain it. not solved: the 11-04 burst, all node sync after a volume went away, no sizing; the 2.4-3 GB growth; brand and hotkeys keep per-folder overrides on (source lane read, opening them may still size). research: no 27.x report matching, no Apple fix; dev forum 705896 (2022, user report, no Apple reply) says Finder caches sizes in .DS_Store and updates on FSEvents. undo: Finder View Options, tick Calculate all sizes, Use as Defaults.

2026-11-05 18:04 side channel: dima ticked a re-check tomorrow: 5-min watch with a day of uptime, footprint read, under a lane; main's next boot runs it, then closes or reopens this item.

19:05, uptime 5 h 12: Finder 1.4 % cpu, 169 MB rss, etime 1 h 03, so it restarted about 18:00. the re-check past a day of uptime stays owed; next boot.

W (2026-11-06 03:14, dima): once we have two side lanes at once, the side channel should start finder measures at once, at any point where we will be with the side channel. i want it to be solved.

W1 (2026-11-06 03:14, dima): once we have two side lanes at once, the side channel should start finder measures at once, at any point where we will be with the side channel. i want it to be solved.

2026-11-06 14:34 side channel, two side lanes running, no restart: Finder up 20.6 h, one window on ~/Downloads, load 16-19: 8 of 75 polls at or over 15 %, max 51.5 %, footprint 172 MB. baselines: 11-05 sizes off 0/75 max 9.2 % on one fresh run; 11-03 8/75 max 98 %. 3 samples read. the past-24 h watch runs after 17:54.

2026-11-06 14:41 side channel, same lanes, no Finder window (closed on dima's tick, read back empty): 5 of 75 polls at or over 15 %, max 38.4 %, footprint 168 MB, load 22-37. all 5 fell in the first 96 s, none in the last 3.5 min, while load rose. 3 samples: TFSInfo property sync (FetchProperties, SynchronizeCatalog, CopyPropertyValues), TNode::HandleSync, 0 sizing frames read in the 14:29 run. against the open window 14:29: 8/75, max 51.5 %. one pair, no controlled churn, a window reopened 14:35-14:36 just before: the early cluster may be its aftermath (inference). so a window helps at most; bursts run without one.

2026-11-06 14:50 side channel via helga: the 17:54 watch is the next read; the closed-window run stands as one pair, no controlled churn.

2026-11-06 15:05 settle test, his tick: 0 windows, settled 2 min, then 5 min under the lanes (load 30.7): 0 of 75 polls at or over 15 %, max 10.8 %, rss 82 MB, no samples. against 14:29 window open on ~/Downloads 8/75 max 51.5 %, and 14:36 closed 5/75 max 38.4 %, all within 96 s of his reopen. inference from one run each: bursts follow an open window or a recent touch, a settled closed Finder is quiet. past-24 h watch after 17:54 still due.

2026-11-06 15:36 side channel: the mac was force reset at 15:29 (panic btn_rst, the power button; cause unknown), so Finder and uptime restarted: the past-24 h watch due 17:54 can't run. a day of uptime is now 15:29 tomorrow, moved. the 15:05 settle test stands. the day plan's line 19 was ticked wrong at 14:39: no 17:54 watch ever ran; unticked 15:21.

⏰ PK-338 (full wish ids), dima's o69: this item stays bare until worked; the next touch sorts it first: W1 is numbered twice, then its lines get full ids.
<!-- SECTION:NOTES:END -->
