---
id: PK-39
title: ccrow keeps its pin without dima's hand
status: done
assignee: []
created_date: '2026-10-09 12:16'
updated_date: '2026-10-09 13:05'
due_date: '2026-10-09'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
check: none — dima named it 10-09 15:54
dima, 2026-10-09: ccrow lives in a desktop tab he spawns (mods work there, --bg cannot run them); cclio never stops it; the halt clears it, the boot picks it up and activates it. replaces the 10-06 «pin each time» ask
- probe: a bypass-mode desktop ccrow receives a ccrow:wake SendMessage, clear_session from cclio empties it, set_session_model switches its arm, the stash keep-hot ping reaches it
- then: ccrow start/ensure/wake address the desktop session by name; the boot loads x:crew-adviser into it; the halt clears it
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
probe 10-09 15:49: ccrow is a cli --bg job, absent from the desktop's list_sessions, so mcp__ccd_sidebar__set_pinned cannot reach it; claude agents --json carries no pin field (keys: cwd id kind name sessionId startedAt state). two ccrow rows: 9c8d2cd8 (yesterday's arm, state blocked, no pid) and 92a05cbe (today's fable arm, working).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ccrow moved into dima's desktop tab 10-09 16:00: pinned by cclio (set_pinned), wakes reach it in bypass mode, set_session_model switches the arm; clear_session refuses (pinned, RC, not cclio-started) → dima /clears at the halt; keep-hot untested. the script rework is pk-41
<!-- SECTION:FINAL_SUMMARY:END -->
