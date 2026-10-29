---
kind: refresh
owner: [coder, coordinator]
artifacts:
  - docs/knowledge/monorepo.md
  - ~/projects/bytes/AGENTS.md
script: none
groomed: 2026-10-13 (dima)
was: [refresh-branch-monorepo]
---

# refresh-monorepo

keeps the fleet operating a monorepo efficiently with agents: the baseline every bytes coder reads, the expanded monorepo knowledge, and the wins that land each run, sharpened against turborepo. born 2026-10-05.

## the want

> i want the fleet to operate a monorepo efficiently and use most features of the monorepo and turborepo to get the most gains. i think turborepo scripts and workflows can be especially useful to you, because you are a coordinator — my inference; we'll see more closely as we get to the monorepo. (2026-10-13)

> this recipe is only for improving your overall knowledge of efficient monorepo operations with agents. sharpen it against turborepo, because we use it. (2026-10-13)

> since we plan the move to bytes and your folder will most likely migrate there, everyone should have a baseline knowledge of how to operate a monorepo efficiently with agents: that goes in the agents doc, the expanded part in the knowledge folder. we refine how much it holds as we move closer to bytes. (2026-10-13)

> refresh incrementally, as we find new best practices and tips and tricks. (2026-10-13)

> how to use a monorepo and turborepo efficiently with agents? power-usage recipes, tips and tricks, best practices? pitfalls? things NOT to do? easy things to do for the most gain? (2026-10-05)

> we use turborepo — why don't we exploit it? … it's actually an orchestration tool! why don't you befriend turborepo? (the big prompt, T5, ~2026-10-01)

his standing calls: turbo's want is a + b (the task graph and cache for gates; fleet scripts as a graph), the clock stays `launchd`.

## the run

- a run's gains never stay parked: each small win lands in the run itself; a bigger one becomes a dated pocket item, never only a ticket line; the print names what landed
- each bytes coder lane proposes this recipe's vector changes at its end (the coder seat)
- suggest a run when: a turbo minor ships

1. **shape**: `clio:shape-recipe` step 0, the grill. done: his word on the round. (open)
2. **research** — the brief from `pnpm recipe:brief refresh-monorepo`; `pnpm research:lanes <brief> <out>` + an opus source lane (turbo docs + bytes, measured). done: every lane returned or marked failed. (script)
3. **distill** — the baseline into bytes' `AGENTS.md` (short, every coder reads it), the rest into `docs/knowledge/monorepo.md`; raw lane output stays in `last/` until the next run's distill. done: both read and touched, or named «unchanged». (open)
4. **land** — every small win done in the run; the rest dated pocket items. done: each win landed or dated. (open)
5. **findings** — the print, naming what landed. done: printed. (template)
6. **log** today's line in `log.md`. done: the line is there. (open)

## vectors

### research

1. **efficient agentic monorepo use** — how teams run a pnpm + turborepo monorepo with coding agents: what works, the measured gains, the agent loop
2. **the coder's loop** — what a coder runs before a commit or a pr in a turbo monorepo: affected gates, `turbo query affected`, caching across worktrees
3. **turborepo for a coordinator** — turbo scripts and workflows as an orchestration layer for fleet jobs (dima's inference, tested here): task graphs, `turbo watch`, generators, tags
4. **power usage** — task graphs as agent gates, local and remote cache, boundaries, `futureFlags`, task `description`s, the turbo ai guide and its agent skill
5. **pitfalls and don'ts** — cache poisoning, env vars outside the hash, worktrees sharing a cache (absolute paths in outputs), lockfile churn marking everything affected, context bloat
6. **easy wins** — the few changes with the most gain per effort, ranked
7. **scheduling** — re-check each turbo minor: still no time-based runs?
8. **agent layout** — settings scoping in worktrees, per-task context, gates only for what a coder touched

### analysis

1. `turbo.jsonc` + root scripts in bytes against the knowledge file — every easy win applied or named as open
2. the lockfile fallback — `turbo query affected` on the last lockfile commits: still all packages?
3. worktree health — does a fresh bytes worktree pass its gates today
4. turbo version vs latest, and what the next minor changes
5. what tripped bytes coders since the last run — the flawlog's bytes lines and the coder retros

### cut

- nested `AGENTS.md` loading — answered by the 10-12 probe (its notes sit in frame's gitignored scratch, research/nested-agents-hunt.md)

## artifacts

- `~/projects/bytes/AGENTS.md` — § «operating this monorepo with agents»: the baseline every bytes coder loads; short, the distill adds or cuts lines there only
- `docs/knowledge/monorepo.md` — the expanded reference (core first, then what we have, then the next bump); its open wins sit in [BYT-125](https://linear.app/x-com/issue/BYT-125)

## findings

- print dima the delta: new wins, new don'ts, what landed this run
