---
name: research
description: load BEFORE any research, asked or started — «research», «explore», «do research about», «prior art», «worth a test drive?», a tool or a link to vet, a recipe's research step. not a one-fact lookup, and not matt's `research` (that one writes one source file).
---

# research — every research runs all the doors at once

dima, 2026-09-29: «whenever i ask for research or you decide to research yourself, use
all research tools at once to get a diversified result (especially since exa and parallel
ai are essentially free research tools).» dima, 2026-10-20: «i want to spawn our properly shaped research on any surface — a coder, a plain thread, a cowork thread.»

## the lanes

- **one brief file, every lane, in parallel.** write the question once (context, numbered
  vectors, the output shape); a brief born from a cclio pocket item cites its W-lines and passes `node ~/frame/_clio/script/wish-cover.ts <PK-N> <brief>`, then:
  - `pnpm -C ~/frame --silent research:lanes <brief.md> [out]` — the exa agent run + the parallel core run + a linkup research run (on trial, `docs/test-drive/linkup.md`), side by side under `op-run`; one line per lane: status, seconds, chars, cost (~$0.10 exa, cents parallel, $0.25 linkup)
  - **an opus source lane** on the same brief, pointed at what needs SOURCE reading — code, skills, prompts, npm, real api probes. in cc the door is the `researcher` agent (`omitClaudeMd`, no fleet memory), so the brief carries the whole question and the output shape; a surface with no `researcher` type (cc cloud) spawns a general-purpose agent on opus whose prompt opens with the body of `home/.claude/agents/researcher.md`
  - **neuroarxiv** when the question is an architecture or method one; **`advise-project-approach`** when a plan or a process is about to be chosen
- **the brief says «answer in english»**: an exa run on a brief without it came back entirely in french (2026-10-20, cc cloud)
- **the web lanes cannot read our files**: a vector over local files (logs, `last/` outputs, our docs) goes to the source lane alone, never to exa, parallel or linkup
- **docs reach**: one library question → `ctx7 docs`; a site's whole corpus → curl its `llms.txt` / `llms-full.txt`; a bot-blocked page → `pnpm -C ~/frame --silent web-bot-blocked:fetch <url>`
- **the lanes disagree on purpose**: exa is broad and dated, parallel the most sceptical, the source lane the only one that reads code. the synthesis names where they split.
- **one reply when all lanes land**: hold early lanes, print once.
- **prior art is offered unprompted** whenever a build, a feature or an approach is about to be chosen: «others solved this how, and where did it break?» as one fan-out round before the build (dima, 2026-09-30: «i want your prior art research suggestion always, whenever it matters»)
- a one-fact lookup is not research: `linkup search` (5 s, half a cent), exa `/answer` or WebSearch, not the full fan-out.

## per surface

- **cc anywhere** (a coder, a plain thread): the lanes command as above, the `researcher` agent as the source lane
- **cw**: the lanes run on dima's mac through Desktop Commander (the `mcp__remote-devices__` one), wrapped as `zsh -lc 'pnpm -C ~/frame --silent research:lanes <brief> <out>'`; the brief file is written there first; the source lane is cw's own reading
- **cc cloud** (a claude.ai project thread, no `~/frame` in its container): the lanes run on the mac through the same `mcp__remote-devices__` Desktop Commander, launched detached — `zsh -lc 'cd ~/frame && nohup pnpm --silent research:lanes <brief> <out> > <dir>/run.log 2>&1 &'` — because a run outlives one tool call (measured 2026-10-20: exa 78 s, parallel 183 s, linkup 344 s); poll `run.log` for its `out:` line. brief and lanes live in `~/.local/share/research-lanes/<topic>/<date>-<slug>/`. the source lane is the general-purpose stand-in above, reading bot-blocked pages through `web-bot-blocked:fetch` on the mac; a bridge drop leaves the detached run going, read it once the link is back
- **cclio**: also the recipe step — a subject researched twice becomes a recipe (`cclio:shape-recipe`), never a second one-off doc

## the print

- **a research print to dima is a fresh-news read, never a status line** (dima, 2026-10-12: «when i ask to research, i'm curious — tips, bits, facts that would surprise me»): the headline in a sentence, then the ~3 sections of 3–5 lines that carry the most, picked from 🆕 what's new · 😮 the surprising bits · 🧰 tips and borrows · ⚠️ what it found wrong in ours · ➡️ what it moves, each fact with its number and a link, natural sentences, nested where a list grows.
  - **what he rates** (his scores, 2026-10-12): high — prior art and places to borrow, raw api turned into ideas we could build, fleet-level surprises, a bug class across our tools, a built-in he may not use yet; low — the internals of a fix. the internals are yours to act on: one line «fixed: N items», never a section
