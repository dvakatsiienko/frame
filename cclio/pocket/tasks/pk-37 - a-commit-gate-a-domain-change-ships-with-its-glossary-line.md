---
id: PK-37
title: 'a commit gate: a domain change ships with its glossary line'
status: open
assignee: []
created_date: '2026-10-09 11:51'
updated_date: '2026-10-09 11:53'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 10100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-09: «why you missed this drift? if i did not remind you it would drift. how to solve a habit?» — the rule already lived in x:pm (structural tracker change → docs/tracker/GLOSSARY.md or a TRK adr in the same batch) and frame AGENTS.md (a new domain word gets its GLOSSARY.md entry in the same commit); both were loaded and skipped on the Backlog switch. a remembered rule fails; a gate does not.
- the gate: a frame pre-commit check maps staged paths to their context through GLOSSARY-MAP.md; a commit touching a context's contract files (tracker: docs/agents/issue-tracker.md, docs/agents/triage-labels.md, the backlog configs, rules-lazy/linear-flow.md, the x:pm skill) without that context's GLOSSARY.md or adr/ is refused, unless the message carries «glossary: unchanged — <why>»
- the contract-file list per context lives in GLOSSARY-MAP.md, beside the context, so it never drifts from the map
- proven red: one commit of issue-tracker.md alone is refused, the same with the glossary passes
- after it lands: the AGENTS.md and x:pm lines point at the gate instead of asking for memory
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima 10-09: bytes too — its apps carry their own GLOSSARY.md (app-essentials). so the gate is one x verb both repos' lefthook call, the way x linear push already runs in both; each repo's GLOSSARY-MAP.md (bytes needs one) names its contexts and their contract files.
<!-- SECTION:NOTES:END -->
