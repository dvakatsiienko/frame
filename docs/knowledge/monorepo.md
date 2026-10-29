---
fed-by: recipe refresh-monorepo
when:
  - { kind: basename, value: turbo.jsonc }
  - { kind: basename, value: pnpm-workspace.yaml }
  - { kind: command, value: turbo }
---

# monorepo — operating bytes with agents, pnpm + turborepo

📌 parked shape (dima, 2026-10-13): most work still happens in frame, so how much lives here gets refined as the fleet moves closer to bytes. the baseline every bytes codie needs sits in bytes' `AGENTS.md`; this file is the expanded reference.

## core

- **gate only what you touched**: `turbo query affected --tasks typecheck,test,lint --base origin/main --exit-code` answers which gates a change needs (0.3 s); `turbo run <task> --affected` runs them. a shallow clone makes everything affected, so the base needs its history.
- **a lockfile commit marks everything**: 5 of 5 recent lockfile commits selected 16 of 16 packages and 15 of 15 builds (2026-10-13, turbo 2.10.13), reason `LockfileChanged` even on `@workspace/typescript-config`, which has no dependencies; the cause is unverified (the lockfile is two YAML documents). a dependency bump is a deploy of every app.
- **`turbo.jsonc`, `.npmrc` and `pnpm-workspace.yaml` are global**: a commit touching one selects every task, so it redeploys all 8 buildable apps.
- **docs never deploy**: `affectedUsingTaskInputs` + `!.claude/**`, `!AGENTS.md`, `!CLAUDE.md`, `!**/README.md` in `build.inputs` keep a memory-only push from building anything.
- **worktrees share the local cache** (since 2.8): a pure gain for `typecheck`, `test` and `lint`, which have no outputs; a `build` hit can carry another checkout's absolute path ([turborepo#13651](https://github.com/vercel/turborepo/issues/13651)).
- **env outside the hash gives wrong hits**: a variable a task needs is named in `globalPassThroughEnv` (declaring that list strips every other one); no loose env mode.
- **scheduling is not turbo's**: `turbo watch` reacts to files only, `launchd` stays the clock.
- **read the turbo skill for the version we run**: `bytes/.agents/skills/turborepo`; from 2.11.5 turbo ships matched docs in `node_modules/turbo/docs`.

## what we have

- turbo 2.10.13 pinned; 2.11.7 (2026-10-02) is the latest stable, 2.11.8 canary only. renovate's «minors» group has opened nothing since 2026-09-25 (PK-116).
- in use: `--affected` typecheck in ci (`bytes/.github/workflows/ci.yml:152`), the remote cache in ci via Vercel OIDC (free on every Vercel plan within fair use, hobby 100 GB a month), a pre-push `--filter='...[origin/main]'`, a `description` on all 9 tasks (2026-10-13).
- remote cache stays ci-only: from worktrees it costs (117k requests a day at under 1 % hits, [lit-ui-router#926](https://github.com/simshanith/lit-ui-router/pull/926)).
- a signed remote cache is integrity, not trust: `remoteCache.signature` with a 32-byte key (`futureFlags.longerSignatureKey`), and only trusted jobs write.

## at the 2.11 bump

- `"agentGuidance": false` in the bump's own commit (dima, 2026-10-13): on by default since 2.11.5 it writes a managed block into the root `AGENTS.md`, and an opt-out later leaves the block ([ai guide](https://turborepo.dev/docs/guides/ai)).
- 2.11.3 widens the root: a change in a workspace package the root `package.json` depends on (`biome-config-polished`, `prettier-config-polished`) marks every task affected ([turborepo#14156](https://github.com/vercel/turborepo/pull/14156)); read from the pr, not probed.
- probe in a throwaway clone first: a lockfile commit (does the spread shrink?) and a `biome-config-polished` edit (does every app deploy?).
- refresh the turborepo skill so it routes to the bundled docs; ours is a `2.11.3-canary.2` snapshot.
- `turbo query` output is pure JSON on 2.11.4+; 2.11.6 task `tags` could name the gate tasks once (untried).

open wins live in [BYT-125](https://linear.app/x-com/issue/BYT-125).
