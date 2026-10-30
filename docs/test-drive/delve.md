---
status: live
until: 2026-11-01
fits: codie:go
blind: true
---

# delve — the go debugger (`dlv`), for a red test whose cause is not in the diff

Ticket: none

on trial since 2026-10-06 (`brew "delve"`); `x:guide-go` and `x/AGENTS.md` teach it to every Go codie.

## what counts

dima, 2026-10-13: a tool used is not a tool proven useful. the next cli codie's brief says nothing about delve; he codes as usual. at his retro (at done, or before a 🐦‍🔥 second wind) clio asks whether he reached for delve and whether it helped, and a helper-lite counts his `dlv` calls in the transcript.

## rounds

- 2026-10-13 · baseline: 15 fleet transcripts ran `dlv` (rg over `~/.claude/projects`, newest 10-12); usefulness unrecorded
- 2026-10-22 · [FRM-401](https://linear.app/x-com/issue/FRM-401) + [FRM-403](https://linear.app/x-com/issue/FRM-403) cli coder · 0 `dlv` runs, not reached for · one red whose cause sat outside the diff (a test fixture's push died on dima's global `pushInsteadOf` https → ssh); the test's own failure output named it in one read, so delve had nothing to add — every other red was in the diff
