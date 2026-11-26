---
status: live
until: 2026-12-10
kill-read: 2026-12-03
dies-when: the verdict line below is written
---

# bun — the package manager and script runtime that replaces pnpm and node in frame and bytes

Ticket: FRM-148

**test card:** we believe bun makes installs and script starts faster and the toolchain simpler, with no lost feature · we test it by the bytes probe, then the moves of bytes and frame, then frame's scripts on the bun runtime, and every install, script and evergreen run after · we measure install time (cold, warm, nothing changed) and script start time against pnpm and node on the same clone, CI install minutes, every breakage and its fix time · we're right if installs and script starts are at least as fast as pnpm and node, CI stays green, and no feature we used is lost

**kill rule:** the bytes probe misses one pass line (install, ci, `turbo build` twice with the second a full cache hit and its task hashes matching pnpm's, a vercel preview), or two breakages in one week each cost more than an hour → pnpm and node stay, by the tag

## the log — what happened in the move, dated

- 2026-11-26 · shaped with dima (wing 1): package manager first, frame's scripts on the bun runtime second, next.js stays on node, research rounds 1 and 2 in the wing 1 tree's `.scratch/bun/`

## stress list

- `bun install` migrating `pnpm-lock.yaml` — the bytes probe — versions diffed against pnpm, seconds
- install speed — the bytes and frame clones — cold, warm, nothing changed, by `hyperfine`
- the global virtual store — dima's mac — disk before and after, warm install seconds
- `bun ci` in github actions — both repos' CI — install minutes, cold and cached
- turborepo on `bun.lock` — bytes — `turbo build` twice, the second a full cache hit, task hashes diffed against pnpm (bytes runs no `turbo prune`)
- vercel with bun — one bytes preview — the detected install line, build minutes
- `trustedDependencies` (was pnpm's allowBuilds) — both repos — every needed build script ran
- `minimumReleaseAge` — evergreen — a too-young version held back
- `install.exact` — a `bun add` — no `^` written
- `bun outdated -r` and `bun update -i -r` — evergreen — the sweep's output and minutes
- globals through `bun outdated --cwd ~/.bun/install/global` — evergreen — a global's outdated shown
- vitest under the bun runtime — frame's suite — green, cpu-seconds against node
- `bun script.ts` for frame's scripts — the scripts move — start ms against node, 30 runs
- `bun pm diff` — the next evergreen bump — what it showed

## rounds

- 2026-11-26 · local probe by the researcher card · a tiny `.ts` file: bun 9.6–15 ms, node 121–176 ms; 0.35 cpu-s against 4.4 over 30 runs · bun ahead

## verdict
