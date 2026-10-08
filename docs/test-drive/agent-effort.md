---
dies-when: the verdict line below is written (2026-10-15)
---

Ticket: none

# per-call effort on one-off subagents — does `high` pay over `medium`?

the `Agent` tool takes `effort` per call since cc 2.1.292; the harness lets cclio pass it only where a
memory line names the effort — `craft-spawning`'s 🎚️ line (dima's yes, 2026-10-08). a one-off
`general-purpose` agent otherwise inherits the session's effort.

## stress list

- the same 3 one-off asks run twice, `medium` and `high`, on fresh `general-purpose` agents:
  - a lookup with one right answer (a cc docs fact, checkable by a grep)
  - a cross-file diagnosis (why a guard fired, read from the hook and the log)
  - a source-reading research question (one doc + one repo)
- each round records: seconds, total tokens (the agent's usage line), hit or miss against a known answer,
  and what `high` found that `medium` missed
- `low` is out: medium is the baseline (dima, 2026-10-01)

## rounds

(none yet)
