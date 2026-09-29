# AGENTS.md: speak

the voice admin for x-speak, as a served app. vite + react + tailwind, one page, built to `dist/` and served
with its api by `server.ts` on 127.0.0.1:7386 — always on through the launchd job `x-speak-admin`
(`schedule/jobs/x-speak-admin`); dev on 7387 with `pnpm speak:admin-dev`, proxying to it. a ui change is live after
`pnpm speak:admin-build`; a `server.ts` change needs `pnpm schedule:restart x-speak-admin`.
not deployed anywhere: it edits this mac's config.json and talks to this mac's daemon.

**`FTR.md` + `CONTEXT.md`** — read your section before changing what the app does.

📌 `PRODUCT.md` (impeccable `init`, 2026-09-29) is the product record — read it before changing what the app
does. `DESIGN.md` is a stub until `document` runs. both are impeccable's files: change them through it, never by
hand.

## the daemon is not here

x-speak lives in `schedule/jobs/x-speak/` (swift, launchd). this app reaches it only through
`~/.local/share/x-speak/control.sock` — one json line each way: `status`, `voices`, `reload`, `preview`, `stop`.
the chain, voices, speed, gain and budget live in `schedule/jobs/x-speak/config.json`; the page holds nothing
else, and the daemon re-reads the file on the next F5 after a save.

## hazards

- **save goes through biome's formatter, fed indented json** — biome keeps an object expanded only when its input
  was; compact input rewrote dima's whole file and the commit hook refused it (ce906229)
- **a dnd-kit reorder applies `move()` on every drag-over**, with the snapshot back on a cancel — applying it only
  on drop fought dnd-kit's optimistic dom move, and the page and the ranks disagreed after a keyboard drag
- **only a chain card registers with dnd-kit** — it stamps `role` and a tab stop on what it registers, which broke
  the list semantics on the cards outside the chain
- the voice lists are data in `server.ts`, each id proven by a real call (elevenlabs premades on the restricted key,
  kokoro on the warm server); a library voice answers 402 on a restricted key
