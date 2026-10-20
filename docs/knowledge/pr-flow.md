---
fed-by: recipe refresh-pr-flow
when:
  - { kind: command, value: gh pr }
  - { kind: command, value: x lane pr-open }
  - { kind: skill, value: x:crew-coder }
---

# pr-flow — how a change travels from a coder's branch to main

## core

📌 seeded 2026-10-20, before the recipe's first run; its distill fills this from the two research docs below and the run's lanes.

- the merge gate: a pr on no risky path merges once the verifier is clean on its head, checks ran green for that head and no thread is open; a risky path waits for dima's look — [FRM-401](https://linear.app/x-com/issue/FRM-401) holds the rule and the path list
- stacked prs: not in use; github native stacks (`gh stack`) and graphite are the two candidates — [BYT-98](https://linear.app/x-com/issue/BYT-98)
- the sources the first run starts from: `docs/research/graphite-and-stacked-prs.md`, `docs/research/code-review-human-gate.md`
