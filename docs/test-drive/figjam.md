---
status: live
until: 2026-10-27
dies-when: the verdict line below is written
---

# figjam — the Figma remote MCP as a blueprint surface, beside n8n and obsidian

Ticket: none

dima, 2026-10-20: «i recalled there is figjam too. i like it, it's the prettiest of all wireframing tools» · «can you use figjam more easily rather than spawning a claude -p, via yourself? yes, let's test drive it.»

**test card:** we believe FigJam draws blueprints dima finds prettier and edits more gladly than n8n or obsidian canvas · we test it by drawing every blueprint of the week there too (first: the refresh-crew-coordinator recipe flow, PK-213), cclio calling the figma mcp straight from her session · we measure calls per blueprint, wall time, whether dima edits it, whether cclio reads his edit back right, and the starter plan's monthly call cap · we're right if dima picks FigJam over the other two for at least 2 of the week's blueprints and the cap never blocks a draw
**kill rule:** the starter cap blocks a write mid-week, or a read-back of his edit loses what he changed

## setup

- the remote server `https://mcp.figma.com/mcp`, scoped local to `~/frame/cclio` and `~/frame/.scratch/figjam-probe` only (not user-wide, so no other session carries its tools)
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

## verdict
