---
id: PK-437
title: 'collie + ovis: research, install, probe with dima; a mods view on ios'
status: done
assignee: []
created_date: '2026-11-16T12:09:00Z'
updated_date: '2026-11-16T14:21:00Z'
labels:
  - m
dependencies: []
priority: now
type: task
ordinal: 2100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 2026-11-16 14:05 boot prompt; W-lines land from helga's groom (grooms/2026-11-16-1405.groomed.md). urls: https://github.com/AltanS/collie https://colliepwa.dev/#demo https://github.com/devswha/ovis https://ovis.sh/#screens
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-437:W1 (2026-11-16 14:05, dima): the two tools for herdr. i found they look very good, a similarly good build as shepardr.

PK-437:W2 (2026-11-16 14:05, dima): the two tools: https://github.com/AltanS/collie and https://colliepwa.dev/#demo; https://github.com/devswha/ovis and https://ovis.sh/#screens.

PK-437:W3 (2026-11-16 14:05, dima): i want to take a closer look at them, at a good point, as one of the first steps: research about them.

PK-437:W4 (2026-11-16 14:05, dima): what do they do? ❓

PK-437:W5 (2026-11-16 14:05, dima): how useful are they? ❓

PK-437:W6 (2026-11-16 14:05, dima): are they alive? ❓

PK-437:W7 (2026-11-16 14:05, dima): how do we get the best gains out of them? ❓

PK-437:W8 (2026-11-16 14:05, dima): can we borrow from them? ❓

PK-437:W9 (2026-11-16 14:05, dima): i also want them installed and quickly probed: switch, click around, test, while you help me explore it.

PK-437:W10 (2026-11-16 14:05, dima): i saw some of them can bring mods to ios? ❓

PK-437:W11 (2026-11-16 14:05, dima): the herdr ios app is good but only shows the terminal view, and our mods are not shown there.

PK-437:W12 (2026-11-16 14:05, dima): i want a mods view in the ios app.

PK-437:W13 (2026-11-16 14:05, dima): do this at a good point.

raw drop (2026-11-16 14:05, dima): https://github.com/AltanS/collie

raw drop (2026-11-16 14:05, dima): https://colliepwa.dev/#demo

raw drop (2026-11-16 14:05, dima): https://github.com/devswha/ovis

raw drop (2026-11-16 14:05, dima): https://ovis.sh/#screens

raw drop (2026-11-16 14:05, dima): the two tools for herdr. i found they looks very good. similarly good build as shepardr. i want to take a look more closely on them. at a good point, as one of the first steps — research about them. what do they do? how useful they are? are they alive? how to get best gains out of them? can we borrow from them?

raw drop (2026-11-16 14:05, dima): i also want them installed and quickly probe - switch, click around, test. while you help me explore it.

raw drop (2026-11-16 14:05, dima): i saw some of them can bring mods to ios? herdr ios app is good but only shows terminal view - our mods are not shown there. i want mods view in ios app.

raw drop (2026-11-16 14:05, dima): do this at a good point.

PK-437:W14 (2026-11-16 14:18, dima): as researcher, compare shepardr and those two i asked for against the zoo herdr layout (the one we started with)

15:21: ovis 0.5.4 installed on his o18 tick (script read first, run from the read copy with OVIS_RUNTIME=herdr-core OVIS_NO_OPEN=1 OVIS_TELEMETRY=0): ~/.local/share/ovis, an `ovis` command in ~/.local/bin, a login service ~/Library/LaunchAgents/sh.ovis.server.plist, listening on 127.0.0.1:7317 only; tailscale not running, so nothing served outside the mac; uninstall: not read yet

PK-437:W15 (2026-11-16 15:10, dima): ovis: what is Obvious about overall, and what is the idea? I opened the web app; it looks like the UI for herdr built in the browser, and it works differently than shepherdr. So we cannot borrow from it straightforwardly, right? It is a web app that uses herdr as an engine, a frontend shown as the UI in the browser rather than as a herdr layout?

PK-437:W16 (2026-11-16 15:10, dima): ovis looks pretty good and has nice parts. It handles tool-call representation well, e.g. the history of tool calls; two calls are broken in my chatter, partly because of zoo, I suppose.

PK-437:W17 (2026-11-16 15:10, dima): the chatter in ovis is clean and looks good enough. The agents list is good: nothing special, just a fine agents list. Otherwise nothing special in ovis; it is just good UI.

PK-437:W18 (2026-11-16 15:10, dima): model selection does not work in ovis for me. It only shows the current model with no way to pick from it. What are the perks of ovis, why should we have it? Is it for easy access over a Wi-Fi network? If so, can I reach it all from my mobile device? If yes, tell why.

PK-437:W19 (2026-11-16 15:10, dima): ovis comes down to two points.

PK-437:W20 (2026-11-16 15:10, dima): 1. can it allow easy access to the fleet via mobile device? if not, it goes.

PK-437:W21 (2026-11-16 15:10, dima): 2. can we still borrow from it, given that it is web-based? point 1 wins, if it works well from a mobile device. I suppose I still will not see my mods there? e.g. orbit is not present even on desktop.

PK-437:W22 (2026-11-16 15:40, dima): i do not have tailscale and no plans for it. how to make ovis work on my mobile?

PK-437:W23 (2026-11-16 15:40, dima): let's do the ovis mobile probe right now and decide.

PK-437:W24 (2026-11-16 15:40, dima): when we test collie same as ovis?

PK-437:W25 (2026-11-16 15:55, dima): ovis: i installed on mobile. i now test drive it. initial verdict: it does not pass initial tests - it does not have orbit. the UI is nice but i have the same in the claude desktop app. most likely goes. for now - parked, until i finalize my decision.

16:05 collie installed for his look: v1.28.4 via its read install script, launchd herdr.collie, 127.0.0.1:8787 only, COLLIE_MUX=herdr-core, telemetry and the Keychain login read off, no tailscale front door. left: his collie pair, his word on collie hooks install claude (edits ~/.claude/settings.json), his verdict. uninstall: collie uninstall, collie unlink, then the three trees.

16:08 ovis: his final verdict (16:07) is no: no mods, not better than the Claude desktop app. uninstalled: ovis stop, launchctl bootout sh.ovis.server, then to the Trash: the plist, ~/.local/bin/ovis, ~/.local/share/ovis, ~/.config/ovis, ~/.local/state/ovis, ~/Library/Logs/Ovis, ~/.config/herdr-web-ui. left for his hand: his own ovis add process in a Rex tab, the iOS app.

16:19 collie: his verdict «meh», no iOS without tailscale; his tick: uninstalled whole (collie uninstall, collie unlink, trash of ~/.local/share/collie, ~/.config/collie, ~/.local/state/collie). exploration done (his 16:17); borrow ideas go to .scratch/herdr/foundation-proposal.md.

16:21 close: exploration done (dima 16:17 «exploration is done»). ovis: no, uninstalled. collie: «meh», no iOS without tailscale, uninstalled on his tick. borrow ideas → .scratch/herdr/foundation-proposal.md (PK-444); the iOS mods view want → PK-444's notes.
<!-- SECTION:NOTES:END -->
