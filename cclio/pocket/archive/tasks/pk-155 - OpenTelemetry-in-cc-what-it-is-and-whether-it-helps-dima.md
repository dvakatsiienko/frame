---
id: PK-155
title: 'OpenTelemetry in cc: what it is and whether it helps dima'
status: done
assignee: []
created_date: '2026-10-16 10:24'
updated_date: '2026-10-16 11:12'
due_date: '2026-10-16'
labels:
  - xs
dependencies: []
priority: next
type: question
ordinal: 10103
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-16, Q: what is OpenTelemetry in cc — does it send usage data to anthropic, or let dima gather data about cclio and his own usage himself? can it be useful? relates: the cclio bench wish.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
answered 10-16 (claude-code-guide, Haiku 5.5, from code.claude.com/docs/en/monitoring-usage.md, tail of the page unread): opt-in (CLAUDE_CODE_ENABLE_TELEMETRY=1), exports only to an endpoint you set (console, otlp collector, prometheus :9464) — never to anthropic per the page. prompts and tool details off by default (OTEL_LOG_USER_PROMPTS, OTEL_LOG_TOOL_DETAILS). adds over transcripts: cost.usage, active_time.total, lines_of_code, commit/pr counts, tool_decision events. Max-plan support unstated: probe with OTEL_METRICS_EXPORTER=console. useful as a cclio-bench input (PK-159).

update 10-16: the tap shipped (o5): x-cc-otel on :4318, prompts + tool details ON by dima's tick, Max plan proven by day 0 (session.count arrived). the trial: docs/test-drive/otel.md.
<!-- SECTION:NOTES:END -->
