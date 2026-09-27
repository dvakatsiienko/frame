# reminders — dima's standing hooks

Store contract: the `remind` skill. Both tiers die only when Dima drops them.

## legend

- ⏰ — ordinary, raised at a natural moment
- ⏰📌 — stuck, raised at every boot
- 🦉 — set by the agent for itself; no 🦉 = Dima's ask
  - 👁️ watching a metric
  - 📜 keeping a doc alive
  - 🔬 a probe to run



⏰ 🔬 `/run-skill-generator` — dima test-drives it himself, then this line dies (his word 09-27); was: on the next bytes coder, or an x-com-chat coder dima drives with cclio assisting (convex + env, its natural first app) — moved from the x-queue 2026-09-27

⏰ 🦉📜 spawn-mechanics artifact freshness — `docs/knowledge/spawn-mechanics.md` verified against cc 2.1.283 (2026-09-27, run #3 of `refresh-spawn-mechanics`: no row flipped; the compaction hooks proven end to end); re-run the procedure when the cc version changes, or when a spawn behaves against a [verified] row. the subagent stack row is [volatile] — the first thing run #3 probes — set 2026-08-30











⏰ 🦉👁️ next.js agent-files generator — the 4 bytes next apps (`cv` `figmentation` `financial` `x-com-chat`) hand-own AGENTS.md since 2026-09-19; next 16.3.5 still upserts its managed block on `next dev` and `create-next-app` still scaffolds CLAUDE.md. raise when vercel/next.js [#98910](https://github.com/vercel/next.js/pull/98910) merges or a release note names `agentRules` / the CLAUDE.md shim: re-read `generate-agent-files.ts`, decide `agentRules: false` per app + strip the markers, or keep the block. watched by parallel monitor `65f08524` (daily); the boot prints its events — set 2026-09-19

⏰ 🦉👁️ the `@types/react` override in bytes `pnpm-workspace.yaml` — set 2026-09-21 because `@visx/event` (via `prisma` → `@prisma/studio-core`) still ranges `@types/react` 19.2.x and next's styled-jsx types resolved the hoisted copy, breaking every `React.X` global-namespace use on 19.3. raise when parallel monitor `186f30a4` (weekly) fires, or at an evergreen major of `prisma` or `@visx/*`: remove the two override lines, `pnpm install`, `ls node_modules/.pnpm | grep '@types+react@'` — one version → the override is dead, commit the removal — set 2026-09-21

⏰ 🦉👁️ barrel probe false red — until 2026-10-01: no red by then → delete (dima 09-27, «a probe fail does not trigger recent few days»): did a red recur, and did the logged ctx name its cause? the 2026-09-21 20:18 boot printed 🚨 `got: NONE` while 8/8 hand-runs that hour answered `d03f3da` — a red that meant nothing. patched same session (`2d4ed54`): the probe retries once, and every attempt appends ts/attempt/ctx/reply to `~/.claude/shelf/barrel-probe.log`. measured baselines: the loaded chain spawns at 75.6k prompt tokens, the same spawn with no cclio barrel at 46.5k, so the hook calls ≥60k a model miss and below it a broken import. unproven hypothesis for the original: the nested `claude -p` raced the parent's own init and came up without plugins or memory. reading the window — no red at all → the retry absorbed it, say so and drop on his word · red with ctx ≥60k → the model whiffs, the probe needs a sharper question or three samples · red with ctx <60k → a real chain break, chase the spawn race. — set 2026-09-21

⏰📌 🦉👁️ the daemon spare that skips AGENTS.md — every `--bg` coder claims a pre-warmed `claude bg-spare`; a day-old spare booted one WITHOUT the repo's root `AGENTS.md` (2026-09-22, ccbee7b0), a minutes-old spare loaded it. the workaround is the spawn preflight in `craft-spawning` (spare age → `claude daemon stop --keep-workers` after the throwaway probe → spawn). watch: (a) every coder's first reply names its loaded AGENTS.md paths — a missing root file means the preflight leaked; (b) upstream [#95589](https://github.com/anthropics/claude-code/issues/95589) (our comment carries the spare-age table) — parallel monitor `ed8aea36` (daily). dies when the issue closes fixed and one post-fix coder boots complete on a stale spare — then the preflight line goes too. dima's ask 2026-09-22: «keep an eye on this until fixed on the claude code side, so we know when to remove this tracking habit» — set 2026-09-22





⏰ 🔬 parallel vet, one week to 2026-10-01 — every «research X» runs `parallel-cli research run --processor core` (via `script/op-run.sh`) FIRST, an opus agent second, both graded; every lookup that WebSearch misses gets a `parallel-cli search --mode advanced` retry; the next list-shaped ask tries `findall`, the next url-that-returns-a-shell tries `extract`, one github-issue reminder tries `monitor`. every round appends one line to `docs/vet/parallel.md` (its vet log): date · tool · ask · hit · seconds · chars in ctx · ¢ (balance before/after, settled later). on 10-01: adopt as a door, or drop. dima 2026-09-24: «decide based on data not guesses» — set 2026-09-24


⏰ 🦉👁️ jotai 3 waits on jotai-devtools — bytes pins jotai 2.20.3 in atelier + x-com-chat (e36e7599): jotai-devtools 0.14.0 imports `INTERNAL_buildStoreRev3`, gone in jotai 3, and x-com-chat's prod build broke on it (c637fbe2) though its peer range says `>=2.20.0`. v3 support is merged (jotaijs/jotai-devtools#222) but ships only as 0.15.0-alpha.0. raise when parallel monitor `c42c0b74` (weekly) fires or evergreen shows a jotai 3 card: hold it (close with this reason) until `npm view jotai-devtools version` prints ≥ 0.15.0, then lift jotai + devtools together, proven by a local `pnpm --filter x-com-chat build` — set 2026-09-26
