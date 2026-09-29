# schedule

every scheduled job we run, in one place. one directory per job, holding its plist, its source
and its build output together.

## the layout

- `jobs/<name>/` — one job: `com.dima.<name>.plist`, `main.swift`, `bin/` (gitignored)
- `state/` — heartbeats from jobs we cannot poll (gitignored)
- `install.ts` — `pnpm schedule:install`

logs stay outside the repo at `~/.local/share/<name>/`. they are runtime output, not source.

## installing

```bash
pnpm schedule:install
```

📌 **launchd reads plists only from `~/Library/LaunchAgents`.** it will not read this directory,
so the installer symlinks each job's plist there and then `bootout` + `bootstrap`s it. launchd
resolves the symlink and holds the repo path, so editing a plist here edits the real thing — but
the running job keeps the old copy until the installer runs again.

the installer is idempotent, and it waits for a job to actually leave the domain before
rebootstrapping it. `bootout` returns before the teardown finishes, and a bootstrap that races
it is refused.

## the five local jobs

- `x-monitor-hotkey-stats` — always on, counts chord presses, never keystrokes
- `x-monitor-hotkey-live` — always on, keeps the hotkey map's data current
- `x-autoclean-screenshots` — daily 12:00, trashes screenshots older than 30 days
- `x-atelier-live` — always on, serves atelier (bytes `apps/atelier`) at localhost:5180
- `x-speak` — always on, F5 reads the selection aloud, F5 again stops

each plist opens with a comment describing itself; the raycast `schedule` command renders it.

⚠️ **the swift binaries hold a TCC grant, and it is keyed on the codesign identifier, not the path.**
measured 2026-09-19: moving a job to a new directory and rebuilding kept both grants, because
`--identifier com.dima.<name>` stayed the same. **renaming a job breaks them**, because the
identifier is part of the name. `x-monitor-hotkey-live` is exempt: it runs node, holds no
grant, and was renamed on 2026-09-19 with nothing to re-grant.

⚠️ **changing a binary's SOURCE breaks the grant too, and the earlier test could not see it.**
that measurement rebuilt unchanged source, so the ad-hoc cdhash came out identical and there was
nothing for TCC to notice. when the hotkey daemon's swift actually changed on 2026-09-19 the
cdhash moved and Input Monitoring stopped applying — an ad-hoc signature has no team id, so the
grant is pinned to the hash of the binary itself.

📌 **a lost Input Monitoring grant is silent, which is the trap.** `CGEvent.tapCreate` with
`.listenOnly` still returns a live tap, so the daemon's own "tap refused" path never fires: it
starts, logs nothing, stays `state = running`, and receives no events at all. app-switch events
keep arriving, because those come from NSWorkspace and not the tap, so the log looks alive. the
tell is that `kind: chord` lines stop while `kind: activate` lines continue. after editing either
swift file: re-grant in System Settings → Privacy & Security → Input Monitoring, then prove it
with one real keypress before believing anything else.

🎯 **the order is the whole trick: edit → build → re-grant → RESTART.** a tap created before the
grant stays deaf for the life of that process, so restarting first and re-granting second leaves
a job that can never see its own permission — it looks identical to a job that was never granted.
measured 2026-09-19, and getting the two steps backwards is what cost the afternoon, not the
grant itself. if a plain off/on in the pane does not take, remove the row with `−` and add the
binary back with `+` from `schedule/jobs/<name>/bin/<name>`: that forces a record against the
cdhash that exists now, and a stale entry looks the same in the list either way.

after a rename, the grant has to be given again in System Settings, and then:

- 📌 **the job must be restarted** — `launchctl kickstart -k gui/$UID/com.dima.<name>`. a tap
  created before the grant stays dead; macOS does not retro-authorise a live one.
- 📌 **`state = running` does NOT prove the monitor is capturing.** it keeps logging app
  switches, which need no permission, while chord capture is silently dead. the only honest
  check is a fresh `chord` line in `~/.local/share/x-monitor-hotkey-stats/*.jsonl`.
- 🗑️ macOS never prunes the old entry, so every rename leaves a stale row in the permission
  list. delete it by hand or they pile up.

## cloud jobs and the heartbeat contract

a job that runs on anthropic's machines has no plist, no pid and no `launchctl` row — there is
nothing to poll. it reports by writing a json heartbeat into `state/`, and the reader derives
its state from **freshness**:

- fresh (< 26h) and `ok` — `waiting`
- fresh and not `ok` — `failed`
- older than 26h — `missed`
- no file — the job is simply not set up, and no row appears

**one file per job** — `state/<job>.json`. the reader scans the directory, so a second, third
or tenth cloud job needs no code change, only its own file.

the shape, written at the END of every run:

```json
{
  "label": "cowork.<job>",
  "name": "<job>",
  "schedule": "daily 09:02",
  "firedAt": "2026-09-19T09:02:14+03:00",
  "ok": true,
  "what": "<one line — the list subtitle>",
  "detail": "<markdown — the detail pane body>"
}
```

📌 nothing on this mac can write it. the cowork session does, over the device bridge, because it
is the only thing that knows the run happened.

📌 **the cloud job must be told all of this in its prompt, in writing.** it will not infer a file
contract. the part it gets wrong unprompted is the failure case: an agent that hits an error
reports the error and stops, skipping the beat — so the row stays `waiting` on a run that
actually broke, and only turns `missed` a day later. the prompt has to say: **write the beat on
every run, including a failed one, with `ok: false` and the reason in `what`.**

## the emoji

a job's description may open with an emoji, and the list shows it instead of the generic clock.
one rule, both sources: the first line of a plist's `<!-- -->` comment, or the heartbeat's
`what`. the reader strips it before rendering the text, so it never shows up twice.

- `⌨️ x-monitor-hotkey-stats — counts keyboard shortcuts, never keystrokes.`
- `📡 x-monitor-hotkey-live — keeps the hotkey map's data current, with no terminal open.`
- `📷 x-autoclean-screenshots — trashes screenshots older than 30 days, recoverably.`

## telling the two kinds apart

every row carries a `source`, shown as a badge in the list and a line in the detail pane:

- `🖥️ launchd` — runs on this mac, state polled live from `launchctl` on every open
- `☁️ cowork` — runs in the cloud, state only as true as the last heartbeat it left

the distinction is not cosmetic: a launchd row is measured, a cowork row is inferred.

📌 no cloud job is set up today (the gazette sync was ejected 2026-09-20). the reader stays: a
new cloud job appears the moment its beat file lands, and disappears with it.
