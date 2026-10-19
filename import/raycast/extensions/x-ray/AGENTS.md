# AGENTS.md: x-ray

raycast extension. the `x-com` surfaces reachable from the raycast bar — linear, the handoff
shelf, the schedulers, monobank rates, the gmail block list. source lives here; the command runs out of raycast.

## the commands

- `linear-query-tickets` — full-text search over linear issues: titles, descriptions, comments
- `linear-query-projects` — every project with its progress, team, priority and lead
- `handoff` — the CST shelf: read one, paste an ingest command, open a transcript in cursor
- `schedule` — what our scheduled jobs do, when they fire next, how the last run ended
- `currency` — monobank buy/sell for the hryvnia, with an amount argument to convert
- `nms-wiki` — the no man's sky wiki: a hotkey over selected text opens the page at once, else a
  typed name; the wiki's search-go door jumps to an exact page or lists results
- `gmail-block-sender` — appends a sender, domain or display name to `gmail/blocklist.json` and runs
  `gmailctl apply`; the filter deletes on arrival, old mail is his one search by hand
## schedulers

`schedule/` at the repo root owns every scheduled job; `schedule/README.md` is the authority on the
job layout, the launchd install step and the heartbeat a cloud job reports through. the `schedule`
command answers «what runs, when, did it work» and only reads it: the state lives under `schedule/`, never in this extension, so a later
`schedule` verb in `x` (none yet) reads the same data.

<!-- failure: schedulers were scattered across repos and tools. outcome: dima's call, one home — `schedule/` (frame AGENTS «one home per feature»). -->

## conventions — do not break these

- **style** — arrow-function consts, 4-space, single quotes, `/* Helpers */` and `/* Types */`
  banners, named helpers over logic inlined in jsx
- **the `com.dima.` prefix filter** — `schedule` is a window onto what we run, never a launchd
  browser. everything else in `~/Library/LaunchAgents` stays filtered out
- **the two-read plist trick** — `plutil -convert json` DROPS xml comments, so the prose is read
  from the raw file and the fields from json. two reads of one file; neither is optional
- **a cloud task derives state from freshness** (`schedule/README.md` § the heartbeat contract) —
  never invent a poll for something with no process to poll
- **no new dependencies** — `@raycast/api`, `@raycast/utils`, `node-emoji`, and that is the list
