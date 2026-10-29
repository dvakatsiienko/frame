---
status: adopted
until: 2026-11-01
dies-when: the verdict line below is written
---

# 🗺️ blueprints — dima and cclio talk through pictures: draw.io primary since 2026-10-23, n8n for automations

Ticket: none

born 2026-10-18 from the viz-tool shape (PK-172, dima's inbox wish): 3 research lanes, 4 tools drawn, edited by dima and read back the same day; LikeC4 dropped. the home: `_clio/blueprints/`; the recipe: `recipes/refresh-blueprint-comms/`.

**test card:** we believe a shared, editable picture gets an idea between dima and cclio faster and clearer than prose · we test it by drawing every review dima asks for in n8n first (the pm module flow, cclio's memory structure, the fleet memory), and on his ask the same blueprint in Canvas or draw.io · we measure per round: cclio's tokens to draw and to read his edit back, his edit read back right (y/n), what got lost, his look-and-feel word, and every n8n automation that ran (n8n's own otel spans are a candidate source) · we're right if dima reaches for a blueprint on his own at least 3 times and every edit of his reads back right

**kill rule:** an edit of his read back wrong twice · he calls the flow clunky three rounds running

## stress list

- a rename in n8n: do the arrows keyed by that name survive
- his unsaved tab while clio writes through the REST API
- the memory map, 50+ tiles: does Tidy up keep it readable
- an A/B round: the same blueprint in all three, his pick
- an automation that fails: does the run history show why

## unload ledger — what each automation takes off clio

one line per automation: the duty it took over, that duty's cost before (tool calls and turns per session, from the transcripts via `duckdb`), the failure it removes, and the cost after. the trial's «does n8n unload the flow» verdict reads this, never a feeling.

- 🔴 ci watch · before: the boot arms ci-watch (1 call), it fires on stale reds (10-18: one wake on 2-day-old runs, a re-arm call), dies at 6 h · removes: stale-red wakes, the 6 h death · after: 0 calls until ci-watch arming leaves the boot (dima's call: it also wakes a turn mid-session, n8n cannot)
- 🎼📬 helga receipts · before: a bounced receipt meant the boot polled the vault file (10-18: ~80 s wait loop) · removes: a lost receipt · after: the digest prints them; the wait loop stays until the receipt is trusted

## rounds

- 2026-10-18 · round 0, the pm flow (14 tiles) in all four tools · dima's edits read back right in draw.io, Canvas and n8n (a question tile, arrows, a sticky) · edit cost ~311 draw.io, ~131 n8n, ~94 Canvas, ~68 LikeC4 (tokens, bytes ÷ 3.5) · LikeC4 dropped: no tiles or arrows from its UI · first automation live: composer receipts → n8n webhook → data table, a test row read back

- 2026-10-23 · the tool bench: the crew + pm board (107 tiles, 89 arrows, 13 sections) redrawn by three Opus 5.5 helpers from the FigJam REST export · draw.io 2:39 min, 27 calls, 78k tokens, every shape, colour and arrow label kept · Obsidian Canvas 3:43, 25 calls, 109k, no text size, no diamonds, 6 colours · n8n 6:00, 46 calls, 110k, no colours, no arrow labels, notes cut at ~32 chars · dima picked draw.io; n8n stays for automations

## verdict

- 2026-10-23 · **adopted: draw.io is the blueprint tool, n8n for automations only** (dima, 16:17: «only draw.io is main blueprint tool», unless a better one turns up or FigJam becomes reachable; Obsidian Canvas an option for later). FigJam left at the Figma MCP cap (`figjam.md`). the boards and the doors: `_clio/blueprints/AGENTS.md`
