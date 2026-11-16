---
id: PK-445
title: >-
  agent-browser on dima's Chrome: no approval popups, no focus switch
  (macroscope billing read)
status: done
assignee: []
created_date: '2026-11-16T12:59:00Z'
updated_date: '2026-11-16T22:32:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 4100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 2026-11-16 14:46 + 14:58: popups x5 per attach; is it possible to remove them and not switch his focus. attach failed 3 times with the toggle on
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-445:W1 (2026-11-16 14:46, dima): can you use the cli to read the macroscope billing page?

PK-445:W2 (2026-11-16 14:46, dima): chrome://inspect/#remote-debugging is enabled, I never turn it off. Why can't you access it?

PK-445:W3 (2026-11-16 14:46, dima): agents browser: I saw the request and approved it. It pops up 5 times each time and spams me. How do I remove the approve requests?

PK-445:W4 (2026-11-16 14:46, dima): can it be smoothened?

PK-445:W5 (2026-11-16 14:58, dima): try now.

PK-445:W6 (2026-11-16 14:58, dima): is it possible to remove "permission requests", so you can use the agents browser without approval?

PK-445:W7 (2026-11-16 14:58, dima): is it possible to do that so my focus is not switched to Chrome, so you do your stuff in my browser while I type in herdr?

15:08: built on his «do now»: a second Chrome, `open -g -na 'Google Chrome' --args --remote-debugging-port=9333 --user-data-dir=~/.local/state/fleet-chrome`; `agent-browser --cdp 9333` attaches with no approval dialog (verified: url and title read back). macroscope redirected to GitHub sign-in: his hand once (orbit). still open: does it survive a reboot (a launchd job or a line in the boot), and a line in x:browser-headless

PK-445:W8 (2026-11-16 15:07, dima): where to see macroscope billing? Did you measure?

PK-445:W9 (2026-11-16 15:07, dima): do it now. Mods codie blocked?

PK-445:W10 (2026-11-16 15:10, dima): do I need to sign in to all stuff each time from scratch in this Chrome profile? It would be good to have authenticated state preserved there.

PK-445:W11 (2026-11-16 15:10, dima): i signed in to macro in your chrome profile. proceed.

PK-445:W12 (2026-11-16 15:10, dima): macroscope: proceed with more measures. More review rounds show the real picture. I think during today we see the picture.

PK-445:W13 (2026-11-16 15:10, dima): chrome profile: ok, keep it and use as a habit.

00:32 close: PK-445:W1, W8, W9, W11, W12 done — macroscope billing read in the fleet Chrome (agent-browser --cdp 9333 reads app.macroscope.com/…/settings/billing, verified 00:3x), rounds and the mid-drive read logged in docs/test-drive/macroscope.md (his o140 keep), the verdict waits for the trial's end there; W2–W7 done — the fleet Chrome replaced --auto-connect: no approval popup, focus stays with dima (browser-headless SKILL.md § the fleet Chrome); W10, W13 done — the profile keeps sign-ins and is the habit door (same section, pnpm fleet-chrome:start, port 9333 listening)
<!-- SECTION:NOTES:END -->
