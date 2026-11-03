---
id: PK-305
title: 'agent_summary cost: verify desktop cc ≥2.1.311, then measure our share'
status: open
assignee: []
created_date: '2026-11-03T08:57:00Z'
updated_date: '2026-11-03T09:00:00Z'
labels:
  - s
  - side
dependencies: []
priority: next
type: task
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-11-03 (side channel): yes, park the measure of how much agent_summary (cc's 30 s status-line summary of each working background agent) costs our fleet.
W1 (2026-11-03 10:56, dima) if the claim from the video is true and the unnecessary usage is also present in this surface, then i'd like to optimize it. propose how, if it is possible. if not, let's just drop it.
W2 (2026-11-03 10:32, dima) forks are useful — a trick that disables forks is not wanted.
facts (side channel, read from the binaries): desktop bundles cc 2.1.309, cli 2.1.317; anthropic's cache-miss fix shipped in 2.1.311+ (HN 50284699); no supported off switch; CLAUDE_CODE_FORK_SUBAGENT=0 kills forks; we set it to 1 in ~/.claude/settings.json.
steps: 1. once the desktop app bundles cc ≥2.1.311, check ~/Library/Application Support/Claude/claude-code/. 2. measure agent_summary's share over one day (OTel to a local file, or a debug-log count of [AgentSummary] calls). 3. under ~5 % → close; over → re-look at the short mode.
upstream: https://github.com/anthropics/claude-code/issues/105981 (watch: main's call)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-03 11:00, dima: off-switch idea dropped (fork env var, bun preload); only the desktop update door + the measure stay.
<!-- SECTION:NOTES:END -->
