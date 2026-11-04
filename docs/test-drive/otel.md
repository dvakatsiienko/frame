---
status: adopted
until: 2026-11-04
dies-when: the verdict line below is written
---

# otel — Claude Code's OpenTelemetry export into a local tap, read with duckdb

Ticket: none

born 2026-10-16 on dima's tick (o5). the tap: `schedule/jobs/x-cc-otel/` (127.0.0.1:4318, OTLP http/json → `~/.local/share/x-cc-otel/YYYY-MM-DD.jsonl`); turned on by the `CLAUDE_CODE_ENABLE_TELEMETRY` + `OTEL_*` lines in `home/.claude/settings.json` env (tool details and dima's prompts logged, local only). the proposal: `_clio/.scratch/otel/proposal.md`.

**test card:** we believe the export gives the fleet numbers transcripts cannot (cost, active time, cache hits, guard decisions per member) with no parsing code of ours · we test it by answering real asks from it: the clio bench (PK-159), a member measure, the operator-comms recipe, a siesta's cost line · we measure seconds and lines of query per answer against the same answer read off transcripts (`x fleet audit`, helper-lite jq), disk per day, and gaps (sessions missing from the tap) · we're right if 3 real asks get answered from it faster than from transcripts, every live session shows up, and disk stays under ~50 MB a week

**kill rule:** sessions missing from the tap two days running, or a data volume that slows a session

**the timeline:** day 0 proves the pipe (10-16) · day 7 the first real read, enough for a weekly shape across lanes, siestas and idle days (10-23) · day 14 the verdict (10-30)

## stress list
- `claude_code.cost.usage` — the cost of one lane and one siesta — USD per session vs the ccusage-style transcript sum
- `claude_code.active_time.total` — dima's hands-on time per day (operator-comms) — hours vs prompt timestamps
- `api_request` events — cache hit rate per member (spawn-or-reuse grid) — read/write tokens vs the halt's spawn-base measure
- `tool_decision` events (`classifier_verdict`, `permission_mode`, `classifier_category`, 2.1.301+) — guard refusals per hour — count vs the x-mod-guard log
- `user_prompt` events — his prompt count, length and gaps per hour — vs the operator-comms recipe's transcript read
- `lines_of_code.count`, commit and pr counts — a codie lane's output — vs `git log --stat`
- `OTEL_RESOURCE_ATTRIBUTES` per spawn (`fleet.role`, `fleet.lane`) — one query split by member — the first tagged spawn
- untried: traces (beta), the Max-plan question (day 0 answers it)

## rounds

- 2026-10-16 · day 0: one `claude -p --model haiku` session in a temp dir · 3 exports at session end, 0.1 s apart (2 logs, 1 metrics), 78 KB · metrics: session.count, cost.usage, token.usage, active_time.total — **works on the Max plan** · events: managed_settings_resolved, ~20 hook_registered, hook_execution_complete, mcp_server_connection · 📌 the hook events dominate a tiny session's bytes; a real day's size is the day-7 read · pipe proven
- 2026-11-04 · first real read, 19 days late · ask: the cost of each session today · 0.9 s over 74 MB, one script · `claude_code.cost.usage` is delta, summed: $304.97 api-equivalent, clio $138.32, the mods codie $75.05, the side channel $49.13, crow $15.85 · coverage: 32 of 33 of today's transcripts; the miss is a probe run with `--setting-sources project,local`, which drops the env by design · **disk: 974 MB in 19 days**, 49 / 103 / 135 / 74 MB on the last four days, so about 700 MB a week against the ~50 MB bar · hook start and complete events are 35 MB of today's 74 · real asks answered so far: 1 of 3 · no prune exists · grade: the query beats a transcript sum by a wide margin, the disk misses its bar 14×
- 2026-11-04 · zipped one day: 135 MB → 7 MB, about 19×, so ~50 MB a week; duckdb read a `.jsonl.gz` day whole (144 of 144 lines) · the tap now zips each finished day and deletes past cc's `cleanupPeriodDays`, read live; `hook-health.sh` reads both shapes
- 2026-11-04 · the live store zipped by hand ahead of the merge: 19 finished days, about 905 MB → 48 MB, each passing `gzip -t` and a line count, duckdb 7,237 of 7,237 on the biggest; the plain copies went to the trash

## verdict
- 2026-11-04 · **adopted** on dima's word: «keep otel», cleaned on the transcripts' own 90 days («sync autoclean 90 days with transcripts autoclean»): the fleet has no other flat log of cost, timing and decisions · 1 of the card's 3 real asks answered; his word carries it
