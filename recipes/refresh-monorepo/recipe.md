---
kind: refresh
cadence: at every turbo minor, before each merge milestone starts (m1 on 2026-10-08), or when dima asks
artifacts:
  - docs/research/monorepo-agents.md
  - cclio/memory/_reminders.md
script: none
---

# refresh-monorepo — recipe

Keeps the fleet's monorepo craft current: how bytes (pnpm + turborepo) is run by agents, what to do and what never to do, and how the frame → bytes merge proceeds. Born 2026-10-05. The cookbook it keeps fresh is `docs/research/monorepo-agents.md` (do / don't / easy wins).

## the want (dima's)

> how to use monorepo/turborepo efficiently with agents? power usage recipes, tips and tricks, best practices? pitfalls? things NOT to do? easy things todo to to get most gains? (2026-10-05)

> and this research would also allow to answer a frame→bytes merge questions — should we do it? how to correctly research this? (2026-10-05)

> we use turborepo — why don't we exploit it? … it's actually an orchestration tool! Why don't you befriend turborepo? (the big prompt, T5)

> plan bytes merge in a way, so it is gradual, mixed between our lanes, part by part and not folded into a long shelf (2026-10-05)

his standing calls: turbo's want is a + b (the task graph and cache for gates; fleet scripts as a graph), the clock stays `launchd`; the merge is incremental, one slice per lane; bun and oxc stay out of the merge.

## the run

1. **research** — one brief from the vectors; `pnpm research:lanes <brief> <out>` + an opus source lane (turbo docs + both repos, measured) + a blind `advise-project-approach` lane for the merge
2. **distill** — merge into `docs/research/monorepo-agents.md`; raw lane output dies here
3. **eval + findings** — print dima the delta: new wins, new don'ts, a moved merge order; grade the lanes in `docs/test-drive/{exa,parallel}.md`
4. **resolve** — with dima; each win becomes a merge slice or a line on its ticket; noop is fine

## vectors

### research vectors (re-groom each run)

1. **power usage** — turbo with coding agents: task graphs as agent gates, `--affected` / `turbo query affected`, local and remote cache, `turbo watch`, boundaries, generators, `futureFlags`, task `description`s, the turbo ai guide and its agent skill
2. **pitfalls and don'ts** — cache poisoning, env vars outside the hash, worktrees sharing a cache (absolute paths in outputs), remote cache from worktrees, lockfile churn marking everything affected, context bloat
3. **easy wins** — the few changes with the most gain per effort, ranked
4. **scheduling** — re-check each turbo minor: still no time-based runs?
5. **the merge** — real cases of a dotfiles or agent-infra repo folded into an apps monorepo; what breaks; the least-pain order
6. **agent layout** — nested `AGENTS.md` / `CLAUDE.md` loading, settings scoping in worktrees, per-task context, gates only for what a coder touched

### analysis vectors (local evidence)

1. `turbo.jsonc` + root scripts in bytes against the cookbook — every easy win applied or named as open
2. the lockfile fallback — `turbo query affected` on the last lockfile commits: still all packages?
3. the merge's path blast radius — `rg -l '/Users/dima/frame|~/frame|\$HOME/frame'`, the home symlinks, the plists, cc's path-keyed state; the count per run
4. worktree health — does a fresh bytes worktree pass its gates with frame's hooks merged in
5. turbo version vs latest, and what the next minor changes (`agentGuidance` writes into `AGENTS.md`)

## artifacts (pointed at, never housed here)

- `docs/research/monorepo-agents.md` — the cookbook: verdict, risks, do / don't / easy wins
- [BYT-125](https://linear.app/x-com/issue/BYT-125) turborepo · [BYT-106](https://linear.app/x-com/issue/BYT-106) the docs filter · the monorepo milestones m1–m4 ([BYT-109](https://linear.app/x-com/issue/BYT-109), [BYT-124](https://linear.app/x-com/issue/BYT-124))
- the ⏰📌 «one merge slice per lane» reminder in `memory/_reminders.md`

## cadence

at every turbo minor, before each merge milestone starts (m1 on 2026-10-08), or when dima asks.

## log → log.md
