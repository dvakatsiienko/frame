---
date: 2026-09-21
slug: the-stale-gate-and-three-reds
tickets: [DOT-237, DOT-232, BYT-41, BYT-75, BYT-95]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the stale gate and three reds — a parked process, a cached link, and cw boots whole

## shipped

- **the dead memory barrel had a cause**: AGENTS.md reading sits behind a feature gate evaluated once per process, and the coordinator session had run since 09-20 across `/clear`s; a restart loaded all 19 leaves. the boot hook now prints the process age and probes the file chain in a fresh `claude -p` (`BOOT_PROBE` guards its own recursion)
- **the memory bridge's two cw bugs are closed**: `compact()` dropped every numbered block (fleet-identity's invariants never reached cw), and `cclio_mode` returned 156k chars in one result. pages now: even, ≤20k, cut on section edges, byte-identical when joined — proven from a cw thread, nine pages inline, `d03f3da` named from memory
- **evergreen's first monday with the apps lane** ([DOT-232](https://linear.app/x-com/issue/DOT-232)): react 19.3 + 23 minors merged (bytes #91), dotenv 18 held into [BYT-41](https://linear.app/x-com/issue/BYT-41) (preloading removed, the `op run` move replaces it), bartender 7.0.4 the one app with news, skills + plugins lanes run, markers advanced
- **three production apps red after the merge, green by evening**: a second `@types/react` (via prisma studio → `@visx/event`) met the new one in 40 files of `React.X`; one `overrides` block pins the copy; vercel's restored `node_modules` then kept the stale link and needed cache-less builds from the repo root. the gate finding sits on [BYT-95](https://linear.app/x-com/issue/BYT-95)
- **raycast window management, session A done** ([DOT-237](https://linear.app/x-com/issue/DOT-237)): 20 commands kept on the `^⌥` family, the rest disabled, rows with `since` in `hotkeys/manual.ts`
- the 09-20 flush landed (declarative-tool imports, git-crypt worktrees, the typecheck and conflicted-pr greens); the halt prunes the flowlog before the CST; evergreen prints nothing silent and fires its fork during the boot

## tricks gained

- a `/clear` reloads memory files, never the runtime — a cc update, a plugin bump or a feature gate needs a restart
- `Deploy · success` on github is the deploy-hook trigger; the build's state lives only in `vercel inspect`
- a lockfile change that reshapes the pnpm store needs a cache-less first vercel build; `vercel deploy --prod --force` from the repo root, never the app dir
- `CI=1 pnpm install` is frozen-lockfile; pnpm 12 reads `overrides` from `pnpm-workspace.yaml`
- a delete names the file the grep proved, never its dir
- `claude stop <id>` ends a daemon-spawned twin; `kill <pid>` respawns it
- a stdio mcp server is testable from the shell — nine `cclio_mode` pages verified before any cw thread ran

## state

- DOT-237 session B (the one-pool rebind) waits for 2026-10-01; the second part of raycast (aliases, snippets, calc, notes, calendar) opens next session with its pre-research round
- `pnpm linear:read DOT-N` — the fetch-contract script, measured on small / mid / fat tickets, comments first — next boot's first window
- the `@types/react` override carries its exit condition in `_reminders.md`; the verifier's bytes trial and the chords `PRODUCT.md` re-init stay parked
