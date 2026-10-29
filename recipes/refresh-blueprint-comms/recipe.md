---
kind: refresh
owner: coordinator
artifacts:
  - _clio/blueprints/comms.md
  - _clio/blueprints/AGENTS.md
  - _clio/plugin-clio/skills/author-blueprint/SKILL.md
  - _clio/plugin-clio/skills/author-blueprint/references/readable.md
script: research:lanes
groomed: 2026-10-21 (dima)
---

# refresh-blueprint-comms

keeps our blueprint tools the best free, local way for dima and cclio to talk through pictures, and keeps cclio's drawing cheap for her and readable and pretty for him.

## the want

dima's, 2026-10-18 (inbox, folded):

> «a recipe that searches for tools making agent ↔ human communication easier through visualization: schema-diagram, mindmap or any other type — explore everything, pick the best candidates to test drive, fold ideas, maybe we build something custom (hopefully not)»

> «flows visualized n8n-style and editable could become a core comms point between us, since human ↔ agent comms are flawed»

dima's, 2026-10-21 (chat, folded, PK-243):

> «we don't have the optimization part: how to use visualization tools efficiently, as cheap as possible for you to edit while keeping the highest quality bar. I'm leaning towards FigJam, so search FigJam optimization first — tips, tricks or skills to draw better there, because sometimes you cram the arrows; maybe there is a better door, maybe even a cli. and the screenshot: don't capture it in 4K, use a lower quality to cut its size»

> «how to teach agents to draw blueprints, canvases and diagrams that are readable and pretty for human reading»

> «I left a comment on the board and you didn't answer it — can you see comments when you edit FigJam? what does it take to read them, and is it expensive to read them each time?»

## the run

- the tool must stay local, free, fast for cclio to read and edit, and editable by dima's drag — the grill in `_clio/blueprints/PRODUCT.md` is the bar every candidate is scored against; cost breaks ties
- draw.io leads every vector: the blueprint tool since the 10-23 bench (`docs/test-drive/blueprints.md` § verdict); n8n only for automations; FigJam and Obsidian Canvas are re-checked only when the run asks «is there a better one?»
- suggest a run when: a blueprint trial ends, a tool on the list ships a major, or dima says a tool feels clunky

1. **groom**: `cclio:shape-recipe` step 0, the grill. done: his word on the list. (open)
2. one research round per `x:research` (exa + parallel + an opus source lane). done: every lane returned or marked failed. (script)
3. the hands-on round: every adopted find tried on the mapped boards (`_clio/blueprints/AGENTS.md`), the cost of one board edit measured before and after. done: each find kept with its numbers or dropped. (open)
4. distill into every artifact (`cclio:shape-recipe` step 2). done: each touched or named «unchanged». (open)
5. findings print; a tool ranking, when one is asked, in the `x:top-seven` shape. done: the print reached dima. (template)
6. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

- new tools for agent-drawn, human-editable diagrams, flows, maps and mindmaps
- automation features worth borrowing from flow tools, never adopted for their own sake
- the cheapest way for an agent to draw and edit a draw.io board at the top quality bar: tokens per edit, a builder script vs hand xml, what to read back and how small
- draw.io doors others use: the desktop cli's export flags, mxGraph libraries, a skill or a plugin that writes `.drawio` well
- layout that never crams: arrow routing, spacing, auto-layout, sections, how others keep agent-drawn boards clean
- screenshots for an agent's read-back: the smallest size and region that still shows a clipped label or a crossing arrow
- how to teach an agent to draw boards a human reads with pleasure: visual hierarchy, density, colour, type, emoji, the skills and prompts that already do it well
- dima's edits and notes on a draw.io board read back cheaply, every time, without his ask: a semantic diff of the file against its last commit

### analysis

- dima's edits read back per tool: what got lost, what churned
- cclio's edit cost per tool on the same edit set
- the two mapped boards: where an arrow crammed or a label clipped, and what the draw cost today

## artifacts

- `_clio/blueprints/comms.md` — the scored shortlist and its numbers; the distill rewrites it whole
- `_clio/blueprints/AGENTS.md` — the tool doors; the distill touches only a door that changed
- `_clio/plugin-clio/skills/author-blueprint/SKILL.md` — the draw and read-back steps; the distill adds a step only when a find changes what cclio does every board
- `_clio/plugin-clio/skills/author-blueprint/references/readable.md` — the readability and efficiency craft; the distill merges the finds that held on the boards

## findings

- a candidate that fails a grill line never leads, whatever it costs
- every craft find names the board where it was tried, with its before and after numbers
