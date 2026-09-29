---
name: speak-run
description: Load BEFORE you run, start, build, screenshot or click through speak, the voice admin — «run speak», «speak:admin», «open the voice admin», «preview a voice», a change under `speak/` that needs proof in the real page.
---

# speak-run

📌 hand-written from chords-run's shape (2026-09-29); regenerate with `/run-skill-generator speak` if it drifts.

speak is a vite + react page served with its api by `speak/server.ts` on **:7386**. the api reaches the x-speak
daemon (launchd, `schedule/jobs/x-speak`) over its control socket. drive the page with **`agent-browser`**, the api
with **`curl`**. commands run from the frame repo root.

## start

build, then serve — `run_in_background: true` on the serve call, keep its task id, give it a `timeout`:

```bash
pnpm speak:admin-build
timeout 3600 pnpm speak:admin
```

ready when `curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:7386/` prints 200. ui work: `pnpm speak:admin-dev`
runs vite on :7387 and proxies `/api` to :7386, so the served server must be up too.

- the daemon must run for status, preview and save: `launchctl print gui/$(id -u)/com.dima.x-speak | grep state`;
  after a daemon rebuild, `pnpm schedule:restart x-speak`
- 📌 a save writes dima's real `schedule/jobs/x-speak/config.json` — copy it aside first and put it back after,
  byte-for-byte (`cmp`)
- 📌 ▶ speaks through the mac's speakers

## drive

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix speak)"
agent-browser open http://127.0.0.1:7386/
agent-browser wait "[data-engine]"
```

- a card: `#col-<en|uk|ru> [data-engine=<engine>]`
- a chain's order: `[...document.querySelectorAll("#col-en [data-engine]")].map(e => e.dataset.engine)`
- the save line: `footer [role=status]`
- the api: `curl -s 127.0.0.1:7386/api/status`, `/api/config`, `/api/voices`

## stop

`TaskStop` the serve task by its id, then `curl` :7386 must refuse. `agent-browser close` the session. never
stop or restart the launchd daemon for page work.
