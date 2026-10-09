---
id: PK-37
title: 'a commit gate: a domain change ships with its glossary line'
status: waiting
assignee: []
created_date: '2026-10-09 11:51'
updated_date: '2026-10-09 13:40'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 10100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
check: FRM-367 (x lane gate) lands
dima, 2026-10-09: «why you missed this drift? if i did not remind you it would drift. how to solve a habit?» — the rule already lived in x:pm (structural tracker change → docs/tracker/GLOSSARY.md or a TRK adr in the same batch) and frame AGENTS.md (a new domain word gets its GLOSSARY.md entry in the same commit); both were loaded and skipped on the Backlog switch. a remembered rule fails; a gate does not.
- the gate: a frame pre-commit check maps staged paths to their context through GLOSSARY-MAP.md; a commit touching a context's contract files (tracker: docs/agents/issue-tracker.md, docs/agents/triage-labels.md, the backlog configs, rules-lazy/linear-flow.md, the x:pm skill) without that context's GLOSSARY.md or adr/ is refused, unless the message carries «glossary: unchanged — <why>»
- the contract-file list per context lives in GLOSSARY-MAP.md, beside the context, so it never drifts from the map
- proven red: one commit of issue-tracker.md alone is refused, the same with the glossary passes
- after it lands: the AGENTS.md and x:pm lines point at the gate instead of asking for memory
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima 10-09: bytes too — its apps carry their own GLOSSARY.md (app-essentials). so the gate is one x verb both repos' lefthook call, the way x linear push already runs in both; each repo's GLOSSARY-MAP.md (bytes needs one) names its contexts and their contract files.

dima 10-09, the same gate family: a commit to a crew-* or guide-* SKILL.md that only grows it is refused unless the message carries «groom: read whole — <what was cut, or why nothing>». his rule: add → review the skill as a whole → groom, never a drop into a pile

grill r1 (dima 16:09, all as recommended): Q1 only explicit contract: lists per context in GLOSSARY-MAP.md trip the glossary half, unlisted = ungated, escape «glossary: unchanged — <why>» · Q2 a crew-*/guide-* .md that gains ≥3 lines and loses 0 is refused, escape «groom: read whole — <what was cut, or why nothing>» · Q3 one verb x lane gate <msg-file> at lefthook commit-msg in frame and bytes, built after #79 (cli 2a touches x lane) merges · Q4 the lane writes bytes' GLOSSARY-MAP.md, contract lists empty, filled per app at its next touch via x:app-essentials. prior art in-house: ftr-gate (plugin-x bin).

critic folds (dima 16:13, all as recommended): C1 a touched context with an empty contract list prints a one-line nudge, never refuses · C2 merge commits skip the gate · C3 bytes fails closed when x is not on PATH, proven red · C4 a skill .md is refused when non-blank additions exceed non-blank removals by ≥3; a new file under a skill dir counts as growth · C5 a listed contract path that no longer exists refuses. lane waits: no new lanes until cli 2a/2b and mods finish (dima 16:13); built after #79 merges

moved to linear 10-09 16:40: FRM-367 (x lane gate), sealed with pk-37 + pk-40 together
<!-- SECTION:NOTES:END -->
