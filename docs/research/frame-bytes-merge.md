---
dies-when: BYT-124 folds it into its milestones, or m4 closes
---

# the frame → bytes merge — the 2026-10-05 research

Ticket: BYT-124

four lanes, 2026-10-05: exa, parallel core, an opus source lane over both repos, a blind `advise-project-approach` lane. frozen: no recipe refreshes it.


- **the verdict, 4 of 4 lanes: go with changes.** no public case of a dotfiles + agent-infra repo merged into an apps monorepo was found.
- **the order that hurts least**: the native apps first, then the cheap turbo wins, then the shared hooks merged and `mirror` scoped to frame paths, then frame's infra last; bun and oxc stay out of it.
- **step 0, from the advisor**: launchd and `$HOME` stop pointing into a working tree (a deploy step that copies to a stable path), and git-crypt goes. proof: clone into a new path and rename the old one; the shell, every launchd job and the cli keep working.
- **lockfile coupling**: frame made 26 lockfile commits in 30 days; merged, each would redeploy every app against the Vercel hobby cap of 100 deploys a day, unless the fallback is fixed or frame stays its own pnpm workspace.
- **worktree hazards spread**: frame's pre-push `mirror` job fails in any worktree, and git-crypt breaks fresh worktrees ([claude-code#38538](https://github.com/anthropics/claude-code/issues/38538)).
- **the path move**: 217 references in 93 frame files; 47 home symlinks; 5 plists plus their tcc re-grants (inferred: path-keyed); cc's marketplaces, 3 trust keys and 32 `~/.claude/projects` dirs keyed by path.
- **the live system**: with symlinks and launchd pointing into bytes, a branch switch or a broken install in the main checkout changes dima's shell and agents at once.
- **traffic**: frame made 1017 commits in 30 days against bytes' 223; memory edits at the root would count as global deps.
- **cc layering**: a root infra `AGENTS.md` loads into every app coder; keep the root thin, infra in its own dir.
