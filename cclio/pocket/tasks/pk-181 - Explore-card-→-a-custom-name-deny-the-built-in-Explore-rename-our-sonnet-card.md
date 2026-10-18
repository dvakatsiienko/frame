---
id: PK-181
title: >-
  Explore card → a custom name: deny the built-in Explore, rename our sonnet
  card
status: done
assignee: []
created_date: '2026-10-18 13:59'
updated_date: '2026-10-18 16:21'
due_date: '2026-10-19'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 10160
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-18 (inbox Q2, his 🛎️ on o4): is there a way to disable explore fully, so we are not restricted to the Explore.md filename and our card can carry a custom name? docs (code.claude.com/docs/en/sub-agents): `permissions.deny` `Agent(Explore)`, or `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` (drops Explore + Plan, v2.1.198+); then our card ships under its own name. probe: deny it, fresh session, `/agents` no longer lists the built-in, our renamed card answers. a settings change — the permissions block is read byte-for-byte before the merge (sys-settings-drift). name via x:top-seven.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: until the weekly reset (2026-10-19 07:00) — dima 10-18: an xs after the reset

19:16, dima's tick (o41): «disable Explore, a built-in subagent, and remind what other redundant built-ins we can disable». finding: our card home/.claude/agents/explore.md is itself named Explore (it overrides the built-in), so a deny on Agent(Explore) likely blocks ours too — the card gets a new name first (x:top-seven, asked), then CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1 or deny Agent(Explore), in one change; fleet-identity.md + crew-subagent name it. other built-ins: general-purpose (already denied), claude (generic catch-all, deny candidate), Plan (plan mode's own researcher; the env var drops it with Explore), statusline-setup (sline replaced it), claude-code-guide (keep: used today).

19:20 done: card renamed scout (agents/scout.md), CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1, deny Agent(claude) + Agent(statusline-setup) — live in this session (the two left the agent list); surfaces renamed: fleet-identity, crew-subagent, crew-coder, model-cards, budgets, refresh-crew-coordinator; the x-mod-stash badge map + FTR ride the mods coder's P1 push; scout's emoji is dima's pick (orbit).
<!-- SECTION:NOTES:END -->
