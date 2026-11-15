---
fed-by: incidents
when:
  - { kind: basename, value: habit-dima-comms.md }
---

# comms log — dima's graded comms cases

- the case log of [FRM-630](https://linear.app/x-com/issue/FRM-630): every comms slip or good reply dima grades, with its context, his words and the fix
- the one source is `~/.claude/shelf/comms-log.jsonl` (duckdb); the readable cases render into [the story](fleet-stories/comms-log/story.md) by `node ~/frame/_clio/script/comms-log-render.ts`, run after every case write
- a case holds: what happened, its context (how, why, when, where, who), his grade and words verbatim, the reply shape that hurt, severity (hot · siesta · halt, his word wins), the fix and its home, status
- severity: hot is fixed the turn it lands; siesta at the next pause; halt is the default; the weekly retro turns repeated shapes into reply rules
- the statistics of all talk live in [fleet-operator-comms.md](fleet-operator-comms.md); this file holds the rules, the story the cases
