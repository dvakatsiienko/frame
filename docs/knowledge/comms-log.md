---
fed-by: incidents
when:
  - { kind: basename, value: habit-dima-comms.md }
---

# comms log — dima's graded comms cases

- the case log of [FRM-630](https://linear.app/x-com/issue/FRM-630): every comms slip or good reply dima grades, with its context, his words and the fix
- the one source is `~/.claude/shelf/comms-log.jsonl` (duckdb); the readable cases render into [the story](fleet-stories/comms-log/story.md) by `node ~/frame/_clio/script/comms-log-render.ts`, run after every case write
- a case comes only from dima, who points at a message and says what did not land and why; the thumbs up/down are a later step of annotate (dima, 2026-11-25: «comms-log is filled only on my request - manual or from herdr ui thumbs up/down feature»)
- a case holds: the reply's own text, what happened, its context (how, why, when, where, who), his grade and words verbatim, the reply shape that hurt, severity (hot · siesta · halt, his word wins), the fix and its home, status
- severity: hot is fixed the turn it lands; siesta at the next pause; halt is the default; the weekly retro turns repeated shapes into reply rules
- the statistics of all talk live in [fleet-operator-comms.md](fleet-operator-comms.md); this file holds the rules, the story the cases
