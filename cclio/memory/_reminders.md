# reminders — dima's standing hooks

Store contract: the `remind` skill. Both tiers die only when Dima drops them.

## legend

- ⏰ — ordinary, raised at a natural moment
- ⏰📌 — stuck, raised at every boot
- 🦉 — set by the agent for itself; no 🦉 = Dima's ask
  - 👁️ watching a metric
  - 📜 keeping a doc alive
  - 🔬 a probe to run




⏰ 🦉📜 spawning-mechanics artifact freshness — `docs/knowledge/spawning-mechanics.md` verified against cc 2.1.283 (2026-09-27, run #3 of `refresh-crew-coordinator`: no row flipped; the compaction hooks proven end to end); re-run the procedure when the cc version changes, or when a spawn behaves against a [verified] row. the subagent stack row is [volatile] — the first thing run #3 probes — set 2026-08-30












⏰ 🦉👁️ the `@types/react` override in bytes `pnpm-workspace.yaml` — set 2026-09-21 because `@visx/event` (via `prisma` → `@prisma/studio-core`) still ranges `@types/react` 19.2.x and next's styled-jsx types resolved the hoisted copy, breaking every `React.X` global-namespace use on 19.3. raise when parallel monitor `186f30a4` (weekly) fires, or at an evergreen major of `prisma` or `@visx/*`: remove the two override lines, `pnpm install`, `ls node_modules/.pnpm | grep '@types+react@'` — one version → the override is dead, commit the removal — set 2026-09-21


⏰📌 🦉👁️ the daemon spare that skips AGENTS.md — every `--bg` coder claims a pre-warmed `claude bg-spare`; a day-old spare booted one WITHOUT the repo's root `AGENTS.md` (2026-09-22, ccbee7b0), a minutes-old spare loaded it. the workaround is the spawn preflight in `x:crew-lead` (spare age → `claude daemon stop --keep-workers` after the throwaway probe → spawn). watch: (a) every coder's first reply names its loaded AGENTS.md paths — a missing root file means the preflight leaked; (b) upstream [#95589](https://github.com/anthropics/claude-code/issues/95589) (our comment carries the spare-age table) — the gh watch (boot digest). dies when the issue closes fixed and one post-fix coder boots complete on a stale spare — then the preflight line goes too. dima's ask 2026-09-22: «keep an eye on this until it's fixed on the claude code side, so we know when to remove this tracking habit» — set 2026-09-22













⏰ 🦉🔬 NPSSO lifetime — dima pasted a fresh local NPSSO on 2026-09-27 ~20:55 (trophy-sys `/console`, main checkout); the old one died on «day 15» while trophy-sys's AGENTS.md says 10. measure: start the app with `trophy-sys-run` and read `curl -s -o /dev/null -w '%{http_code}' localhost:5177/api/profile` on 2026-10-07 (day 10), then daily from 10-10 until the first 500 `NPSSO_INVALID`; that day is the lifetime → BYT-85's body + trophy-sys AGENTS.md — set 2026-09-27

⏰ 🦉👁️ jotai 3 waits on jotai-devtools — bytes pins jotai 2.20.3 in atelier + x-com-chat (e36e7599): jotai-devtools 0.14.0 imports `INTERNAL_buildStoreRev3`, gone in jotai 3, and x-com-chat's prod build broke on it (c637fbe2) though its peer range says `>=2.20.0`. v3 support is merged (jotaijs/jotai-devtools#222) but ships only as 0.15.0-alpha.0. raise when parallel monitor `c42c0b74` (weekly) fires or evergreen shows a jotai 3 card: hold it (close with this reason) until `npm view jotai-devtools version` prints ≥ 0.15.0, then lift jotai + devtools together, proven by a local `pnpm --filter x-com-chat build` — set 2026-09-26


⏰ 🦉👁️ pr auto-fix default — the desktop Code tab's «Auto-fix pull requests» setting does not persist (checkboxes reset per pr), [claude-code#90751](https://github.com/anthropics/claude-code/issues/90751). raise when the gh watch (boot digest) fires: re-test the default on a cloud pr, then decide it for pr-lane coders — today it stays off there, because auto-fix answering review comments would fight the verifier loop. dima 2026-09-28: «monitor it» — set 2026-09-28


⏰ 🦉👁️ tart on brew 7 — `brew install cirruslabs/cli/tart` dies on brew 7 (`depends_on :macos` outside `on_macos`, tart.rb:22), [cirruslabs/homebrew-cli#21](https://github.com/cirruslabs/homebrew-cli/issues/21). until then FRM-147 runs the checksum-checked 2.32.1 release binary from a job tmp. raise when the gh watch (boot digest) fires: `brew install cirruslabs/cli/tart`, and the release-binary line leaves the seed docs — set 2026-09-28


⏰ 🦉👁️ the official `typescript-lsp` on TS 7 — [claude-plugins-official#4492](https://github.com/anthropics/claude-plugins-official/issues/4492). raise when the gh watch (boot digest) fires: re-enable `typescript-lsp@claude-plugins-official`, delete `plugin-x/.lsp.json` + `plugin-x/lsp/typescript-native/` (+ its biome exclusion), re-run the day-0 hover + references + diagnostics probes (`docs/test-drive/ts-lsp.md` log). the TS side, [TypeScript#63921](https://github.com/microsoft/TypeScript/pull/63921), rides the gh watch: when it merges the vendored bridge turns itself off — confirm diagnostics still arrive. dima prefers the official plugin (auto-updated) — set 2026-09-30



⏰ 🔬 model refresh re-run, 2026-12-24 (12 weeks) — fired 2026-10-07: haiku 5.5 shipped (per the refresh-crew-coordinator researcher lane; the parallel monitor saw nothing by its 19:02 pass and is cancelled). the re-run rides the next `refresh-crew-coordinator` run; dima 10-07: «don't expect to find much about haiku 5.5 tmrw, because it's just released, and usually at least ~a week passes after a model release before sources are seeded with bench data. but general info about haiku 5.5 won't hurt, as initial info. very curious what haiku 5.5 can do now.» → a second haiku pass ~10-14 for the bench data. also re-run the skill router's haiku arm (arm 5, `docs/research/skill-router.md`): haiku 4.5 lost to jev 27 % vs 75 % on 10-05, dima: «we may re-measure it as a potential classifier when it's released» — sonnet 5.5 was 3 days old at the 10-01 run, so its effort/helper-lane data was thin (no edit or research-quality test existed); run `recipes/refresh-crew-coordinator/recipe.md`, latest anthropic models + one generation back. dima 2026-10-01 (inbox): «if the research is very young … set a reminder to do another refresh in 12 weeks» — set 2026-10-01

⏰ 🔬 `/advisor` head-to-head with ccrow, from 2026-10-09 — dima, 2026-10-08: «test `/advisor` with you, measure it, compare to how ccrow works. i feel our custom ccrow can be better. borrow the best parts of the built-in into ccrow — or, if the built-in is straight better, use it instead.» cclio runs `/advisor fable` for a day beside ccrow; both log into `docs/test-drive/ccrow.md` (notes, acted on, tokens). feeds `refresh-crew-coordinator-adviser`'s /advisor vector. verdict 2026-10-11 16:23: dropped (dima ran `/advisor off` after 18 rounds; report in the thread); the borrow is [FRM-396](https://linear.app/x-com/issue/FRM-396); this line dies at the next halt.

⏰ 🔬 haiku 5.5 research, 2026-10-15 and again 2026-10-22 — shipped 2026-10-07, data thin at launch (dima, 2026-10-08: «use-case and measures data might appear»). one `research:lanes` round each: independent benches, effort curves, who runs it for what, cache prices; fold into `docs/knowledge/models.md` and `refresh-crew-classifier`'s engines vector. dies after the 10-22 round lands.




⏰ 🎬 b-roll, when dima next makes a video — the test drive is done (dima 2026-10-02: «save it until the next time I decide to do some video and sharpen this flow too»). the engine is decided: HyperFrames (local, cloned at `~/Movies/motion-broll/hyperframes-src`, `pnpm exec`, no account; telemetry off via `HYPERFRAMES_NO_TELEMETRY=1` + `DO_NOT_TRACK=1`) with motion-broll's scenes ported in as templates — the one-scene port proved it (`~/Movies/motion-broll/hf/videos/speak-port/output.mp4`: select → F4 → pill morph, head-to-corner, 66 s render, lint clean; limits: one hosted scene per page until stage ids are namespaced, no motion blur yet). per-segment treatment picked by dima at the plan step: face only · overlay · head-to-corner · full cutaway. evidence: `docs/test-drive/motion-broll.md`. on that day:
  - first, before any plan: peek into [whatships.com](https://whatships.com/) for inspiration (2.3k launch videos with an agent index) and print dima 3–5 moves worth borrowing (dima, 2026-10-02: «a reminder to peek into it before i ask for the next b-roll/hyperframe video»)
  - build a thin global user-only skill (`home/.claude/skills/<name>`, `disable-model-invocation`) + `recipes/refresh-broll/` (per `x:shape-recipe`)
  - sharpen the flow with his asks as they come during the try (dima: «I have a lot of requests to sharpen, but that's not now»)
  - find a better home for takes — `~/Movies/motion-broll` «is far away and hard for me to open»
  - the want: «product demos for our apps, sometimes a readme clip, or just a random fun clip i could send to someone via telegram or slack, for example describing what i achieved during the week» · face cam now, a speak voice-over later (the weekly recap needs no footage) · look from each app's `DESIGN.md` · a finished video, no editor — «the editor turned out useless for me, so it'd probably just be a maintenance burden» · rarely, the recipe runs on use — set 2026-10-02

⏰ when the speak build closes ([FRM-288](https://linear.app/x-com/issue/FRM-288)), ask dima which goes next: the memory + skills sweep ([FRM-267](https://linear.app/x-com/issue/FRM-267), read `docs/research/skill-authoring-best-practices.md` first) or the cli re-shape ([FRM-284](https://linear.app/x-com/issue/FRM-284)). dima 2026-10-02: «sweep second or cli - decide after speak» — set 2026-10-02


⏰ 🦉👁️ mods over remote control — [claude-code#99217](https://github.com/anthropics/claude-code/issues/99217) (our 2.1.289 repro is a comment there): mods draw only on the host surface, never in the desktop/iOS view of a `--remote-control` session; also the desktop refuses a mod `Client` module (10 s, CSP). raise when the gh watch fires: re-test breather + stash in a terminal-born session viewed from the Code tab. until then cclio boots from the Code tab (dima, 2026-10-04) — set 2026-10-04



⏰ 🦉🔬 skill router re-measure, 2026-10-19 — v2 (FRM-305, #57) merged with the router OFF: on 32 real held-out prompts the best arm read 75 % precision / 15 % wrong, the turn-on bar is 90 % / 5 %. until then every halt adds ≥ 10 real prompts from the day's transcripts to `shelf/jev/fixtures/skill-router.jsonl`, labelled by what should have loaded (the living eval set, `refresh-crew-classifier`). on 10-19: replay on ~100 real prompts beside the haiku baseline arm; turn on, rebuild, or drop the router. dima 2026-10-05: «a + b» — set 2026-10-05


⏰ 🦉📜 refresh-cc-mods at every cc minor that touches mods — at each cc version bump read the changelog for mod/function-hook lines (new events, `$` methods, render sites, limits, surfaces); any hit → run `recipes/refresh-cc-mods/recipe.md` (its «next run» list holds the hot leads from 10-05). dima 2026-10-05: «write it while your traces about mods are hot» — set 2026-10-05

⏰📌 🦉📜 the frame → bytes merge, one slice per lane — every lane takes one session-sized merge slice beside its main work, in the order of `docs/research/monorepo-agents.md` (turbo wins → the lockfile probe → step 0: clone-and-rename, git-crypt out, a launchd deploy step → m1 the apps → hooks merged + `mirror` scoped → frame's infra last); each slice leaves both repos working and is proven by a check. re-sliced 2026-10-06: S1 → BYT-106, S2 → BYT-125, step 0 → FRM-330 / FRM-331 / FRM-332, m1 → BYT-126 + BYT-109, hooks → FRM-333, in that sortOrder; m4 is re-sliced once those land. dies when m4 closes. dima 2026-10-05: «plan the bytes merge so it's gradual, mixed between our lanes, part by part and not folded into a long shelf» — set 2026-10-05









⏰ 🔬 comms-trim verdict, 2026-10-15 — the crew pings cclio on three events only, retros go to `shelf/retros/`, round lines are gone (dima, 2026-10-08). each halt prints the comms count and the `comms:` gaps; on 10-15 decide keep / loosen, then drop the `until 2026-10-15` lines in crew-coder, crew-verifier, crew-designer, x:crew-lead and the halt skill — set 2026-10-08
⏰ 🐦‍⬛ ccrow keep-hot test, at the 10-09 halt — do NOT stop ccrow: leave it parked, no wakes, no messages, idle >50 min; check its transcript for a stash keep-hot ping and a warm `cache_read` on the turn after it; then dima archives ccrow himself — set 2026-10-08

⏰ 🐦‍⬛ at the next halt: park ccrow, never stop it — dima runs his own keep-hot test and watches it himself (the stash pings fired every 50 min overnight, cache held warm, `docs/test-drive/ccrow.md` 10-09). dies when dima says his test is done. dima 2026-10-09: «keep ccrow for my own keep-hot test … keep it parked, so I will keep an eye on it» — set 2026-10-09

⏰ 🫙 the pocket a/b — Backlog.md is live (`cclio/pocket/`, brew `backlog-md`, alias `pk`), the old file frozen as `_pocket.md`. every boot reads `pk task list --plain --sort ordinal` (without the flag it sorts by id) and `pk doctor` (from a script: `BACKLOG_CWD=~/frame/cclio backlog …`) instead of it; every inbox drop becomes a `pk task create`; the halt writes one a/b line into `docs/test-drive/backlog-md.md`. dies at the trial verdict. dima 2026-10-09: «go fully set up backlog.md side by side with the pocket, for an a/b test» — set 2026-10-09

⏰ 🦡 before every halt: dima runs his own retro in this thread, and in ccrow's window he types «read /Users/dima/.claude/plugins/cache/mattpocock/mattpocock-skills/<version>/skills/engineering/retro/SKILL.md and run it over cclio's session from your packets; focus: <his steer>» (`ls ~/.claude/plugins/cache/mattpocock/mattpocock-skills/` names the version). cclio reminds him, then runs its own retro beside it, one flush. dima 2026-10-07: «yes remind me» · «i want to gather the retro from ccrow myself next time» — set 2026-10-07, moved from the pocket 2026-10-09

⏰📌 🦉🎨 the next atelier touch carries [BYT-127](https://linear.app/x-com/issue/BYT-127) (lottie / rive test drive) into its brief — dima, 2026-10-10: «pick it up next time we touch atelier, but don't forget». dies when BYT-127 starts — set 2026-10-10
⏰ 🦉📊 the #dima-caught recheck — 2026-10-25: `x fleet flow --days 14` vs today's 31 (baseline 23), tallied by type with a sifter this time; the 06.5 ledger line in `docs/test-drive/memory-sweep.md` names it — set 2026-10-11
⏰ 🦉🧠 when the jev router comes back on (credit ~10-18): the two «skills (jev router)» lines parked at the end of `sys-jev.md` go back into root `CLAUDE.md` § skills — set 2026-10-11
⏰ 🦉🔀 2026-10-25, with the #dima-caught recheck: count Agent + `run_in_background` calls per cclio session for 14 days vs the 14 before 10-11 (duckdb over transcripts) — root's parallel-work lines were cut to one on 10-11, dima: «let's try to delete and see how your performance changes» — set 2026-10-11

⏰📌 🦉🎨 a small UI ask on an app the design flow covers (atelier now, speak next) goes to a coder with its `DESIGN.md` + a live screenshot, no designer; one rounds line in `docs/test-drive/design-drift.md` (dima, 2026-10-11: «keep this trial reminding me to run a coder on applicable apps») — standing — set 2026-10-11
