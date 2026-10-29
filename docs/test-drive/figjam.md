---
status: dropped
until: 2026-10-27
dies-when: the verdict line below is written
---

# figjam — the Figma remote MCP as a blueprint surface, beside n8n and obsidian

Ticket: none

dima, 2026-10-20: «i recalled there is figjam too. i like it, it's the prettiest of all wireframing tools» · «can you use figjam more easily rather than spawning a claude -p, via yourself? yes, let's test drive it.»

**test card:** we believe FigJam draws blueprints dima finds prettier and edits more gladly than n8n or obsidian canvas · we test it by drawing every blueprint of the week there too (first: the refresh-crew-coordinator recipe flow, PK-213), cclio calling the figma mcp straight from her session · we measure calls per blueprint, wall time, whether dima edits it, whether cclio reads his edit back right, and the starter plan's monthly call cap · we're right if dima picks FigJam over the other two for at least 2 of the week's blueprints and the cap never blocks a draw
**kill rule:** the starter cap blocks a write mid-week, or a read-back of his edit loses what he changed

## setup

- the remote server `https://mcp.figma.com/mcp`, scoped local to `~/frame/_clio` and `~/frame/.scratch/figjam-probe` only (not user-wide, so no other session carries its tools)
- figma account: Starter plan, View seat (whoami, 2026-10-20)
- day 0 docs (researcher, 2026-10-20): the REST api writes no nodes; the remote mcp writes FigJam through `create_new_file`, `generate_diagram` (mermaid), `use_figma` (stickies, sections, connectors, shapes, tables); `get_figjam` reads the node tree back; drafts are unlimited on Starter, 3 team files; the docs disagree whether Starter can write and whether writes count against 20 calls a month

## stress list
- `generate_diagram` from mermaid — a recipe flow blueprint (PK-213) — calls, seconds, does it render
- `use_figma` — dima's sticky or section added by hand, then cclio adds one beside it — calls, does layout hold
- `get_figjam` — read back a board dima edited — what cclio reports vs what he changed
- `get_screenshot` — the board as an image for a look card — size, readability
- the starter cap — count every call of the week — calls used vs the 20

## rounds
- 2026-10-20 · probe from a scratch `claude -p` (sonnet): whoami, create_new_file, create_session, generate_diagram of a 6-node flow · 4 calls, 0 errors, render not checked · [the board](https://www.figma.com/board/z3uF8ouxtY12wA0IM3t0IG) · the usual door (n8n) needs a workflow file; this needed one mermaid string
- 2026-10-21 · PK-175 memory map via use_figma (3 sections, 60 stickies, one script) · 5 calls (whoami, create_new_file, create_session, use_figma, get_screenshot), 0 errors, ~2 min end to end incl. the dataviz twin · [the board](https://www.figma.com/board/2fMuaJ7PBynQPMGM4P0Ozb) · vs the dataviz artifact [Memory Map](https://claude.ai/artifact/9XysMeNS37nuznbqNHBxqH): FigJam shows grouping, not size (stickies are fixed 240 px); Starter + View seat wrote fine · dima's grade: the page more useful here (pretty, granular sizes), the board better for the overall picture (less pretty, no detail)

- 2026-10-20 · stacked prs vs regular prs, 3 sections from one mermaid string (`.scratch/figjam-probe/stacked-prs.mmd`), drawn from a background `claude -p` (sonnet): the desktop cclio session sees figma as unauthorized while `claude mcp get figma` reads connected · 5 calls (the month's count: 9 of the doc's possible 20), 0 errors, one retry of my own (the tools flag swallowed the prompt) · rendered: one wide row (3902×296), `<br/>` works, ①②③ and `·` dropped from titles, self-loop arrows show as bare labels · [the board](https://www.figma.com/board/UtpBpxzTXb8mmitlclKLPJ) · vs n8n: one string, no workflow file; layout is mermaid's, not ours
- 2026-10-20 · the same blueprint redrawn top-to-bottom with plain labels onto the existing board (`stacked-prs-tb.mmd`), background `claude -p` · 3 calls (the month: 12), 0 errors · the page shot came back 5285×1362 but was never viewed, so readability is unchecked · gh stacks need no setup (docs.github.com), so the board's facts hold
- 2026-10-20 · desktop figma connector (dima installed it, the cli mcp stays needs_auth in a desktop session) · whoami + get_screenshot of page 0:1 at 2000 px, read inline · 2 calls (the month: 14), 0 errors · v2 sits RIGHT of v1, not below; readable at 2000 px; mermaid subgraph titles dropped in both · cclio draws and reads FigJam directly now, no claude -p hop
- 2026-10-20 · the day's count for the cap (dima asked): 14 figma mcp calls across 4 rounds (4 probe, 5 draw, 3 redraw, 2 desktop read), all answered, no rate-limit or quota error · the starter cap is not hit at 14; tomorrow's coordinator and pm blueprints push it further — the first 429 or «limit» message is the number

- 2026-10-21 · PK-213 the refresh-crew-coordinator run flow via use_figma (5 sections, 33 shapes, 29 connectors, 3 side sections) · 7 calls (whoami, create_new_file, create_session, 2 use_figma, 2 get_screenshot), 0 errors, no cap message · [the board](https://www.figma.com/board/RAJ5NlCcJVqfWNjR0KiS35) · first draw: elbowed connectors across sections cut through tiles, fixed by section-to-section straight arrows; an ENG_DATABASE tile clipped its text until widened

- 2026-10-21 · PK-241 crew-lead flow via use_figma (6 sections, 49 shapes, 39 connectors, legend + weak-spot stickies) · 4 calls (create_new_file, 2 use_figma, get_screenshot), 0 errors · [the board](https://www.figma.com/board/hVVKYtLdMTKASUS3mwG3Uz) · 2 tiles clipped on the first draw, widened

- 2026-10-22 · PK-103 the pm column on the crew board, the new author-blueprint craft against the 10-21 baseline (5 bands, 40 tiles, 7 ⚠️ weak spots, 35 in-band + 5 band-to-band connectors, a ⚠️ legend tile) · 10 calls (create_session, 2 read-only use_figma for the style, 5 band calls — 4 in parallel —, 1 join + audit + inline shots, 1 fix), 1 call per band, 0 get_figjam/get_screenshot reads, 0 errors, no cap message · the numbers audit: 0 overlaps, 0 tall tiles; it missed 2 diamonds clipping their detail text, the inline screenshot caught them, fixed in 1 call · dima's read: pending

## verdict
- 2026-10-21 · the blueprint recipe run on the crew board: 1 probe + 1 fix call, eval and inline section screenshot proven, the numbers audit found 0 overlaps over 55 tiles and 1 diagonal STRAIGHT arrow, fixed by magnets · ~28 mcp calls today, no cap hit · baseline for the 10-22 pm board: count calls per band, get_figjam/get_screenshot reads, crossings and overflows the audit catches before dima looks, and his read («reads well» or not)
- 2026-10-23 · **dropped**: the kill rule fired — at 14:14 `use_figma` answered «You've reached the Figma MCP tool call limit on the Starter plan» mid-fix (no count, no reset date). View seat = 20 calls/month on any plan (developers.figma.com rate-limits page); REST still reads the board (200, 107 shapes) but writes no nodes. dima, 14:34: a limit reached this fast means FigJam doesn't fit us (his «I want to buy a Figma plan» read as «don't want», wispr); the crew + pm board moves to draw.io, Obsidian canvas or n8n after a three-way bench
