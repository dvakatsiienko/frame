---
kind: refresh
owner: coordinator
artifacts:
  - x:research
  - script/research-lanes.sh
  - home/.claude/agents/researcher.md
  - docs/test-drive/exa.md
  - docs/test-drive/parallel.md
  - docs/test-drive/firecrawl.md
  - docs/test-drive/ctx7.md
script: none
groomed: 2026-10-20 (dima)
---

# refresh-research-lanes

keeps the fleet's research doors sharp: the researcher subagent and its brief, the free complementary lanes beside it (exa, parallel), and the tools on trial. born 2026-10-20 from FRM-270.

## the want

dima, 2026-10-20 (the grill):

> each time we run this recipe, we research the research tools themselves and the best practices that sharpen how agents do research. this reaches the researcher subagent and its instructions: how to write a proper brief for a researcher subagent and sharpen it so it searches in the most efficient way — its frontmatter and settings included.

> for the complementary tools, research alternatives to what we use. exa and parallel are complementary, supportive branches beside our main researcher subagent. each run checks that our picks are still good, alive and fast enough, and looks for other options worth a test drive and eventual adoption, or simply better ones, since new ones keep appearing.

> the catch: we use those tools on a free tier, so they are free backup researchers for us — that's why they're good. each run hunts for tools with a generous free quota we could use as a free backup. i have no plans to buy a paid research tool for now.

> prefer tools that have a cli, not an mcp: we research not very often, so a resident mcp load is not preferable — optional only when the tool is very good and has only an mcp.

> keep the run history inside the recipe's own git-ignored folder, not a dedicated knowledge page.

his standing calls:
- free tiers only, no paid research tool (2026-10-20)
- a cli door over an mcp (2026-10-20)
- score each lane per run, so a lane that earns nothing goes (2026-10-20, Q1)

## the run

- the trials of research tools (firecrawl and any new one) log their rounds in their own test-drive file; this recipe reads those rounds in its analysis and writes their verdict lines, so no research tool gets a recipe of its own
- suggest a run when: a lane's free tier or price changes, a new research tool is tried, or 30 days since the last run

1. **shape**: `clio:shape-recipe` step 0, the grill. done: his word on the round. (open)
2. **research** — the brief from `pnpm recipe:brief refresh-research-lanes`; `pnpm research:lanes <brief> <out>` + the `researcher` agent on the same brief + a `neuroarxiv` lane every run (dima, 2026-10-21), its paper reads one `helper-lite` per paper. done: every lane returned or marked failed. (script)
3. **score** — per lane, from this run and the `last/` outputs of the recipe runs since the last one: what each lane found that no other did, its seconds and cost. done: one score line per lane in the print. (open)
4. **distill** — into the artifacts below. done: each read and touched, or named «unchanged». (open)
5. **log** — the line in `log.md`. done: the line is there. (template)

## vectors

### research
- research best practices for agents: how a research subagent's brief is written so it searches efficiently — the question, the vectors, the output shape, the stop rule; frontmatter and settings (model, effort, tools)
- our picks alive and good: exa, parallel, firecrawl, ctx7 — releases, outages, free-tier changes, speed
- new complementary research tools with a generous free tier, a cli door first; an mcp-only tool named only when it is clearly better
- the doors: cli, mcp or rest per tool, and our `op-run` key paths still valid
- library docs reach: ctx7 against a docs site's own `llms.txt` and a crawl

### analysis
- lane agreement: per lane, what it found that no other lane did, across the recipe runs since the last run (`recipes/*/last/`)
- the trials' rounds: `docs/test-drive/` for every research tool
- what broke for us: flawlog lines tagged `#unchecked-source`, and research claims later found wrong (the gh-stack «exit 9» line, 2026-10-20)

## artifacts

- `x:research` — the skill every research runs through: its lane list and its brief rules; the distill edits only the lines a finding proves wrong
- `script/research-lanes.sh` — the lanes runner: a lane added, dropped or re-pointed lands here
- `home/.claude/agents/researcher.md` — the researcher card: its frontmatter and its instructions
- `docs/test-drive/exa.md` — exa's verdict line, rewritten when a run proves it stale
- `docs/test-drive/parallel.md` — parallel's verdict line, the same
- `docs/test-drive/firecrawl.md` — a live trial: the run reads its rounds and writes its verdict when due
- `docs/test-drive/ctx7.md` — ctx7's verdict line, rewritten when a run proves it stale

## findings

- the checklist each print carries: every lane scored · each pick alive or not · one new free-tier tool worth a test drive, or «none found» · one brief-writing practice borrowed, or «none fits»
