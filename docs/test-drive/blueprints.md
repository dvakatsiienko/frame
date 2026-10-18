---
status: live
until: 2026-11-01
dies-when: the verdict line below is written
---

# 🗺️ blueprints — dima and cclio talk through pictures: n8n primary, Obsidian Canvas and draw.io for A/B

Ticket: none

born 2026-10-18 from the viz-tool shape (PK-172, dima's inbox wish): 3 research lanes, 4 tools drawn, edited by dima and read back the same day; LikeC4 dropped. the home: `cclio/blueprints/`; the recipe: `recipes/refresh-blueprint-comms/`.

**test card:** we believe a shared, editable picture gets an idea between dima and cclio faster and clearer than prose · we test it by drawing every review dima asks for in n8n first (the pm module flow, cclio's memory structure, the fleet memory), and on his ask the same blueprint in Canvas or draw.io · we measure per round: cclio's tokens to draw and to read his edit back, his edit read back right (y/n), what got lost, his look-and-feel word, and every n8n automation that ran (n8n's own otel spans are a candidate source) · we're right if dima reaches for a blueprint on his own at least 3 times and every edit of his reads back right

**kill rule:** an edit of his read back wrong twice · he calls the flow clunky three rounds running

## stress list

- a rename in n8n: do the arrows keyed by that name survive
- his unsaved tab while cclio writes through the REST API
- the memory map, 50+ tiles: does Tidy up keep it readable
- an A/B round: the same blueprint in all three, his pick
- an automation that fails: does the run history show why

## rounds

- 2026-10-18 · round 0, the pm flow (14 tiles) in all four tools · dima's edits read back right in draw.io, Canvas and n8n (a question tile, arrows, a sticky) · edit cost ~311 draw.io, ~131 n8n, ~94 Canvas, ~68 LikeC4 (tokens, bytes ÷ 3.5) · LikeC4 dropped: no tiles or arrows from its UI · first automation live: composer receipts → n8n webhook → data table, a test row read back

## verdict
