---
dies-when: merge m1 starts with these changes folded into BYT-106, BYT-109, BYT-124 and BYT-125, and the vectors live in a recipe
---

# a monorepo + turborepo run by agents, and the frame → bytes merge

Ticket: BYT-125

Four lanes, 2026-10-05: exa (108 s, $0.10), parallel core (274 s), an opus source lane that read the turbo docs and both repos (450 s), and a blind `advise-project-approach` lane (128 s). The brief and the raw lane output lived in the session scratchpad.

## the verdict — go with changes (4 of 4 lanes)

- **all four lanes say go with changes.** None found a public case of a dotfiles + agent-infra repo merged into an apps monorepo, so the risks below come from docs, bug reports and our own measurements.
- **the order that hurts least**: the native apps first, then the cheap turbo wins, then the shared hooks merged and `mirror` scoped to frame paths, then frame's infra last. Keep the tool picks (bun, oxc) out of the merge, so a breakage has one cause.
- **step 0, from the advisor**: before frame's live layer moves, launchd and `$HOME` should stop pointing into a working tree (a deploy step that copies to a stable path), and git-crypt goes (one file, `gmail/blocklist.json` → 1Password). Proof: clone into a new path and rename the old one; the shell, every launchd job and the cli keep working.

## the top risks, measured

- **lockfile coupling**: every lockfile commit marks all 16 bytes packages affected (`ConservativeRootLockfileChanged`, 4 of 4 recent commits). frame made 26 lockfile commits in 30 days; merged, each would redeploy every app against the Vercel hobby cap of 100 deploys a day. Fix the fallback first (probe turbo 2.11.7 on our two-document lockfile, cause unverified), or keep frame as its own pnpm workspace inside the repo.
- **worktree hazards spread**: frame's pre-push `mirror` job fails in any worktree, and git-crypt breaks fresh worktrees ([claude-code#38538](https://github.com/anthropics/claude-code/issues/38538): commits that deleted every file). Both would reach every bytes coder.
- **the path move**: 217 references in 93 frame files; 47 home symlinks into frame; 5 plists plus their tcc re-grants (inferred: grants look path-keyed); cc's marketplaces, 3 trust keys and 32 `~/.claude/projects` dirs keyed by path.
- **the live system**: with symlinks and launchd pointing into bytes, a branch switch or a broken install in the main checkout changes dima's shell and agents at once (the advisor; chezmoi copies files for this reason).
- **traffic**: frame made 1017 commits in 30 days against bytes' 223, so bytes `main` would carry about 5× the push, ci and review volume; memory edits at the root would count as global deps.
- **cc layering**: `CLAUDE.md` files load from the cwd up, so a root infra `AGENTS.md` loads into every app coder; project `.claude/settings.json` is read from the repo root in a worktree. Keep the root thin, infra in its own dir.

## turborepo — what we have, what to adopt

- **already in use** (the brief was wrong): `--affected` typecheck in ci (`bytes/.github/workflows/ci.yml:149`), remote cache in ci via Vercel OIDC, a pre-push `--filter='...[origin/main]'`, the turborepo agent skill installed.
- **scheduling: none.** No time-based flag in `turbo run`, `turbo watch` reacts to files only; `launchd` stays the clock (3 lanes agree, docs cited).
- **worktree cache sharing** is on since 2.8. It is a pure gain for `typecheck`, `test` and `lint` (no outputs); for `build` a cached output can carry another worktree's absolute path ([publira#1646](https://github.com/publira/publira/pull/1646)). Vercel builds remotely, so the risk is local only.
- **remote cache from worktrees is costly** (117k requests a day at under 1 % hits, [lit-ui-router#926](https://github.com/simshanith/lit-ui-router/pull/926)): keep it ci-only.
- **frame gains little from turbo cache**: `pnpm typecheck` 0.7 s, `pnpm test` 4.3 s; of 74 scripts about 10 are builds, the rest side effects that must never be cached.

## easy wins, by gain per effort

1. `futureFlags.affectedUsingTaskInputs` + `!.claude/**` and `!AGENTS.md` in `build.inputs` — proven in a throwaway clone: the skills-only push that deployed 6 apps selects 0 builds. this is BYT-106's docs filter in about 6 lines.
2. `"agentGuidance": false` before renovate brings turbo 2.11, or the root `AGENTS.md` changes in every worktree.
3. a `description` on every task (8 of 9 lack one) — the turbo ai guide's own advice.
4. `turbo query affected --tasks typecheck,test,lint --base origin/main --exit-code` as the coder's pre-pr gate (0.3 s measured; the gain is inferred).
5. probe turbo 2.11.7 on the two-document lockfile — if the fallback goes, a one-app bump stops redeploying every app.

## not found

- official turbo guidance on nesting `AGENTS.md`
- any real case of this exact merge
