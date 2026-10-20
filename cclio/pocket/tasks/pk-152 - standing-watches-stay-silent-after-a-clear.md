---
id: PK-152
title: standing watches stay silent after a /clear
status: done
assignee: []
created_date: '2026-10-15 23:08'
updated_date: '2026-10-20 12:30'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the first real /clear of cclio — the done test (a /clear, then no wake) runs then; fixture-proven 10-16, the live registry rewrite is an inference.
dima, 2026-10-16: «why are they firing? make them not fire after i clear you.» the boot arms pr-watch and ci-watch as one-shot background Bash tasks (watch-once.sh, 6 h deadline, cclio:boot step 📡). a /clear resets the conversation but not the session's background tasks, so their end notice lands in a fresh context that never armed them, and a no-event deadline end reads as news (2026-10-16 01:58: both ended «watch: 6 h, no event», cclio reported it). the fix: a no-event end must never wake or reach a cleared context — e.g. arm the watches outside the harness (launchd or a detached process that pings only on an event), or a re-arm that checks the arming conversation. done: a /clear, then a 6 h no-event end, prints nothing.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
inbox 10-16, wisp in his words: cleared cclio ~20:00, chatted with cw ~02:00, then her thread suddenly woke about monitors — fix it so a cleared cclio never wakes suddenly. relates the fork question (inbox Q6).

fixed 10-16: watch-once.sh records the arming session id; a /clear mints a new id (proven: the 10-15 transcripts split at the clear), so the wrapper then ends silently with its session. fixture-proven: same session prints, cleared session silent, an event prints. inference: the ~/.claude/sessions registry file updates its sessionId on a live /clear — first real clear confirms. also fixed: the «6 h, no event» branch never fired (the pid was killed before the check).

10-19 17:27: re-dated — no real /clear of cclio yet; today's compact ran the second-wind path, not a /clear.

19:10 dima (o80 steer «ccrow before halt?»): the proof runs on ccrow at the halt, right before she stops — read her registry sessionId, clear her, read it again; a cleared ccrow costs nothing then. open: the door that clears a --bg session (a SendMessage is literal text, never a slash command); none found → his next real /clear of cclio.

2026-10-19 20:08 plan (dima: «ccrow /clear probe if still needed»): ccrow is a cli --bg session, no door sends it a /clear, so the probe runs on cclio itself: at the halt cclio re-arms one watch, then dima types /clear here after the CST; session-probe.log shows the clear's SessionStart (source, new id, same pid) and the next boot reads the cleared session's transcript for any watch notice. dima's only action: the /clear.

2026-10-20 14:22 dima's steer: invent a proper test. method: expect drives a real interactive cc (haiku), a fake watch fires 60 s after arming, /clear at ~45 s, a control run without the clear (script: session scratchpad clear-probe/run.exp). harness runs (cc boots, arms the watch) but 3 runs gave no verdict: sessions under /private/tmp saved no transcript, and the control showed no notice in the TUI text — no positive control. next: run from a ~/.claude/jobs/<id>/tmp dir (earlier probes saved transcripts there), wait 180 s. evidence so far (10-19 20:18): at the clear cc itself killed both watches. if the probe confirms, watch-once's session-id branch is dead weight and goes.

2026-10-20 15:30 PROVEN, three runs of a real interactive cc (haiku) driven by expect, a fake watch that fires 60 s after arming, /clear at ~45 s (scratch clear-probe/run.exp): (1) control, no clear, watch-once → the notice woke the session (positive control); (2) /clear, watch-once → silent to the end; (3) /clear, the same fake as a plain background command → the notice landed in the cleared session and woke a turn. so cc does not kill a background task on /clear, and watch-once's session-id check is what keeps a cleared cclio quiet — it stays. the 10-19 «killed» notices came from the session ending, not the clear. my 14:22 read («cc kills on clear, the branch is dead weight») was wrong. o1's condition failed, so nothing is deleted.
<!-- SECTION:NOTES:END -->
