---
name: chords-run
description: Load BEFORE you run, start, build, screenshot or click through chords, the hotkey map — «run chords», «chords:dev», «check the board», «screenshot the map», «does the stats page render», a change under `hotkeys/chords/` or `hotkeys/serve.ts` that needs proof in the real page.
---

# chords-run

chords is a vite + react page served by the always-on launchd daemon `x-monitor-hotkey-live`
(`hotkeys/live.ts --watch`) on **:7373**; the same daemon owns the api and the sse stream
(`hotkeys/serve.ts`). you drive the page with **`agent-browser`** and the api with **`curl`**.
commands run from the frame repo root (or a worktree root) unless a line `cd`s.

## pick the lane

- **main checkout, ui change** — run vite dev on :7374. it proxies `/api` to the live daemon, so
  the page shows real bindings and presses. reads are safe; a save writes dima's real
  `hotkeys/notes.json` / `hotkeys/manual.ts`.
- **a worktree** (`~/frame/.claude/worktrees/<slug>`), or any write flow — stand up a second
  daemon on **:7383** from the worktree. `hotkeys.json`, `notes.json`, `manual.ts` and
  `chords/dist` all resolve from the file's own dir, so the worktree daemon reads and writes only
  its own tree. the press log is shared and read-only.
- **the served build on :7373** — dima's page. `pnpm chords:build` in the main checkout
  refreshes it with no restart; never stop or restart the launchd daemon.

## lane: main checkout, dev

start with `run_in_background: true` on the Bash call, and keep its task id:

```bash
pnpm chords:dev
```

ready when the log prints `Local: http://localhost:7374/`. the tab title reads `chords: dev`.

## lane: worktree, second daemon

a fresh tree has no `hotkeys.json` and no `dist/` — the daemon does not scan at boot, so
`/api/hotkeys` answers 503 until the scan runs:

```bash
cd ~/frame/.claude/worktrees/<slug>
CI=1 pnpm install
pnpm hotkeys:scan
pnpm chords:build
```

then two background Bash calls (`run_in_background: true`), keep both task ids:

```bash
CHORDS_PORT=7383 CHORDS_DEV_PORT=7384 node hotkeys/live.ts --watch
```

```bash
CHORDS_PORT=7383 CHORDS_DEV_PORT=7384 pnpm chords:dev
```

- :7383 serves the worktree's built `dist`; :7384 is its vite dev, proxying to :7383
- both env vars go on both processes: the daemon's origin allowlist is built from the pair
- ready check:

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:7383/api/hotkeys
```

## drive it — agent-browser

own session, absolute screenshot paths (see gotchas). `$CLAUDE_JOB_DIR` is set only in a
background job; elsewhere use any absolute scratch dir outside the repo:

```bash
export AGENT_BROWSER_SESSION=chords-run
agent-browser set viewport 1280 900
agent-browser open http://localhost:7374/
agent-browser wait 1500
agent-browser get title
agent-browser snapshot -i -c | head -40
agent-browser screenshot "$CLAUDE_JOB_DIR/tmp/board.png"
```

the page's accessible names are the handle — every key is a button named
`<key> <presses> <action>`, every layer a tab named `<layer> <bindings>`:

```bash
agent-browser find role tab click --name "cmd 22"
agent-browser find role button click --name "Search Emoji"
agent-browser find role textbox fill "a note" --name "note for this chord"
agent-browser find role button click --name "save note" --exact
agent-browser find role button click --name stats --exact
agent-browser get url
agent-browser errors --json | jq -r '.data.errors[] | .text | split("\n")[0]' | sort | uniq -c
```

- the board opens on the `hyper` layer; a key named on another layer is not found until its tab
  is clicked
- a save is proven in the tree, never in the page:

```bash
git diff hotkeys/notes.json
```

- the sse stream, straight from the api:

```bash
curl -sN -m 4 -H 'Accept: text/event-stream' localhost:7374/api/presses | head -c 300
```

- the origin guard (a write from a foreign page must answer 403):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H 'Content-Type: application/json' -H 'Origin: http://evil.test' -d '{}' localhost:7383/api/notes
```

## tests

```bash
pnpm exec vitest run hotkeys
pnpm --filter chords typecheck
```

the vitest files cover the node side (`chord`, `keycodes`, `manual-edit`, `stats`); the page has
no tests, so a ui change is proven in agent-browser.

## stop

stop only what you started:

- a `run` pass stops what it started; a coder serving its tree for dima keeps it up until the worktree goes — the coder's contract (`x:crew-coder`), not this skill's
- everything else: TaskStop each background task id, then close the browser session and prove
  the ports are free

```bash
agent-browser close
for p in 7374 7383 7384; do lsof -nP -iTCP:$p -sTCP:LISTEN -t >/dev/null && echo "$p STILL BUSY" || echo "$p free"; done
```

:7373 stays busy — that is the launchd daemon, and it is supposed to.

## gotchas

- **a relative screenshot path lands in the agent-browser daemon's cwd**, the dir of the shell
  that first launched it — not the current shell's cwd. a `board.png` appeared in `~/frame`'s
  root. always pass an absolute path.
- **`agent-browser errors` prints bare `✗` lines** with no text. `--json` shows the message.
- **`agent-browser errors --clear` clears nothing** — it prints the buffer, which keeps every
  error since the session began, stale code included. an error count per load comes from a fresh
  `AGENT_BROWSER_SESSION` name, closed after.
- **the page loads with zero console errors.** any `VGPUError` is new: vgpu fires `onResize`
  callbacks from inside its own frame, so a draw there must wait for the next animation frame.
- **vite binds `[::1]` only** — `localhost:7374` answers, `127.0.0.1:7374` does not.
- **the daemon binds `0.0.0.0`**, ipv4 only, on purpose since `daecf880` (a phone on the wi-fi
  opens it) — `[::1]:7383` does not connect. writes answer 403 unless they come from loopback, so
  a write probe goes to `127.0.0.1` or `localhost`, never the mac's wi-fi address.
- **`pnpm hotkeys:scan` prints nothing on stderr when every source reads.** a `skipped <source>`
  line is a real change on this mac — an app gone or its config moved — never noise.
- **a hand-made worktree cannot `git-crypt unlock`** with the recipe in frame's `AGENTS.md`: the
  unlock runs `git status`, which dies on the clean filter. the unlock that worked:

```bash
git -c filter.git-crypt.smudge=cat -c filter.git-crypt.required=false worktree add -b <slug> .claude/worktrees/<slug> HEAD
cd .claude/worktrees/<slug>
GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=filter.git-crypt.clean GIT_CONFIG_VALUE_0=cat GIT_CONFIG_KEY_1=filter.git-crypt.required GIT_CONFIG_VALUE_1=false git-crypt unlock "$(git rev-parse --git-common-dir)/git-crypt/keys/default"
```

  the `worktree add` still prints `clean filter 'git-crypt' failed` and exits non-zero, but the
  tree and branch exist; after the unlock `git status --short` is empty.

## troubleshooting

- `✗ 89 elements have role "button", but none match name …` — the key lives on another layer, or
  its press count moved. `snapshot -i -c | grep` for the current name.
- `/api/hotkeys` → 503 on a worktree daemon — the scan never ran in that tree: `pnpm hotkeys:scan`.
- a saved note does not show in `git diff` — nothing was selected when you saved; select a key
  first, the SELECTED KEY panel names it.
