---
status: closed
until: 2026-11-02
dies-when: the verdict line below is written
fits: clio
---

# 🎨 excalidraw — the blueprint tool on trial against draw.io, local files, no Excalidraw+

Ticket: FRM-450

born 2026-10-25 from the PK-276 research and bench (dima: «let's try Excalidraw for a week … let's try without comments»). the research and the bench: `~/.local/share/research-lanes/excalidraw/2026-10-25-vs-drawio/` (`web-digest.md`, `source-lane.md`, `bench/`). draw.io stays the fallback until the verdict.

**test card:** we believe Excalidraw boards read better for dima and render faster, at an acceptable cost in file noise · we test it by moving both live boards over (the pm board, the tickets flow) and running the week's blueprint asks on Excalidraw only: every redraw, every read-back of his edit · we measure per round: clio's tokens and tool calls to draw and to read back, render seconds, the read-back right (y/n), what got lost from the draw.io board, his look-and-feel word · we're right if every edit of his reads back right and he picks Excalidraw's look over draw.io's at the verdict

**kill rule:** an edit of his read back wrong twice · a redraw costs more than twice the draw.io builder's calls three rounds running · he calls it clunky twice

## the setup

- the toolchain: `_clio/blueprints/excalidraw/`, its own pnpm root (`pnpm install` there; the router bundle is `pnpm build:router`); verbs `convert`, `render`, `crossings`, `read-back`, `ticket-flow:build`; `pnpm test` there, 43 tests (frame's root vitest skips the dir)
- the boards: `_clio/blueprints/excalidraw/<board>/board.excalidraw`, converted from the draw.io board with `pnpm convert ../<board>.drawio <board>/board.excalidraw`
- dima opens a board in the excalidraw.com PWA: ⌘O the file, ⌘S saves back to it; his notes are text elements starting with 💬, read back by `pnpm read-back <before> <after>`

## stress list

- the converter — both live boards, .drawio → .excalidraw — counts matched, crossings, minutes
- a redraw from a builder — the tickets-flow section after the next contract change — calls, tokens, seconds, re-run diff lines
- his 💬 note — the next board question he has — read back right (y/n)
- his hand move and text edit — any edit he makes in the PWA — read-back lines vs his real change
- a dense band (50+ tiles) — the pm board — text past its tile, arrows crossing tiles
- the hand-drawn font — one board rendered in Excalifont — his look word vs Helvetica
- the PWA as his editor — ⌘O / ⌘S on a local file — any save that breaks the file

## rounds

- 2026-10-25 · round 0, the bench: band 3 (9 tiles, 8 arrows) · render 1.0 s vs draw.io 3.3 s; 99 tiles 1.1 s vs 7.8 s · file 55 KB vs 12 KB (4.6×) · one tile moved: 92 diff lines vs 4 · no bold or italic; the CLI routes no arrow, Excalidraw's router ran in headless Chrome (a 14.6 MB bundle) · bench report: the helper's summary, `bench/` holds every file

- 2026-10-25 · round 1, the PWA as his editor: the reshuffle and two redraws were written to `board.excalidraw` (committed 16:47) while his PWA tab held the file open · the tab never showed them until he reloaded, and a tile he dropped in the tab never reached the file · a miss against the stress list's «⌘O / ⌘S on a local file»: the PWA holds a copy, not a live view; each redraw needs his ⌘O, each edit of his his ⌘S

## verdict

- 2026-10-30 · **adopted, closed early** (dima, 16:08: «we 100% need a blueprint like this. Excalidraw is just a tool. It's good enough … let's have Excalidraw as a main blueprinting tool for now»): 2 rounds, the crew-pm board v7 redrawn today with 2 texts re-wrapped and its render checked; the miss stays — the PWA holds a copy, so each redraw needs his ⌘O · FigJam is still the best tool, out on its free quota; comments in Excalidraw sit behind Excalidraw+, not bought · draw.io stays installed as the fallback, n8n stays for automation only
