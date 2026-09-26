# reminders — dima's standing hooks

Store contract: the `remind` skill. Both tiers die only when Dima drops them.

## legend

- ⏰ — ordinary, raised at a natural moment
- ⏰📌 — stuck, raised at every boot
- 🦉 — set by the agent for itself; no 🦉 = Dima's ask
  - 👁️ watching a metric
  - 📜 keeping a doc alive
  - 🔬 a probe to run


⏰ 🦉🔬 github native stacked PRs — public preview since 2026-07-30 (`gh extension install github/gh-stack`, roadmap #1218); try on the first multi-layer coder assignment, not before — dima 2026-09-07: «too many novelties today». retire graphite from the list when it works. +3 (dima +2 on 2026-09-08 after the coder retro: three merges raced unpushed commits, a stack would have held them) · the BYT-56 coder's job 2 branched from job 1's tip on its own — that is a stack — set 2026-09-07

⏰ 🦉📜 spawn-mechanics artifact freshness — `docs/knowledge/spawn-mechanics.md` verified against cc 2.1.258 (2026-09-02, run #2 of `refresh-spawn-mechanics`); re-run the procedure when the cc version changes, or when a spawn behaves against a [verified] row. the subagent stack row is [volatile] — the first thing run #3 probes — set 2026-08-30


⏰ 🦉📜 humanize skill copies freshness — `plugin-x/skills/humanize` + `humanize-audit` are 1:1 copies of github.com/harshaneel/humanize (commit 4ec7973145, 2026-08-27); if still manual after ~2 months (≈2026-10-27) → raise: refresh via the `refresh-writing-for-humans` procedure, or automate the pull — set 2026-08-27



⏰ 🦉👁️ the freshness engine — the unbuilt half lives on [DOT-256](https://linear.app/x-com/issue/DOT-256) (ci runner · supply-chain scan · cron'd round), under DOT-232; raise it when evergreen runs, not at every boot — set 2026-09-08, rebound 2026-09-22

⏰ 🦉🔬 `/goal` on the next long spec-driven build — [DOT-1](https://linear.app/x-com/issue/DOT-1) is the trial; the ralph plan retired 2026-09-12 (plugin uninstalled: stale since 03-28, 11 open stop-hook bugs, `/goal` is the native loop; a loop earns tokens only when the task outlives one context — ii.inc zenith, huntley's own scope). raise when a coder gets a multi-hour greenfield spec (missed once: the 2026-09-25 atelier build was exactly that shape and nobody raised it — dima caught it at the halt) — set 2026-09-12

⏰ 🦉🔬 ci + pr gates — the full-picture review, once the basic shape works end to end: raise when BYT-95 (workflow_run lane + pinned actions), BYT-96 (preview lane by label), and BYT-100 (guard argv + pr-body marker check) are all closed (greptile is dropped, 2026-09-25). then, one session: cclio reviews the whole flow itself — ci matrix, deploy job, the review gate, the owner-approval lane, the adversarial reviewers and how they interact — finds the optimization places, and explains the full picture to dima in plain words (his ask, 2026-09-12: «explain the full picture to me too»). also on that review (dima, 2026-09-25): why every `coder/*` push still logs a cancelled «not affected» vercel record per app although every `vercel.json` carries `git.deploymentEnabled: false` — 98 of them on 09-25 hit the daily cap; «not a big issue», but the opt-out was expected to solve it. channel: the linear states of the four ids, `linear api` — set 2026-09-12

⏰ 🦉👁️ jev (typesafe ai «system one» model: typed questions → calibrated answers, http api, classifier-grade) — dima 2026-09-18: «park as a monitoring reminder, until it gets into a fleet or falls off». waitlist at console.typesafe.ai; raise at the first sighting of a claude-code hook/plugin or a ci pre-filter built on it, or when it leaves early access — then a probe as the ci review pre-filter, never in front of anything that blocks — set 2026-09-18

⏰ 🦉📜 bytes env → 1password — at the next bytes session: move each app's `.env.local` values onto `op://dev/<service>-<purpose>/credential` references in a committed `.env`, run through `op run --env-file`, keys minted once into vault `dev` (API Credentials items). the contract is BYT-41's scope 1–3; dima 2026-09-19: «we can change the contract for env files across all apps, including bytes». gradual, one app per session is fine — set 2026-09-19


⏰ 🦉👁️ next.js agent-files generator — the 4 bytes next apps (`cv` `figmentation` `financial` `x-com-chat`) hand-own AGENTS.md since 2026-09-19; next 16.3.5 still upserts its managed block on `next dev` and `create-next-app` still scaffolds CLAUDE.md. raise when vercel/next.js [#98910](https://github.com/vercel/next.js/pull/98910) merges or a release note names `agentRules` / the CLAUDE.md shim: re-read `generate-agent-files.ts`, decide `agentRules: false` per app + strip the markers, or keep the block. channel: `gh pr view 98910 -R vercel/next.js --json state` — set 2026-09-19

⏰ 🦉👁️ the `@types/react` override in bytes `pnpm-workspace.yaml` — set 2026-09-21 because `@visx/event` (via `prisma` → `@prisma/studio-core`) still ranges `@types/react` 19.2.x and next's styled-jsx types resolved the hoisted copy, breaking every `React.X` global-namespace use on 19.3. raise at every evergreen major of `prisma` or `@visx/*`: remove the two override lines, `pnpm install`, `ls node_modules/.pnpm | grep '@types+react@'` — one version → the override is dead, commit the removal — set 2026-09-21

⏰ 🦉👁️ barrel probe false red — on/after 2026-10-05: did a red recur, and did the logged ctx name its cause? the 2026-09-21 20:18 boot printed 🚨 `got: NONE` while 8/8 hand-runs that hour answered `d03f3da` — a red that meant nothing. patched same session (`2d4ed54`): the probe retries once, and every attempt appends ts/attempt/ctx/reply to `~/.claude/shelf/barrel-probe.log`. measured baselines: the loaded chain spawns at 75.6k prompt tokens, the same spawn with no cclio barrel at 46.5k, so the hook calls ≥60k a model miss and below it a broken import. unproven hypothesis for the original: the nested `claude -p` raced the parent's own init and came up without plugins or memory. reading the window — no red at all → the retry absorbed it, say so and drop on his word · red with ctx ≥60k → the model whiffs, the probe needs a sharper question or three samples · red with ctx <60k → a real chain break, chase the spawn race. 📌 also open: `import/raycast/extensions/x-ray/src/gmail-block-sender.tsx` writes `JSON.stringify(list, null, 4)`, which biome rejects — every raycast block leaves the repo un-committable until reformatted — set 2026-09-21

⏰📌 🦉👁️ the daemon spare that skips AGENTS.md — every `--bg` coder claims a pre-warmed `claude bg-spare`; a day-old spare booted one WITHOUT the repo's root `AGENTS.md` (2026-09-22, ccbee7b0), a minutes-old spare loaded it. the workaround is the spawn preflight in `craft-spawning` (spare age → `claude daemon stop --keep-workers` after the throwaway probe → spawn). watch: (a) every coder's first reply names its loaded AGENTS.md paths — a missing root file means the preflight leaked; (b) upstream [#95589](https://github.com/anthropics/claude-code/issues/95589) (our comment carries the spare-age table) — `gh issue view 95589 -R anthropics/claude-code --json state` at every cc version bump. dies when the issue closes fixed and one post-fix coder boots complete on a stale spare — then the preflight line goes too. dima's ask 2026-09-22: «keep an eye on this until fixed on the claude code side, so we know when to remove this tracking habit» — set 2026-09-22





⏰ 🔬 parallel vet, one week to 2026-10-01 — every «research X» runs `parallel-cli research run --processor core` (via `script/op-run.sh`) FIRST, an opus agent second, both graded; every lookup that WebSearch misses gets a `parallel-cli search --mode advanced` retry; the next list-shaped ask tries `findall`, the next url-that-returns-a-shell tries `extract`, one github-issue reminder tries `monitor`. every round appends one line to `docs/research/parallel-measure.md` «vet log»: date · tool · ask · hit · seconds · chars in ctx · ¢ (balance before/after, settled later). on 10-01: adopt as a door, or drop. dima 2026-09-24: «decide based on data not guesses» — set 2026-09-24


⏰ 🦉👁️ jotai 3 waits on jotai-devtools — bytes pins jotai 2.20.3 in atelier + x-com-chat (e36e7599): jotai-devtools 0.14.0 imports `INTERNAL_buildStoreRev3`, gone in jotai 3, and x-com-chat's prod build broke on it (c637fbe2) though its peer range says `>=2.20.0`. v3 support is merged (jotaijs/jotai-devtools#222) but ships only as 0.15.0-alpha.0. raise when evergreen shows a jotai 3 card: hold it (close with this reason) until `npm view jotai-devtools version` prints ≥ 0.15.0, then lift jotai + devtools together, proven by a local `pnpm --filter x-com-chat build` — set 2026-09-26
