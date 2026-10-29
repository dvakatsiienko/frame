---
kind: refresh
owner: [codie, coordinator]
artifacts:
  - x:browser-headless
script: none
---

# refresh-browser-headless

keeps the fleet's way into a browser sharp: the headless checks every web change runs, and which browser door fits which job. born 2026-10-20 from FRM-270.

## the want

dima, 2026-10-20 (the grill, Q1):

> each run also looks for better approaches than agent-browser — maybe we find a more performant one, a better door for you into a browser. explore widely, because the ecosystem changes: at some point an entirely new approach may be born, a totally new way for agents to see web pages, much easier than how agent-browser works. it's a problematic area, and i suppose this whole surface may change to something more performant. each run looks for better handling of what agent-browser covers today. search widely.

his standing calls:
- the checks stay sharp, and which browser door fits which job is refreshed each run (2026-10-20, Q1)
- free and cli-first: no paid cloud browser, a cli over an mcp (2026-10-20, Q2)
- the gains land in `x:browser-headless` and its essentials only (2026-10-20, Q4)

## the run

- suggest a run when: `agent-browser` ships a minor release, a browser check fails for a reason outside the app, or 30 days since the last run

1. **shape**: `clio:shape-recipe` step 0, the grill. done: his word on the round. (open)
2. **research** — the brief from `pnpm recipe:brief refresh-browser-headless`; `pnpm research:lanes <brief> <out>` + the `researcher` agent on the same brief, the local-file vectors to the researcher alone. done: every lane returned or marked failed. (script)
3. **distill** — into the artifacts below. done: each read and touched, or named «unchanged». (open)
4. **log** — the line in `log.md`. done: the line is there. (template)

## vectors

### research
- new ways for agents to see web pages: anything that could replace or beat `agent-browser`, searched widely (his «search widely»)
- the delta: `agent-browser`, the Code tab browser pane, Claude in Chrome, computer use, playwright since the last run
- which door fits which job: a headless check, a page dima also sees, his signed-in Chrome, a native app — and what each blocks
- speed and tokens per check, so «more performant» carries a number

### analysis
- what broke for us: flawlog lines naming a browser door, codie and sixth sense retros on ui checks
- the essentials against best practice: each check in `essentials/` still catching what it was written for

## artifacts

- `x:browser-headless` — the skill and its essentials checks; the distill edits only the lines a finding proves wrong

## findings

- the checklist each print carries: one new approach worth a try, or «none found» · the door map re-checked · `agent-browser` alive and current · one essentials check borrowed or cut, or «none»
