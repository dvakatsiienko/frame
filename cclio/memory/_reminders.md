# reminders — dima's standing hooks

Store contract: the `remind` skill. Both tiers die only when Dima drops them.

## legend

- ⏰ — ordinary, raised at a natural moment
- ⏰📌 — stuck, raised at every boot
- 🦉 — set by the agent for itself; no 🦉 = Dima's ask
  - 👁️ watching a metric
  - 📜 keeping a doc alive
  - 🔬 a probe to run




⏰ 🦉📜 spawn-mechanics artifact freshness — `docs/knowledge/spawn-mechanics.md` verified against cc 2.1.283 (2026-09-27, run #3 of `refresh-spawn-mechanics`: no row flipped; the compaction hooks proven end to end); re-run the procedure when the cc version changes, or when a spawn behaves against a [verified] row. the subagent stack row is [volatile] — the first thing run #3 probes — set 2026-08-30











⏰ 🦉👁️ next.js agent-files generator — the 4 bytes next apps (`cv` `figmentation` `financial` `x-com-chat`) hand-own AGENTS.md since 2026-09-19; next 16.3.5 still upserts its managed block on `next dev` and `create-next-app` still scaffolds CLAUDE.md. raise when vercel/next.js [#98910](https://github.com/vercel/next.js/pull/98910) merges or a release note names `agentRules` / the CLAUDE.md shim: re-read `generate-agent-files.ts`, decide `agentRules: false` per app + strip the markers, or keep the block. watched by parallel monitor `65f08524` (daily); the boot prints its events — set 2026-09-19

⏰ 🦉👁️ the `@types/react` override in bytes `pnpm-workspace.yaml` — set 2026-09-21 because `@visx/event` (via `prisma` → `@prisma/studio-core`) still ranges `@types/react` 19.2.x and next's styled-jsx types resolved the hoisted copy, breaking every `React.X` global-namespace use on 19.3. raise when parallel monitor `186f30a4` (weekly) fires, or at an evergreen major of `prisma` or `@visx/*`: remove the two override lines, `pnpm install`, `ls node_modules/.pnpm | grep '@types+react@'` — one version → the override is dead, commit the removal — set 2026-09-21

⏰ 🦉👁️ barrel probe false red — until 2026-10-01: no red by then → delete (dima 09-27, «a probe fail does not trigger recent few days»): did a red recur, and did the logged ctx name its cause? the 2026-09-21 20:18 boot printed 🚨 `got: NONE` while 8/8 hand-runs that hour answered `d03f3da` — a red that meant nothing. patched same session (`2d4ed54`): the probe retries once, and every attempt appends ts/attempt/ctx/reply to `~/.claude/shelf/barrel-probe.log`. measured baselines: the loaded chain spawns at 75.6k prompt tokens, the same spawn with no cclio barrel at 46.5k, so the hook calls ≥60k a model miss and below it a broken import. unproven hypothesis for the original: the nested `claude -p` raced the parent's own init and came up without plugins or memory. reading the window — no red at all → the retry absorbed it, say so and drop on his word · red with ctx ≥60k → the model whiffs, the probe needs a sharper question or three samples · red with ctx <60k → a real chain break, chase the spawn race. — set 2026-09-21

⏰📌 🦉👁️ the daemon spare that skips AGENTS.md — every `--bg` coder claims a pre-warmed `claude bg-spare`; a day-old spare booted one WITHOUT the repo's root `AGENTS.md` (2026-09-22, ccbee7b0), a minutes-old spare loaded it. the workaround is the spawn preflight in `craft-spawning` (spare age → `claude daemon stop --keep-workers` after the throwaway probe → spawn). watch: (a) every coder's first reply names its loaded AGENTS.md paths — a missing root file means the preflight leaked; (b) upstream [#95589](https://github.com/anthropics/claude-code/issues/95589) (our comment carries the spare-age table) — parallel monitor `ed8aea36` (daily). dies when the issue closes fixed and one post-fix coder boots complete on a stale spare — then the preflight line goes too. dima's ask 2026-09-22: «keep an eye on this until fixed on the claude code side, so we know when to remove this tracking habit» — set 2026-09-22





⏰ 🔬 **monitor canary, grade on 2026-10-01** — the canary ran 09-28 14:51 on [frame#48](https://github.com/dvakatsiienko/frame/issues/48) (one comment, the `question` label, closed; `canary-monitor-ping` in `5ca073cc`). on 10-01 grade the 10 monitors in `docs/vet/parallel.md` (monitor round): fired · latency · false positives · the balance (462¢ before). dies when graded — set 2026-09-27

⏰ 🔬 parallel vet, to 2026-10-06 (moved from 10-01, dima 09-29: graded head-to-head with exa) — every «research X» runs `parallel-cli research run --processor core` (via `script/op-run.sh`) FIRST, an opus agent second, both graded; every lookup that WebSearch misses gets a `parallel-cli search --mode advanced` retry; the next list-shaped ask tries `findall`, the next url-that-returns-a-shell tries `extract`, one github-issue reminder tries `monitor`. every round appends one line to `docs/vet/parallel.md` (its vet log): date · tool · ask · hit · seconds · chars in ctx · ¢ (balance before/after, settled later). on 10-06: adopt as a door, or drop — beside the exa verdict. dima 2026-09-24: «decide based on data not guesses» — set 2026-09-24


⏰ 🔬 exa vet, one week to 2026-10-06 — parallel's challenger for the research door. every «research X» runs an exa agent run beside the parallel core and the opus lane; walk the stress list in `docs/vet/exa.md` (agent run, deep search, search, contents, answer, findSimilar, websets, monitors, batch), one real ask per feature, widest over deepest (`habit-vet`), one line per round in its log. on 10-06: adopt exa, keep parallel, or both — graded head-to-head. dima 2026-09-29: «possibly replacing parallel ai … fully tested, same as parallel» — set 2026-09-29

⏰ 🔬 adhd vet, one week to 2026-10-05 — every real naming / design-fork / fuzzy-bug ask offers `/adhd:adhd` beside a plain opus baseline, blind a/b to dima, one line per round in `docs/vet/adhd.md` (the protocol is there). any real case counts from the weekly reset on — candidates named so far: the `crew-designer` four phases + the 10 atelier looks, the shift-model «what's missing» pass, a fuzzy bug with no known cause (BYT-88 refetch, the barrel-probe false red). not bytes naming (dima: the frame rename settles first). on 10-05: adopt user-only or uninstall. dima 2026-09-28: «install and vet for 1wk. and measure its perf» — set 2026-09-28

⏰ 🔬 browserbase vet, one week to 2026-10-05 — walk the stress list in `docs/vet/browserbase.md`, one real ask per feature, widest over deepest (`habit-vet`); the free hour is the budget, log minutes per round. on 10-05: adopt as the cloud-agent browser door, or drop. dima 2026-09-28: «pick good features of browserbase for us to stress test and find how to get use of cloud agents» — set 2026-09-28

⏰ 🔬 cc-cloud vet, to 2026-11-04 (the $250 credit expires 11-05) — cloud sessions are fleet members on vet; walk `docs/vet/cc-cloud.md`, one real job per candidate use, dima's usage-page screenshot before and after each. on 11-04: which uses stay, written into `x:crew-cloud`. dima 2026-09-28: «announce cloud sessions as official members of our fleet, under vet, and we have to find a good use for cloud agents» — set 2026-09-28


⏰ 🦉🔬 NPSSO lifetime — dima pasted a fresh local NPSSO on 2026-09-27 ~20:55 (trophy-sys `/console`, main checkout); the old one died on «day 15» while trophy-sys's AGENTS.md says 10. measure: start the app with `trophy-sys-run` and read `curl -s -o /dev/null -w '%{http_code}' localhost:5177/api/profile` on 2026-10-07 (day 10), then daily from 10-10 until the first 500 `NPSSO_INVALID`; that day is the lifetime → BYT-85's body + trophy-sys AGENTS.md — set 2026-09-27

⏰ 🦉👁️ jotai 3 waits on jotai-devtools — bytes pins jotai 2.20.3 in atelier + x-com-chat (e36e7599): jotai-devtools 0.14.0 imports `INTERNAL_buildStoreRev3`, gone in jotai 3, and x-com-chat's prod build broke on it (c637fbe2) though its peer range says `>=2.20.0`. v3 support is merged (jotaijs/jotai-devtools#222) but ships only as 0.15.0-alpha.0. raise when parallel monitor `c42c0b74` (weekly) fires or evergreen shows a jotai 3 card: hold it (close with this reason) until `npm view jotai-devtools version` prints ≥ 0.15.0, then lift jotai + devtools together, proven by a local `pnpm --filter x-com-chat build` — set 2026-09-26

⏰ 🦉🔬 design run vet — the designer flow is on trial: the first atelier run walks the test list in `docs/vet/design-run.md` (brief gate, canvas fill, a real spread, pick time, rounds, the blinding, cost, comp → build, two A/Bs), one ledger line per spread; raise when a design job starts and at the verdict (adopt / reshape / drop). dima 2026-09-29: «a tested and proven design flow … a reminder of what we have to test» — set 2026-09-29

⏰ 🦉👁️ pr auto-fix default — the desktop Code tab's «Auto-fix pull requests» setting does not persist (checkboxes reset per pr), [claude-code#90751](https://github.com/anthropics/claude-code/issues/90751). raise when parallel monitor `a7467339` (daily) fires: re-test the default on a cloud pr, then decide it for pr-lane coders — today it stays off there, because auto-fix answering review comments would fight the verifier loop. dima 2026-09-28: «monitor it» — set 2026-09-28

⏰ 🔬 quicksilver vet, two weeks to 2026-10-12 — the jev bulk-judgment skill (vendored @ 5d6fe5c, key via op-run). walk the stress list in `docs/vet/quicksilver.md`, one real ask per feature, widest over deepest (`habit-vet`); every round one line in its log. on 10-12: adopt (and teach crew-coder when to reach for it) or drop; at adoption also decide vendored vs the `quicksilver@quicksilver` marketplace (it ships one) — the key and data-guard lines need a home outside the skill first. dima 2026-09-28: «is it truly useful? … vet - 2 weeks» — set 2026-09-28

⏰ 🦉👁️ tart on brew 7 — `brew install cirruslabs/cli/tart` dies on brew 7 (`depends_on :macos` outside `on_macos`, tart.rb:22), [cirruslabs/homebrew-cli#21](https://github.com/cirruslabs/homebrew-cli/issues/21). until then FRM-147 runs the checksum-checked 2.32.1 release binary from a job tmp. raise when parallel monitor `98e9a277` (daily) fires: `brew install cirruslabs/cli/tart`, and the release-binary line leaves the seed docs — set 2026-09-28

⏰ 🔬 ts-lsp vet, two weeks to 2026-10-14 — the native TS 7 server through plugin `x` (`.lsp.json` → `bin/ts-lsp`); walk the stress list in `docs/vet/ts-lsp.md`, read `python3 docs/vet/ts-lsp/usage.py` at every halt (LSP calls beside grep calls per session), one line per round in its log. on 10-14: keep (and sharpen the `x:guide-code` «every use site» line) or drop the entry. dima 2026-09-30: «measure it under a weight for 2 weeks» — set 2026-09-30

⏰ 🦉👁️ the official `typescript-lsp` on TS 7 — [claude-plugins-official#4492](https://github.com/anthropics/claude-plugins-official/issues/4492). raise when parallel monitor `6cf348bc` (daily) fires: re-enable `typescript-lsp@claude-plugins-official`, delete `plugin-x/.lsp.json` + `bin/ts-lsp`, re-run the day-0 hover + references probe. dima prefers the official plugin (auto-updated) — set 2026-09-30
