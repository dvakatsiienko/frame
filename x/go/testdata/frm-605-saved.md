lane: quick

## wish

* FRM-605:W1 (2026-11-13 17:51, dima): what's wrong, few words? ❓
* FRM-605:W2 (2026-11-13 17:51, dima): after what time guard fires? ❓

## ⚖️ worth it

none — fix

## why

* the stash's park alarm fired on herdr lane 2 at 14:55 while its codie worked: it counted the idle sixth sense as the whole lane (main clio, 2026-11-13)

## proposed

* the alarm reads every member of a lane and fires only when all are idle past its line

## open

* ? the cause: which members the herdr lane 2 card held at 14:55, and why the working codie went unread — the stash already says «a member still working wakes nobody» ([FTR.md:985](<http://FTR.md:985>)), so the bug is in the member read, not a missing rule; the build replays 14:55 first

## 🎯 done test

* given a lane whose codie is working and whose sixth sense is idle, then no park alarm fires; given both idle past the line, it fires once

size: XS, like FRM-598

⸻ 🪪 cc·20261113·wing-1 · Opus 5.5 · agent run stamp — please keep 🙏

## signed

✍️ signed 2026-11-13 · body 29e248b9
✏️ changed 2026-11-13 — his 17:51 questions as W-lines; the open cause line, no re-sign: tiny · body dd2a1f86