---
id: PK-2
title: '[10] plan the memory sweep'
status: open
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-09 12:16'
labels:
  - l
dependencies: []
references:
  - .scratch/memory-sweep/spec.md
priority: next
type: task
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 10 · status line was: `open · task` · [FRM-267](https://linear.app/x-com/issue/FRM-267) · blocked by 09

sweep inputs added 10-07 (dima):
- **one name per family of files**: a recipe, its script and its shelf file share one stem (`refresh-agent-ops` ↔ `agent-ops:report` ↔ `docs/knowledge/agent-ops.md`); decide the owner of the contract (the recipe `_spec.md`, a shape-recipe skill, or an `x` check) — «everything drifts too much»
- **fold the scattered findings**: inventory `docs/research`, `docs/knowledge`, `docs/test-drive`, the recipes and the cw leaves; each finding gets one verdict: shelf, recipe, memory line, guard, or dies
- **the boot weight**: dima measured 117k at boot (memory files 81.2k) and 188k after init (+51.8k message); «is everything you preload truly useful?»
- **the usage door**: `mcp__ccd_session_mgmt__get_usage` reads plan limits + this session's context without sline (a desktop-born session has no statusline feed)
- **recipes are processes, not only research** (dima 10-07: «our recipes becomes upgraded from pure research-type to kinda process-ones … plain research only, or pre-research + followup operations … we will revamp recipes there») — `_spec.md`'s «maintenance run or execution script» split goes; a recipe may be research only, or research + follow-up operations (`refresh-agent-ops`' doors vector is the first)
first quick win (dima 10-07, yes): `_reminders.md` is 24 kB imported every turn, 29 of 41 lines are test-drive verdicts copied three times — verdict dates live only in each test-drive file, the boot prints the ones due in 2 days, reminders keep real date/condition hooks only.

dima 10-07: `_hq/memory-sweep.md` holds his corrections. plan the steps first, broken into tasks, folded and ordered; then checkpoint or sweep by context size. think what goes to choress or cloud. the first real spec for the pocket.

planned 10-07: `.scratch/memory-sweep/` — the spec + nine phase tickets (01 baseline + audit → 09 global review); the grill log in `docs/test-drive/memory-sweep.md`. next: a fresh session runs 01.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
sweep exit test (from pk-31, 10-09): one door for memory edits — today the guidance lives in rules/authoring-trigger.md, habit-memory-edits, matt's writing-for-agents, and the pocket/leaf rules in cclio memory.

sweep inventory (dima, 10-09): re-check all 10 frame ADRs (docs/adr + docs/tracker/adr) against reality, each kept, amended or superseded.

dima 10-09: today's forced grooms (crew-dna pk-38, crew-coder pk-25) are emergency cuts because the skills bleed; the sweep still reviews and re-grooms them
<!-- SECTION:NOTES:END -->
