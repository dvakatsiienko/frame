# research lanes — every research runs all the doors at once

dima, 2026-09-29: «whenever i ask for research or you decide to research yourself, use
all research tools at once to get a diversified result (especially since exa and parallel
ai are essentially free research tools).»

- **one brief file, every lane, in parallel.** write the question once (context, numbered
  vectors, the output shape), then:
  - `pnpm research:lanes <brief.md> [out]` — the exa agent run + the parallel core run, side by
    side under `op-run`; one line per lane: status, seconds, chars, cost (~$0.10 exa, cents parallel)
  - **an opus lane** (a fresh agent, never a fork) on the same brief, pointed at what needs SOURCE
    reading — code, skills, prompts, npm, real api probes. the door is the `researcher` agent
    (`omitClaudeMd`, no fleet memory: its first request wrote 9.2k tokens against ~137k for a plain
    agent, 2026-10-07), so the brief carries the whole question and the output shape
  - **neuroarxiv** when the question is an architecture or method one; **`advise-project-approach`**
    when a plan or a process is about to be chosen (adopted)
- **the lanes disagree on purpose**: exa is broad and dated, parallel the most sceptical, the opus
  lane the only one that reads source. the synthesis names where they split.
- **one reply** when all lanes land (habit-dima-comms-pacing), and **recipe-first** when the subject will be
  researched again (`cclio:shape-recipe`).
- **a research print is a fresh-news read, never a status line** (dima, 2026-10-12: «when i ask to research, i'm curious — tips, bits, facts that would surprise me; i like updates and refreshes, that's why we have evergreen»): any research — a recipe run, his plain ask, one i start — lands as a longer, pretty print past the reply budget: the headline in a sentence, then the ~3 sections that carry the most, picked from 🆕 what's new · 😮 the surprising bits · 🧰 tips and borrows · ⚠️ what it found wrong in ours · ➡️ what it moves, each fact with its number and a link, natural sentences, nested where a list grows. a «lanes are back» line is never the report.
  - **what he rates** (his line-by-line scores on the mods run #4 print, 2026-10-12): high — prior art and places to borrow, raw api turned into ideas we could build, fleet-level surprises (two cc builds on one mac), a bug class across our tools, a built-in of mine he may not use yet; low — the internals of a fix (a missing `.catch`, a health value, tool-search loading). the internals are mine to act on: one line «fixed in our mods: N items», never a section
  - size: a little under the 10-12 print, ~3 sections of 3–5 lines; the rest goes to the coder's brief
- **prior art is offered unprompted** whenever a build, a feature or an approach is about to be chosen: «others solved this how, and where did it break?» as one fan-out round before the build (dima, 2026-09-30, on the speak word-highlight Q12: «i want your prior art research suggestion always, whenever it matters»)
- a one-fact lookup is not research: exa `/answer` (2 s, half a cent) or WebSearch, not the full fan-out.
