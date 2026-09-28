# AGENTS.md: chords

the hotkey map, as a served app. vite + react + tailwind, one page today, built to `dist/` and
served by the always-on `x-monitor-hotkey-live` daemon. it is not deployed anywhere and there is
nothing to deploy it to — it draws this mac's bindings and this mac's press log.

**`FTR.md` + `CONTEXT.md`** — read your section before changing what the app does.

**`PRODUCT.md` is the product authority and `DESIGN.md` is the look authority.** read the first
before changing what the app does, the second before changing how anything renders. `DESIGN.md`
binds on top of the house ui guides, and its named rules — Zero Blur, Owner Edge, Earned Accent,
Two Hands, Tabular, Cold Ring — are the ones a review will cite.

📌 **`PRODUCT.md` and `DESIGN.md` here are seeded by impeccable only (dima's hands, `init` +
`document`), kept as the reference point for DOT-244's own doc system — never rewrite them into
another shape.** `.impeccable/design.json` is `document`'s sidecar and is regenerated with them,
never by hand.

## the server is not here

`hotkeys/serve.ts` is the other half of this app and lives one directory up, inside the daemon,
because the daemon is already watching the press log and the config sources. the contract:

- `GET /api/hotkeys` — the scan snapshot. `503` until `pnpm hotkeys:scan` has run once
- `GET /api/presses` — server-sent events, two kinds: `presses` when a chord is pressed,
  `bindings` when a config source moved and the scan reran. the page holds no timer of its own
- `GET`/`PUT /api/notes` — `hotkeys/notes.json`. empty text is the delete
- `POST /api/manual` — a rebind, written surgically into `manual.ts`. `409` when it cannot place
  the edit exactly, `400` when a field is missing or carries a control character

📌 **both writing routes take a write from a loopback peer only, demand `application/json` and
refuse an unknown `Origin`.** the phone on the wi-fi reads and never writes; the last two checks
stop a browser page on this mac. the full reasoning is in `serve.ts`'s own header.

## the scripts

- `pnpm chords:dev` — vite on 7374, proxying `/api` to the daemon on 7373
- `pnpm chords:build` — writes `dist/`, which the daemon serves
- `pnpm hotkeys:map` — opens the served page

📌 vite does not rewrite `Origin` when it proxies, so a dev page's origin is 7374's. both ports
are on the server's allowlist and removing either breaks a loop that looks unrelated.

## conventions

- the guides bind here: `x:guide-react` for components, `x:guide-typescript` for types,
  `x:guide-ui-ux` for anything rendered. `DESIGN.md` binds on top of them for this app
- the keyboard layout table in `src/keyboard.ts` carries a `biome-ignore format` line on purpose:
  one line per keyboard row, because the shape of that table is the keyboard
- `chord.ts` and `manual.ts` are imported from one directory up. they are shared with the node
  side (`scan.ts`, `top.ts`, `live.ts`), so neither may grow a browser-only import
