---
id: PK-187
title: >-
  scout sharpen — the card asks real-vs-near-miss per hit, the clean negative
  space, quoted lines; coders reach for it on a sibling sweep
status: done
assignee: []
created_date: '2026-10-18 16:57'
updated_date: '2026-10-19 13:35'
due_date: '2026-10-19'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10900
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-18: «let's sharpen our Scout subagent and find more ways to encourage fleet and coders, especially, to use Scout subagent more proactively». the mods coder's retro (one run 10-18: a «medium» sweep for writes that drop a steer, 31 s, 25.6k tokens, 9 calls, 2 hits + the clean list; one hit real — absorbMarks register.tsx:1013 — one noise):
- weaker than rg: it can't weigh UI consequence; a one-file one-symbol lookup is cheaper as a direct rg (~12k floor a spawn). stronger: an «every writer of X» semantic sweep across 6k-line files
- card lines (home/.claude/agents/scout.md): «for each hit, say real instance or near-miss, and why»; «end with the negative space: what you checked and found clean» (the most useful part, given unasked); «quote the one line, never paraphrase code»
- reach-for-it: an x:crew-coder line under «while you build»: «after a fix, send scout one sweep for siblings of the bug's pattern before final»; an x-mod-guard hint on a 3rd consecutive rg/grep over one dir in one turn: «a sweep like this is scout's — one Agent call»
- open: the same nudge for cclio and the other members (x:crew-subagent § when to delegate names scout?); the card edit is a plugin/agent change, the guard hint rides the mods lane
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
10-19: shaped (cclio/.scratch/shape-scout/: research, neuroarxiv, plan critic, read ceiling). landed: scout card re-aimed (proactive trigger, a line-range map with hit/near-miss, clean ≠ proof, cut marker, sonnet low, LSP); x:crew-coder «finding before reading»; root CLAUDE.md scout line; crew-lead references/card-craft.md + refresh-crew-coordinator vectors. left: the Haiku vs Sonnet race and the pass line ride the next mods or cli coder lane; the 3rd-search hint stays in PK-148.
<!-- SECTION:NOTES:END -->
