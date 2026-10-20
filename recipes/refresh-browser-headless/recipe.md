---
kind: refresh
owner: [coder, coordinator]
artifacts:
  - x:browser-headless
script: none
draft: true
---

# refresh-browser-headless

keeps the fleet's way into a browser sharp: the headless checks every web change runs, and which browser door fits which job. born 2026-10-20 from FRM-270.

## the want

dima, 2026-10-20 (the grill, Q1):

> each run also looks for better approaches than agent-browser — maybe we find a more performant one, a better door for you into a browser. explore widely, because the ecosystem changes: at some point an entirely new approach may be born, a totally new way for agents to see web pages, much easier than how agent-browser works. it's a problematic area, and i suppose this whole surface may change to something more performant. each run looks for better handling of what agent-browser covers today. search widely.

his standing calls:
- the checks stay sharp, and which browser door fits which job is refreshed each run (2026-10-20, Q1)
- free and cli-first: no paid cloud browser, a cli over an mcp (2026-10-20, Q2)

## the run

- suggest a run when: `agent-browser` ships a minor release, a browser check fails for a reason outside the app, or 30 days since the last run

1. **shape**: `cclio:shape-recipe` step 0, the grill. done: his word on the round. (open)
2. **research** — the brief from `pnpm recipe:brief refresh-browser-headless`; `pnpm research:lanes <brief> <out>` + the `researcher` agent on the same brief, the local-file vectors to the researcher alone. done: every lane returned or marked failed. (script)
3. **distill** — into the artifacts below. done: each read and touched, or named «unchanged». (open)
4. **log** — the line in `log.md`. done: the line is there. (template)

## vectors

### research
- (round 2 of the grill)

### analysis
- (round 2 of the grill)

## artifacts

- `x:browser-headless` — the skill and its essentials checks; the distill edits only the lines a finding proves wrong

## findings

- (round 2 of the grill)
