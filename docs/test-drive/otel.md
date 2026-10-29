---
status: live
until: 2026-11-03
dies-when: the verdict line below is written
---

# otel — Claude Code's OpenTelemetry export into a local tap, read with duckdb

Ticket: none

born 2026-10-16 on dima's tick (o5). the tap: `schedule/jobs/x-cc-otel/` (127.0.0.1:4318, OTLP http/json → `~/.local/share/x-cc-otel/YYYY-MM-DD.jsonl`); turned on by the `CLAUDE_CODE_ENABLE_TELEMETRY` + `OTEL_*` lines in `home/.claude/settings.json` env (tool details and dima's prompts logged, local only). the proposal: `_clio/.scratch/otel/proposal.md`.

**test card:** we believe the export gives the fleet numbers transcripts cannot (cost, active time, cache hits, guard decisions per member) with no parsing code of ours · we test it by answering real asks from it: the cclio bench (PK-159), a member measure, the operator-comms recipe, a siesta's cost line · we measure seconds and lines of query per answer against the same answer read off transcripts (`x fleet audit`, helper-lite jq), disk per day, and gaps (sessions missing from the tap) · we're right if 3 real asks get answered from it faster than from transcripts, every live session shows up, and disk stays under ~50 MB a week

**kill rule:** sessions missing from the tap two days running, or a data volume that slows a session

**the timeline:** day 0 proves the pipe (10-16) · day 7 the first real read, enough for a weekly shape across lanes, siestas and idle days (10-23) · day 14 the verdict (10-30)

## stress list
- `claude_code.cost.usage` — the cost of one lane and one siesta — USD per session vs the ccusage-style transcript sum
- `claude_code.active_time.total` — dima's hands-on time per day (operator-comms) — hours vs prompt timestamps
- `api_request` events — cache hit rate per member (spawn-or-reuse grid) — read/write tokens vs the halt's spawn-base measure
- `tool_decision` events (`classifier_verdict`, `permission_mode`, `classifier_category`, 2.1.301+) — guard refusals per hour — count vs the x-mod-guard log
- `user_prompt` events — his prompt count, length and gaps per hour — vs the operator-comms recipe's transcript read
- `lines_of_code.count`, commit and pr counts — a coder lane's output — vs `git log --stat`
- `OTEL_RESOURCE_ATTRIBUTES` per spawn (`fleet.role`, `fleet.lane`) — one query split by member — the first tagged spawn
- untried: traces (beta), the Max-plan question (day 0 answers it)

## rounds

- 2026-10-16 · day 0: one `claude -p --model haiku` session in a temp dir · 3 exports at session end, 0.1 s apart (2 logs, 1 metrics), 78 KB · metrics: session.count, cost.usage, token.usage, active_time.total — **works on the Max plan** · events: managed_settings_resolved, ~20 hook_registered, hook_execution_complete, mcp_server_connection · 📌 the hook events dominate a tiny session's bytes; a real day's size is the day-7 read · pipe proven

## verdict
