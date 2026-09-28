---
name: chords-verify
description: Load AFTER any change under `hotkeys/chords/` or `hotkeys/serve.ts`, before its report or commit — «verify chords», «/verify», «prove the board», «check the cap renders», a verifier round on a chords pr.
---

# chords-verify

prove a chords change in the real page and the real api. start and stop through `chords-run` —
this skill never re-describes launching.

## the handle

- **:7373 is dima's page**, served by the launchd daemon `x-monitor-hotkey-live`. read it, never
  stop, restart or kickstart it.
- **a worktree** runs its own pair from `chords-run` → «lane: worktree, second daemon»: the daemon
  on `http://localhost:7383` (api + built `dist`), vite on `http://localhost:7384` (the page under
  test). every write in this skill goes to `:7383` — its `notes.json` and `manual.ts` are the
  tree's own.
- **the main checkout** uses vite on `:7374` over the live daemon: reads only. a save there writes
  dima's real files.

## drive

- `agent-browser`, a fresh named session per pass: `export AGENT_BROWSER_SESSION=verify-chords-<topic>`;
  `close` it at the end. `errors --clear` clears nothing, so a new session is the only clean
  error count.
- `set viewport 1280 800`, then `390 844`. absolute screenshot paths only.
- the handles are accessible names: a key is a button `<key> <presses> <action>`, a layer a tab
  `<layer> <bindings>`. the board opens on `hyper`.

## checks — each prints a count, never a payload

1. **the write lock holds** — the same `PUT /api/notes` twice, on a key nothing is filed under
   (`{"key":"verify-probe","layer":"probe","text":"probe"}`): to `127.0.0.1:7383` → `200`, to
   the mac's wi-fi address (`ipconfig getifaddr en0`) → `403` with «writes are taken from this mac
   only»; a read on the wi-fi address → `200`. then the same body with `"text":""` deletes it, and
   `git diff --stat hotkeys/notes.json` prints nothing. a real key here overwrites dima's note.
2. **a cap renders from `manual.ts`** — plant a row on a free key of a layer (`hyper` has `q`
   free on main): `{ action: 'verify probe cap', app: 'raycast', key: 'q', mods: 'hyper' }`. the
   daemon's watch rescans within ~2 s: `/api/hotkeys` holds 1 row with that action, the page shows
   a button `q <n> verify probe cap`, and the `hyper` tab count grows by 1. remove the row after,
   and prove `git diff --stat hotkeys/manual.ts` is empty — an edit that removes a line can eat its
   neighbour's newline.
3. **no key name is clipped** — over the 84 caps, a key label (the cap's first text leaf) with
   `scrollWidth > clientWidth` counts `0`. action labels cut with an ellipsis are by design (10 on
   main).
4. **nothing hides below the fold at 1280×800** — select a key, then every button, textarea and
   input has `getBoundingClientRect().bottom <= innerHeight`: the SELECTED KEY, NOTE and NOTES
   panels all sit on the first screen (page height 919, the rest is padding). `scrollWidth -
   innerWidth` is `0` at both widths.
5. **the tab walk with a key selected** — click a cap, then `tab-walk.sh` from `x:browser-headless`:
   58 stops, 0 flags on main.
6. **stats renders** — `find role button click --name stats --exact` → `/stats`: the totals row
   and the CHORDS / CHORDS PER APP lists (DOM bars, 0 svg), `errors` at 0.

## the false lead — `aria-disabled` on caps

dnd-kit sets `aria-disabled="true"` on every cap whose drag is off: 61 of 84 on main, and they are
free keys that still click, with a `pointer` cursor. it means «not draggable», never «not
clickable» — do not report it. the essentials script skips `[aria-disabled=true]` in its cover
and cursor checks, so those 61 caps are proven by check 4 and the tab walk, not by essentials.

## essentials

`x:browser-headless` essentials on every touched view at 1280 and 390. main: clean at 1280 with a
key selected; at 390 one baseline fail — the `n` cap («Notion») reads cursor `auto`.

## evidence

- a screenshot of the board with the touched key selected, at 1280 and 390, and of `/stats` when
  it changed
- the check lines above, one each, and `errors: 0` from a fresh session
- the line `essentials: <n> pass · <m> fail`, with the baseline fail named as baseline
- `pnpm exec vitest run hotkeys` and `pnpm --filter chords typecheck`, read by exit code
