# AGENTS.md: x-ray

raycast extension. the `x-com` surfaces reachable from the raycast bar — linear, the handoff
shelf, the schedulers, monobank rates. source lives here; the command runs out of raycast.

## the commands

- `linear-query-tickets` — full-text search over linear issues: titles, descriptions, comments
- `linear-query-projects` — every project with its progress, team, priority and lead
- `handoff` — the CST shelf: read one, paste an ingest command, open a transcript in cursor
- `schedule` — what our scheduled jobs do, when they fire next, how the last run ended
- `currency` — monobank buy/sell for the hryvnia, with an amount argument to convert
- `gmail-block-sender` — appends a sender, domain or display name to `gmail/blocklist.json` and runs
  `gmailctl apply`; the filter deletes on arrival, old mail is his one search by hand

## schedulers — the live thread

📌 **dima's position: schedulers matter, they were scattered, and they belong in ONE place.**
they now are — `schedule/` at the repo root owns them, and `schedule/README.md` is the authority.

- `schedule/jobs/<name>/` — one directory per job: plist, source, build output
- `schedule/state/` — heartbeats from jobs we cannot poll, gitignored
- `pnpm schedule:install` — links each plist into `~/Library/LaunchAgents` and bootstraps it
- logs stay at `~/.local/share/<name>/`, outside the repo: runtime output, not source

📌 **the constraint that forces an install step: launchd reads plists only from
`~/Library/LaunchAgents`.** it will not read a directory of ours. symlinks do work — launchd
resolves one at bootstrap and holds the repo path, verified with `launchctl print` — but a link
on its own loads nothing, so the installer runs `bootout` + `bootstrap` too, idempotently.

### why the heartbeat pattern exists

a cloud job runs on anthropic's machines. no pid, no plist, no `launchctl` row — nothing to
poll, ever. so it writes a json beat to disk when it runs, and `schedule` derives state from
**freshness**: fresh and ok → `waiting`, fresh and not ok → `failed`, older than 26h → `missed`,
file missing → the task is simply not set up and no row appears at all.

### the open decision

this raycast command is a first answer to «what runs, when, did it work»; a `schedule` verb in the
`x` cli is still on the table. so the state lives under `schedule/`, never inside this extension:
the reader never owns the data.

## conventions — do not break these

- **style** — arrow-function consts, 4-space, single quotes, `/* Helpers */` and `/* Types */`
  banners, named helpers over logic inlined in jsx
- **comments explain WHY** — the existing ones are the bar; a comment restating the code is noise
- **the `com.dima.` prefix filter** — `schedule` is a window onto what we run, never a launchd
  browser. everything else in `~/Library/LaunchAgents` stays filtered out
- **the two-read plist trick** — `plutil -convert json` DROPS xml comments, so the prose is read
  from the raw file and the fields from json. two reads of one file; neither is optional
- **a cloud task derives state from freshness** — never invent a poll for something with no
  process to poll
- **no new dependencies** — `@raycast/api`, `@raycast/utils`, `node-emoji`, and that is the list
- **`pnpm typecheck` before done** — `strict` plus `noUncheckedIndexedAccess`. `ray build`
  bundles with esbuild and reports success over type errors, so a green build proves nothing
