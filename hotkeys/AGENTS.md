# AGENTS.md: hotkeys

what is bound, what gets pressed, and the page that shows both (`chords/`). the recording daemon lives in `schedule/jobs/x-monitor-hotkey-stats/`, because a plist belongs under `schedule/`; every reader and tool stays here.

📌 launchd + tcc hazards (signing, Input Monitoring grants, plist edits): `schedule/AGENTS.md`.

## the contract

📌 **`manual.ts` is the single source for the hand-kept apps** — raycast, cleanshot and 1password seal their shortcuts, so their rows are typed there. edit a binding there and nothing else: the live job sees the mtime move, reruns the scan, and the map and `hotkeys:top` follow. no second list, no cache.

📌 **a press line carries its `feature`**, stamped by the recorder from `hotkeys.json`'s live rows, so `manual.ts` holds only what is on the keyboard: a rebind edits its row in place, and removing a binding then `pnpm hotkeys:stamp --prune` removes its history too. stop the recorder first (it refuses otherwise); the backup is automatic.

## what the filenames don't say

- `live.ts` is the always-on watcher and the app's server both, installed as `x-monitor-hotkey-live`
- `notes.json` holds what dima wants on a chord, committed, written only through `/api/notes`
- `macos-audit.ts` diffs the three system domains against `macos/`, exit 1 on drift

## the server

- 📌 **port 7373, bound to every interface** — a phone on the wi-fi opens it; a writing route takes a write from loopback only. the daemon holds it because it already watches the press log and the sources.
- `pnpm chords:dev` runs vite on 7374 and proxies `/api` back to 7373: one api in dev and in the build.
- 📌 **`/api/manual` edits `manual.ts` surgically, never by reprinting it** — its group comments carry where each binding came from; an ambiguous edit is refused with a 409.
