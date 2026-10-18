---
kind: refresh
owner: coordinator
artifacts:
  - cclio/blueprints/comms.md
  - cclio/blueprints/AGENTS.md
script: research:lanes
draft: true
---

# refresh-blueprint-comms

keeps our blueprint tools the best free, local way for dima and cclio to talk through pictures.

## the want

dima's, 2026-10-18 (inbox, folded):

> «a recipe that searches for tools making agent ↔ human communication easier through visualization: schema-diagram, mindmap or any other type — explore everything, pick the best candidates to test drive, fold ideas, maybe we build something custom (hopefully not)»

> «flows visualized n8n-style and editable could become a core comms point between us, since human ↔ agent comms are flawed»

## the run

- the tool must stay local, free, fast for cclio to read and edit, and editable by dima's drag — the grill in `cclio/blueprints/PRODUCT.md` is the bar every candidate is scored against; cost breaks ties
- suggest a run when: a blueprint trial ends, a tool on the list ships a major, or dima says a tool feels clunky

1. **groom**: `cclio:shape-recipe` step 0, the grill. done: his word on the list. (open)
2. one research round per `cclio:research` (exa + parallel + an opus source lane). done: every lane returned or marked failed. (script)
3. the hands-on round: the top candidates draw the same flow, dima edits, cclio reads back and measures. done: every candidate scored on the grill. (open)
4. distill into `comms.md` (`cclio:shape-recipe` step 2). done: touched or named «unchanged». (open)
5. findings print, the top 7 in the `x:top-seven` shape. done: the proposal is printed. (template)
6. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

- new tools for agent-drawn, human-editable diagrams, flows, maps and mindmaps
- automation features worth borrowing from flow tools, never adopted for their own sake

### analysis

- dima's edits read back per tool: what got lost, what churned
- cclio's edit cost per tool on the same edit set

## artifacts

- `cclio/blueprints/comms.md` — the scored shortlist and its numbers; the distill rewrites it whole
- `cclio/blueprints/AGENTS.md` — the tool doors; the distill touches only a door that changed

## findings

- a candidate that fails a grill line never leads, whatever it costs
