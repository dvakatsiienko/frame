---
id: PK-77
title: >-
  ✨ sessions mod wisp: the idle time is off — 55m shown, the last reply was 9h
  ago
status: done
assignee: []
created_date: '2026-10-12 11:08'
updated_date: '2026-10-12 12:50'
due_date: '2026-10-13'
labels:
  - s
dependencies: []
priority: now
type: wish
ordinal: 1300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, boot 2026-10-12: «plus, possibly a sessions (mod) wisp». his screenshot note: i talked to the threads last night; this morning i opened them here; the idle number seems off — the last reply was 9 h ago, not 1 h (the card showed «idle 55m» / «idle 59m»).
🦉 cclio's inference, unchecked: the idle clock resets on a thread being opened or focused, not on its last turn. list_sessions at 14:11 gave lastActivityAt 01:52Z for the verifier thread, 09:52Z for the cli one — so the app's own activity stamp moves too.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
🦉 diagnosed 14:35, proven: the sessions card's idle span reads statusSince = the registry's statusUpdatedAt (x-mod-stash/hooks/register.tsx:1684). cc writes that stamp when a process (re)starts: both threads read 12:47:53 / 12:52:14 (dima opened them), their last assistant entries are 01:52:46Z and 01:37:40Z (04:52 / 04:37 local). the transcript mtime lies too — opening writes custom-title + file-history-snapshot entries (mtime 13:02 / 12:54).
fix (S): for an idle row, statusSince = the newest assistant entry's timestamp in the transcript tail (~/.claude/projects/<cwd-slug>/<sessionId>.jsonl), registry stamp as the fallback; one FTR line under the state column (FTR.md:233–242); a test with a fixture transcript whose tail holds a custom-title after the last assistant line. 📌 the same stamp likely feeds 🔥 keep-hot's «idle since» (register.tsx:188) — check it in the same lane.

dima o6 2026-10-12: rides the FRM-386 mods coder with PK-73 — one mods coder, three fixes

done: shipped by the mods coder, lane l8 (PK-73 a7844123, PK-77 bb26ee18); mods:test exit 0 on cclio's run 15:45
<!-- SECTION:NOTES:END -->
