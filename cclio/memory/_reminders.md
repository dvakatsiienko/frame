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












⏰ 🦉👁️ the `@types/react` override in bytes `pnpm-workspace.yaml` — set 2026-09-21 because `@visx/event` (via `prisma` → `@prisma/studio-core`) still ranges `@types/react` 19.2.x and next's styled-jsx types resolved the hoisted copy, breaking every `React.X` global-namespace use on 19.3. raise when parallel monitor `186f30a4` (weekly) fires, or at an evergreen major of `prisma` or `@visx/*`: remove the two override lines, `pnpm install`, `ls node_modules/.pnpm | grep '@types+react@'` — one version → the override is dead, commit the removal — set 2026-09-21


⏰📌 🦉👁️ the daemon spare that skips AGENTS.md — every `--bg` coder claims a pre-warmed `claude bg-spare`; a day-old spare booted one WITHOUT the repo's root `AGENTS.md` (2026-09-22, ccbee7b0), a minutes-old spare loaded it. the workaround is the spawn preflight in `craft-spawning` (spare age → `claude daemon stop --keep-workers` after the throwaway probe → spawn). watch: (a) every coder's first reply names its loaded AGENTS.md paths — a missing root file means the preflight leaked; (b) upstream [#95589](https://github.com/anthropics/claude-code/issues/95589) (our comment carries the spare-age table) — the gh watch (boot digest). dies when the issue closes fixed and one post-fix coder boots complete on a stale spare — then the preflight line goes too. dima's ask 2026-09-22: «keep an eye on this until fixed on the claude code side, so we know when to remove this tracking habit» — set 2026-09-22






⏰ 🔬 parallel test drive, to 2026-10-08 (moved from 10-01, dima 09-29: graded head-to-head with exa) — every «research X» runs `parallel-cli research run --processor core` (via `script/op-run.sh`) FIRST, an opus agent second, both graded; every lookup that WebSearch misses gets a `parallel-cli search --mode advanced` retry; the next list-shaped ask tries `findall`, the next url-that-returns-a-shell tries `extract`, one github-issue reminder tries `monitor`. every round appends one line to `docs/test-drive/parallel.md` (its vet log): date · tool · ask · hit · seconds · chars in ctx · ¢ (balance before/after, settled later). on 10-08: adopt as a door, or drop — beside the exa verdict. dima 2026-09-24: «decide based on data not guesses» — set 2026-09-24


⏰ 🔬 exa test drive, one week to 2026-10-08 — parallel's challenger for the research door. every «research X» runs an exa agent run beside the parallel core and the opus lane; walk the stress list in `docs/test-drive/exa.md` (agent run, deep search, search, contents, answer, findSimilar, websets, monitors, batch), one real ask per feature, widest over deepest (`habit-test-drive`), one line per round in its log. on 10-08: adopt exa, keep parallel, or both — graded head-to-head. dima 2026-09-29: «possibly replacing parallel ai … fully tested, same as parallel» — set 2026-09-29

⏰ 🔬 adhd test drive, extended one week to 2026-10-14 (dima 10-06: «outputs was meh») — every real naming / design-fork / fuzzy-bug ask offers `/adhd:adhd` beside a plain opus baseline, blind a/b to dima, one line per round in `docs/test-drive/adhd.md` (the protocol is there). any real case counts from the weekly reset on — candidates named so far: the `crew-designer` four phases + the 10 atelier looks, the shift-model «what's missing» pass, a fuzzy bug with no known cause (BYT-88 refetch, the barrel-probe false red). not bytes naming (dima: the frame rename settles first). on 10-14: adopt user-only or uninstall. dima 2026-09-28: «install and vet for 1wk. and measure its perf» — set 2026-09-28

⏰ 🔬 browserbase test drive, extended to 2026-10-14 (dima 10-06) — walk the stress list in `docs/test-drive/browserbase.md`, one real ask per feature, widest over deepest (`habit-test-drive`); the free hour is the budget, log minutes per round. on 10-14: adopt as the cloud-agent browser door, or drop. dima 2026-09-28: «pick good features of browserbase for us to stress test and find how to get use of cloud agents» — set 2026-09-28

⏰ 🔬 cc-cloud test drive, to 2026-11-04 (the $250 credit expires 11-05) — cloud sessions are fleet members on a test drive; walk `docs/test-drive/cc-cloud.md`, one real job per candidate use, dima's usage-page screenshot before and after each. on 11-04: which uses stay, written into `x:crew-cloud`. dima 2026-09-28: «announce cloud sessions as official members of our fleet, under vet, and we have to find a good use for cloud agents» — set 2026-09-28


⏰ 🦉🔬 NPSSO lifetime — dima pasted a fresh local NPSSO on 2026-09-27 ~20:55 (trophy-sys `/console`, main checkout); the old one died on «day 15» while trophy-sys's AGENTS.md says 10. measure: start the app with `trophy-sys-run` and read `curl -s -o /dev/null -w '%{http_code}' localhost:5177/api/profile` on 2026-10-07 (day 10), then daily from 10-10 until the first 500 `NPSSO_INVALID`; that day is the lifetime → BYT-85's body + trophy-sys AGENTS.md — set 2026-09-27

⏰ 🦉👁️ jotai 3 waits on jotai-devtools — bytes pins jotai 2.20.3 in atelier + x-com-chat (e36e7599): jotai-devtools 0.14.0 imports `INTERNAL_buildStoreRev3`, gone in jotai 3, and x-com-chat's prod build broke on it (c637fbe2) though its peer range says `>=2.20.0`. v3 support is merged (jotaijs/jotai-devtools#222) but ships only as 0.15.0-alpha.0. raise when parallel monitor `c42c0b74` (weekly) fires or evergreen shows a jotai 3 card: hold it (close with this reason) until `npm view jotai-devtools version` prints ≥ 0.15.0, then lift jotai + devtools together, proven by a local `pnpm --filter x-com-chat build` — set 2026-09-26

⏰ 🦉🔬 design run test drive — the designer flow is on trial: the first atelier run walks the test list in `docs/test-drive/design-run.md` (brief gate, canvas fill, a real spread, pick time, rounds, the blinding, cost, comp → build, two A/Bs), one ledger line per spread; raise when a design job starts and at the verdict (adopt / reshape / drop). dima 2026-09-29: «a tested and proven design flow … a reminder of what we have to test» — set 2026-09-29

⏰ 🦉👁️ pr auto-fix default — the desktop Code tab's «Auto-fix pull requests» setting does not persist (checkboxes reset per pr), [claude-code#90751](https://github.com/anthropics/claude-code/issues/90751). raise when the gh watch (boot digest) fires: re-test the default on a cloud pr, then decide it for pr-lane coders — today it stays off there, because auto-fix answering review comments would fight the verifier loop. dima 2026-09-28: «monitor it» — set 2026-09-28

⏰ 🔬 quicksilver test drive, frozen with the jev credit, verdict moved 2026-10-14 → 2026-10-28 (dima 2026-10-05: «freeze jev-related test drives too»; the $5 monthly credit ran out on 10-05 and refills ~10-18) — the jev bulk-judgment skill (vendored @ 5d6fe5c, key via op-run). walk the stress list in `docs/test-drive/quicksilver.md`, one real ask per feature, widest over deepest (`habit-test-drive`); every round one line in its log. on 10-28: adopt (and teach crew-coder when to reach for it) or drop; at adoption also decide vendored vs the `quicksilver@quicksilver` marketplace (it ships one) — the key and data-guard lines need a home outside the skill first. dima 2026-09-28: «is it truly useful? … vet - 2 weeks» — set 2026-09-28

⏰ 🦉👁️ tart on brew 7 — `brew install cirruslabs/cli/tart` dies on brew 7 (`depends_on :macos` outside `on_macos`, tart.rb:22), [cirruslabs/homebrew-cli#21](https://github.com/cirruslabs/homebrew-cli/issues/21). until then FRM-147 runs the checksum-checked 2.32.1 release binary from a job tmp. raise when the gh watch (boot digest) fires: `brew install cirruslabs/cli/tart`, and the release-binary line leaves the seed docs — set 2026-09-28

⏰ 🔬 ts-lsp test drive, two weeks to 2026-10-16 — the native TS 7 server through plugin `x` (`.lsp.json` → `bin/ts-lsp`); walk the stress list in `docs/test-drive/ts-lsp.md`, read `python3 docs/test-drive/ts-lsp/usage.py` at every halt (LSP calls beside grep calls per session), one line per round in its log. on 10-16: keep (and sharpen the `x:guide-code` «every use site» line) or drop the entry. dima 2026-09-30: «measure it under a weight for 2 weeks» — set 2026-09-30

⏰ 🦉👁️ the official `typescript-lsp` on TS 7 — [claude-plugins-official#4492](https://github.com/anthropics/claude-plugins-official/issues/4492). raise when the gh watch (boot digest) fires: re-enable `typescript-lsp@claude-plugins-official`, delete `plugin-x/.lsp.json` + `plugin-x/lsp/typescript-native/` (+ its biome exclusion), re-run the day-0 hover + references + diagnostics probes (`docs/test-drive/ts-lsp.md` log). the TS side, [TypeScript#63921](https://github.com/microsoft/TypeScript/pull/63921), rides the gh watch: when it merges the vendored bridge turns itself off — confirm diagnostics still arrive. dima prefers the official plugin (auto-updated) — set 2026-09-30

⏰ 🔬 design drift policy test drive — two weeks (dima 2026-09-30), started 2026-09-30 (atelier's `DESIGN.md` shipped with bytes #116), verdict 2026-10-16; the verdict also answers dima's FRM-244 note «designs are not throwaway. ideally they would be live, and at least ± synced with live app state»: every small UI ask goes to a coder with `DESIGN.md` + a live screenshot, no designer; log each ask and whether dima rejected the result for a visual reason in `docs/test-drive/design-run.md`. over 25 % visual rejections, or a mid-way ask for a comp → the policy is wrong, and a single-take designer pass becomes the default for small asks. then `docs/research/design-drift.md` dies. dima 2026-09-30: adopted, «structured layer lives, comps retire» — set 2026-09-30

⏰ 🔬 coderabbit test drive, two weeks to 2026-10-16 — crew-coder keeps running it; every pr logs its findings and its unique finds in `docs/test-drive/coderabbit.md`, and the day-0 reads (free tier vs paid, cli modes, an assertive config) run before the next round. on 10-16: keep it as a lane or cut it. dima 2026-09-30: «move it into test drive for 2 weeks instead … its a free code review still» — set 2026-09-30

⏰ 🔬 ctx7 test drive, one week to 2026-10-09 — `pnpm crew:audit --days 7` counts every coder's docs lookups (ctx7 · context7 mcp · web); one log line per coder session in `docs/test-drive/ctx7.md`. on 10-09: ctx7 used and useful → uninstall the context7 mcp plugin, ctx7's line in `rules/fleet-tooling.md` drops «on trial»; neither used → the «docs first» habit needs a harder trigger. dima 2026-09-30: «i don't want both tools … we have to measure first. maybe set a 1-week period» — set 2026-09-30

⏰ 🔬 model refresh re-run, 2026-12-24 (12 weeks) or when haiku 5.x ships, whichever comes first — the daily parallel monitor `monitor_51229b5a80544caa99cbf4009f741e59` watches for the haiku release (the boot digest prints its events); on release also re-run the skill router's haiku arm (arm 5, `docs/research/skill-router.md`): haiku 4.5 lost to jev 27 % vs 75 % on 10-05, dima: «we may re-measure it as potential classifier when it is released» — sonnet 5.5 was 3 days old at the 10-01 run, so its effort/helper-lane data was thin (no edit or research-quality test existed); run `recipes/refresh-craft-spawning/recipe.md`, latest anthropic models + one generation back. dima 2026-10-01 (inbox): «if the research will be very young … set a reminder to do another refresh in 12 weeks» — set 2026-10-01

⏰ 🔬 explore test drive, one week to 2026-10-10 — every Explore call fleet-wide now runs on sonnet 5.5 `medium` (`home/.claude/agents/explore.md`, proven on a fresh session 2026-10-01). walk the 10-lookup stress list in `docs/test-drive/explore.md` for arms A (opus, built-in), B (sonnet) and C (jev ranking, a script built once B has rounds — frozen with the jev credit until ~10-18; on 10-10 A vs B decides, C gets its rounds after the refill); one log line per lookup per arm. on 10-10: keep the winner as the agent file, drop the others. dima 2026-10-01: «worth to setup and a/b measure? and test drive side by side?» — set 2026-10-01

⏰ 🔬 jev compaction test drive, frozen with the jev credit, verdict moved 2026-10-17 → 2026-10-31 (every compaction falls back until the ~10-18 refill) — `fast-jev-compaction` at cclio scope only, **switched off 2026-10-05** after the 402 toast (dima: yes) — at the refill set it back to `true` in `cclio/.claude/settings.json`, then round 3 (twin sessions, one recall quiz, `/context` before and after); every `/cclio:checkpoint` compaction logs one line in `docs/test-drive/jev-compaction.md`: before → after, seconds, fallback, open asks kept. on 10-31: adopt or uninstall. the 10-05 fallback (400 invalid Unicode) is filed upstream as [fast-jev-compaction#128](https://github.com/tamaratran/fast-jev-compaction/issues/128) — the gh watch reports its fix. dima 2026-10-01: «maybe try this?» — set 2026-10-01

⏰ 🔬 vorssaint shelf test drive, two weeks to 2026-10-17 — dima drops screenshots past the 5-per-prompt cap on the vorssaint utils shelf and says «check my shelf»; read with `pnpm vorssaint:shelf`, one log line per read in `docs/test-drive/vorssaint-shelf.md`. on 10-17: a door line in `rules/fleet-doors.md` (his approval), or drop. dima 2026-10-01: «let's use this approach. test drive.» — set 2026-10-01

⏰ 🎬 b-roll, when dima next makes a video — the test drive is done (dima 2026-10-02: «save it until the next time I decide to do some video and sharpen this flow too»). the engine is decided: HyperFrames (local, cloned at `~/Movies/motion-broll/hyperframes-src`, `pnpm exec`, no account; telemetry off via `HYPERFRAMES_NO_TELEMETRY=1` + `DO_NOT_TRACK=1`) with motion-broll's scenes ported in as templates — the one-scene port proved it (`~/Movies/motion-broll/hf/videos/speak-port/output.mp4`: select → F4 → pill morph, head-to-corner, 66 s render, lint clean; limits: one hosted scene per page until stage ids are namespaced, no motion blur yet). per-segment treatment picked by dima at the plan step: face only · overlay · head-to-corner · full cutaway. evidence: `docs/test-drive/motion-broll.md`. on that day:
  - first, before any plan: peek into [whatships.com](https://whatships.com/) for inspiration (2.3k launch videos with an agent index) and print dima 3–5 moves worth borrowing (dima, 2026-10-02: «a reminder to peek into it before i ask for next b-roll/hyperframe video»)
  - build a thin global user-only skill (`home/.claude/skills/<name>`, `disable-model-invocation`) + `recipes/refresh-broll/` (per `x:shape-recipe`)
  - sharpen the flow with his asks as they come during the try (dima: «I have a lot of requests to sharpen, but that's not now»)
  - find a better home for takes — `~/Movies/motion-broll` «is far away and hard for me to open»
  - the want: «product demos for our apps, sometimes a readme clip, or just random fun clip i could sent to someone via telegram, or slack, for example describe what i achieved during the week» · face cam now, a speak voice-over later (the weekly recap needs no footage) · look from each app's `DESIGN.md` · a finished video, no editor — «the editor appeared to be useless for me, so probably it would be just a maintenance burden» · rarely, the recipe runs on use — set 2026-10-02

⏰ when the speak build closes ([FRM-288](https://linear.app/x-com/issue/FRM-288)), ask dima which goes next: the memory + skills sweep ([FRM-267](https://linear.app/x-com/issue/FRM-267), read `docs/research/skill-authoring-best-practices.md` first) or the cli re-shape ([FRM-284](https://linear.app/x-com/issue/FRM-284)). dima 2026-10-02: «sweep second or cli - decide after speak» — set 2026-10-02

⏰ 🔬 reply-check test drive, two weeks to 2026-10-18 — the log-only Stop hook (pure regex, no jev); at each halt read `pnpm reply-check:report`, one log line in `docs/test-drive/reply-check.md`. on 10-18: per rule — fix the root, block, or drop (the rule is in the file). dima 2026-10-02: «let's vet it for 2 weeks» — set 2026-10-02

⏰ 🦉👁️ mods over remote control — [claude-code#99217](https://github.com/anthropics/claude-code/issues/99217) (our 2.1.289 repro is a comment there): mods draw only on the host surface, never in the desktop/iOS view of a `--remote-control` session; also the desktop refuses a mod `Client` module (10 s, CSP). raise when the gh watch fires: re-test breather + stash in a terminal-born session viewed from the Code tab. until then cclio boots from the Code tab (dima, 2026-10-04) — set 2026-10-04

⏰ 🔬 memory-load test drive, two weeks to 2026-10-20 — lazy rules (linear-flow out of the resident set, FRM-300). every halt reads the hook's `miss` lines, one log line in `docs/test-drive/memory-load.md`. on 10-20: rerun `pnpm memory-load:replay --days 14`; keep (then `fleet-hazards` goes lazy next) or discard (the file goes back to `rules/`). dima 2026-10-04: «let's see if it works, make it work, or discard it» — set 2026-10-04

⏰ 🔬 mods test drive, two weeks to 2026-10-19 — the cc mods (stash, breather) and whether the fleet needs to know them; walk the stress list in `docs/test-drive/mods.md`, one log line per halt (which mod fired for real, what it saved or broke). on 10-19: a fleet-awareness line + per-mod contracts, keep as dima's own layer, or prune. dima 2026-10-05: «let's continue exploring and registering mods on a test drive, so you would keep an eye on it and increase fleet awareness about whether mods are even needed» — set 2026-10-05

⏰ 🦉🔬 skill router re-measure, 2026-10-19 — v2 (FRM-305, #57) merged with the router OFF: on 32 real held-out prompts the best arm read 75 % precision / 15 % wrong, the turn-on bar is 90 % / 5 %. until then every halt adds ≥ 10 real prompts from the day's transcripts to `shelf/jev/fixtures/skill-router.jsonl`, labelled by what should have loaded (the living eval set, `refresh-classification`). on 10-19: replay on ~100 real prompts beside the haiku baseline arm; turn on, rebuild, or drop the router. dima 2026-10-05: «a + b» — set 2026-10-05


⏰ 🦉📜 refresh-cc-mods at every cc minor that touches mods — at each cc version bump read the changelog for mod/function-hook lines (new events, `$` methods, render sites, limits, surfaces); any hit → run `recipes/refresh-cc-mods/recipe.md` (its «next run» list holds the hot leads from 10-05). dima 2026-10-05: «write it while your traces about mods are hot» — set 2026-10-05

⏰📌 🦉📜 the frame → bytes merge, one slice per lane — every lane takes one session-sized merge slice beside its main work, in the order of `docs/research/monorepo-agents.md` (turbo wins → the lockfile probe → step 0: clone-and-rename, git-crypt out, a launchd deploy step → m1 the apps → hooks merged + `mirror` scoped → frame's infra last); each slice leaves both repos working and is proven by a check. re-sliced 2026-10-06: S1 → BYT-106, S2 → BYT-125, step 0 → FRM-330 / FRM-331 / FRM-332, m1 → BYT-126 + BYT-109, hooks → FRM-333, in that sortOrder; m4 is re-sliced once those land. dies when m4 closes. dima 2026-10-05: «plan bytes merge in a way, so it is gradual, mixed between our lanes, part by part and not folded into a long shelf» — set 2026-10-05

⏰ 🔬 you-should-know test drive, one week to 2026-10-13 — the built-in `cc-plugin-you-should-know`, on in dima's terminal sessions (user scope, so coders get it too); walk the stress list in `docs/test-drive/you-should-know.md`, one log line per card. on 10-13: keep on, keep for dima only, or off. dima 2026-10-06: «how to test drive it? can i test drive now?» — set 2026-10-06

⏰ 🔬 bare-cc test drive, two weeks to 2026-10-20 — the `fleet-tooling` line plus the `flow:report` count (FRM-328); walk the stress list in `docs/test-drive/bare-cc.md`. on 10-20: kept as a habit, or a guard hint when it stays unused. dima 2026-10-06: «if bare cc is not used then a memory word is not enough» — set 2026-10-06

⏰ 🔬 ccrow test drive, two weeks to 2026-10-20 — the parked adviser (FRM-327, `docs/test-drive/ccrow.md`); every halt reads `~/.local/state/ccrow/notes.jsonl` + `verdicts.jsonl`, one log line per day; days 1–3 silent and paired, then live and alternating. on 10-20: keep (and pick the arm), reshape, or stop — and the mod (FRM-327 «later») only if it proved useful. dima 2026-10-06: «test drive for 2 weeks + measures» — set 2026-10-06

⏰ 🔬 show-me test drive, one week to 2026-10-13 — `/show-me` (dima types it); one log line per use in `docs/test-drive/show-me.md`. the verdict waits for the whiteboard test drive, so the two compare head to head (dima 2026-10-06: «looks nice, let's keep an eye on it until whiteboard is also test driven to compare»); dima 2026-10-06: «start now» — set 2026-10-06

⏰ 🔬 whiteboard test drive (dev.fast, cli-driven) — first real case: review the cli a/b/c arms (FRM-284) when they report; log in `docs/test-drive/whiteboard.md`; the verdict compares head to head with show-me, then the whiteboard recipe is written from the real uses. dima 2026-10-06: «let's test drive it … create and execute whiteboard app recipe» — set 2026-10-06

⏰ 🔬 tdd test drive, two weeks to 2026-10-20 — `mattpocock-skills:tdd`, named in `x:crew-coder` for test-shaped exit lines; one log line per ticket in `docs/test-drive/tdd.md` (loaded or not, verifier findings, rounds, tests proven red). on 10-20: a default for every coder, for some tickets, or drop. dima 2026-10-06: «it changes a coder's approach a lot … deserves a test drive and measure» — set 2026-10-06

⏰ 🔬 retro test drive, two weeks to 2026-10-20 — `mattpocock-skills:retro` (user-only): self-retros only (dima 10-07: «spawning a session only for retro is a bad idea»): coders and verifiers read matt's retro SKILL.md at their last act, cclio's retro is dima typing `/mattpocock-skills:retro` in its thread before a checkpoint or halt; one line per run in `docs/test-drive/retro.md`. when a session went wrong, say «🎓 a /retro moment» to dima. on 10-20: does it replace the self-retro? dima 2026-10-06: «very-very useful» — set 2026-10-06

⏰ 🔬 spec pipeline test drive, three runs — to-spec → to-tickets → implement-spec on a local `.scratch/` tracker, linear stays global (`docs/test-drive/spec-pipeline.md`); run 1 while dima is at the keyboard, on an almost-freebie with several parts. raise «🎓 a /to-spec moment» when a lane or shift starts from a ticket with several parts. dima 2026-10-06: «have Linear tickets as global … but structured via to spec right before execution» — set 2026-10-06

⏰ 🔬 pocket test drive, two weeks to 2026-10-21 — one log line per halt in `docs/test-drive/pocket.md` (items resolved, tickets opened, «what's next?» asks, items lost; day-0 baseline in the file). on 10-21: keep the pocket or go back to a vault journal. dima 2026-10-07: «test drive» (pocket item 11) — set 2026-10-07
