# AGENTS.md: hotkeys

what is bound, what actually gets pressed, and the page that shows both. the recording daemon is
the one thing living elsewhere — `schedule/jobs/x-monitor-hotkey-stats/` — because a plist belongs
under `schedule/`; every reader and tool stays here.

## the contract

📌 **`manual.ts` is the single source for the hand-kept apps.** raycast, cleanshot and 1password
seal their shortcuts, so those rows are typed there by hand. change a binding in that file and
nothing else needs touching: the live job sees its mtime move, reruns the scan, and the map and
`hotkeys:top` follow. **nothing is remembered anywhere else** — no second list, no cache.

## the pieces

- `scan.ts` — reads the four sources named in `sources.ts`; stdout is json, and `top.ts` parses it,
  and the same payload lands beside it as `hotkeys.json` for the app
- `live.ts` — the always-on watcher and the app's server: counts presses, reruns the scan on a
  config change, pushes both to the page. installed as `x-monitor-hotkey-live`
- `serve.ts` · `notes.ts` · `manual-edit.ts` — the http side: static `chords/dist`, `/api/hotkeys`,
  `/api/notes`, `/api/manual`, and `/api/presses` as server-sent events
- `chords/` — the app itself, vite + react + tailwind. `pnpm chords:build`, `pnpm hotkeys:map`
- `notes.json` — what dima wants on a chord, committed, written only through `/api/notes`
- `macos-audit.ts` — diffs the three system domains against `macos/`, exit 1 on drift

## the server

📌 **port 7373, bound to every interface** (`daecf880`: a phone on the wi-fi opens it; the writing routes take a write from loopback only). the daemon holds it because the daemon is already watching
the press log and the config sources; a second process would duplicate both watchers to answer
the same questions. `pnpm chords:dev` runs vite on 7374 and proxies `/api` straight back to it,
so there is one api in dev and in the build.

📌 **`/api/manual` edits `manual.ts` surgically, never by reprinting it.** that file is as much
prose as data — the group comments carry where each binding came from — so the writer finds the
row's own literal and moves only its fields. anything ambiguous is refused with a 409 rather
than guessed. a rebind lands as an mtime change, which is the same road a hand edit takes.
