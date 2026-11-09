---
status: live
until: 2026-11-24
dies-when: the verdict line below is written
---

# agent-browser-own-chrome — `agent-browser --auto-connect` drives dima's own logged-in Chrome

Ticket: none

dima, 2026-11-10 01:20: «shape-test-drive for 2 weeks», after a probe through his Chrome worked. why now: the desktop Browser pane goes with tomorrow's herdr move, and it was the fleet's door into his logged-in sites (Gumroad, YouTube); `agent-browser` alone runs a separate, logged-out Chrome.

**test card:** we believe `agent-browser --auto-connect` replaces the Browser pane for any logged-in web task in dima's own Chrome · we test it by every real ask that needs his session (a playlist edit, a store checkout up to his click, a settings page, a dashboard read) · we measure tool calls and seconds per task, misses, and whether his own tabs stay untouched, against the Browser pane where it still exists · we're right if 80 % of logged-in asks finish with no hand-off to dima beyond a sign-in or a key, and none of his tabs is closed, moved or navigated

**kill rule:** a single closed, navigated or lost tab of dima's, or his Chrome quitting under an agent-browser command, drops it the same day

📌 the setup: dima turns on remote debugging once at `chrome://inspect/#remote-debugging` (Chrome 157 needs no restart); it opens the whole browser to any local process while on. every task works in its own `tab new` and closes only that tab; `agent-browser close` detaches and leaves Chrome running (checked 2026-11-10: 109 tabs before and after).

## stress list
- `tab new` + snapshot refs on a heavy logged-in SPA — YouTube playlist edit — calls, seconds, a miss
- a menu flow (open, pick an item, confirm) — remove, reorder, save-to-playlist — calls, a miss
- a store page up to the pay click — Gumroad `/l/<product>/<code>` — calls, and that it stops before any payment
- a settings page he asks for — any account setting — calls, and the confirm ask before the save
- read-only dashboard read — linear, vercel, github web — seconds vs the cli door
- `state save` from his Chrome into a file, reused by a headless session — a login reused without his Chrome — works yes / no
- two seats at once with `--pin-tab` — main and a wing — each keeps its tab, yes / no
- with the toggle off — the error is clear and names the fix, yes / no

## rounds
- 2026-11-10 · remove «I Let Claude Control My PC Blind» from his «..dev» playlist · attach 1 call; tab new, snapshot, action menu, «Remove from ..dev», reload read-back: 7 calls, ~1 min with a first «no default execution context» hiccup on the fresh tab; read back: the video gone, first item now «Can AI Help You Heal Your Nervous System?»; his 109 tabs intact · pass; the pane would have taken about the same calls, but this one survives the herdr move
- 2026-11-10 · the same removal through computer-use, the usual door for a native app · 1 call: `request_access` for Google Chrome refused before any click: a browser is granted read-only, «you cannot use them to interact with websites» · agent-browser wins outright on web; computer-use stays the native-app door

## verdict
