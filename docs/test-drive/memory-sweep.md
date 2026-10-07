# memory sweep — the log

the trace of every ask, steer and decision across the sweep ([FRM-267](https://linear.app/x-com/issue/FRM-267), pocket 10), memory and skills and recipes; the input of the sweep retro. dima, 2026-10-07: «important, it will help us to do the sweep retro, once actual sweep is done». closes with the verdict: keep the nurture flow as a recipe, or refold it as a skill.

his full brief: the vault note `_hq/memory-sweep.md` (read 2026-10-07).

## the grill

### round 1 · 2026-10-07

- **the plan:** `.scratch/memory-sweep/`, a spec plus one ticket per phase; FRM-267 keeps want, exit and a pointer — the pocket's first real spec
- **the order:**
  - baseline
  - research
  - **recipes first** — dima: «process recipes first, before actual nurture-* recipe set is used for actual sweep, so the sweep runs on new settled recipes shape»
  - **the prompt-audit early** — dima: «where is the step from claude-api prompt-audit? it should be one of the firsts steps»
  - dupes
  - buckets
  - the leaf pass
  - skills
  - the global review
- **delete-first:** dima: «the delete-leaned is a deliberate choice, and is justified. memory became bloated … previous memory sweep was incredibly chaotic … so this sweep have to be much better. let's aim for lightweightness» · «the fact that memory became bloated is probably caused by «do not delete» invariant. it is designed to protect, but acts as double edged sword against memory. it encourages cluttering by protecting from deletions». memory, skills and recipes are in git, so a delete is reversible; deletes go out in one batch per phase with a reason each, one approve, the text quoted here
- **the coordinator split:** dima: «one of the biggest wins. for example, so far you did not even spawned even one --bg session today (except ccrow). so ~1m tokens today was using your whole spawning memory module with no use. how to modularize your memory, so you won't use whole monolith but lazyload rarely used memory parts, while keeping essentials always resident?» — (a) spawning leaves the resident set inside the sweep; (b) the squad leader is shaped after it
- **the adviser:** ccrow with a sweep brief — checks every delete batch and rewrite against this log, and «think on its behalf on how to improve and streamline our memory system»
- **the target:** dima: «make everything as efficient as possible. half the cut is good. i'd be glad if your total start would be at ~50k. and less than 100k after full boot»
- **the children:** in — the plugin + mcp prune, FRM-220, FRM-184, FRM-238 per skill; out — FRM-243 (jev frozen), FRM-239 (→ x verb verdicts), FRM-270 (after)
- **pacing:** dima: «observe, suggest, don't stress to much i keep an eye»

## baseline (dima's measure, 2026-10-07)

- cclio at boot: 117k (memory files 81.2k, skills 8.2k); after init 188k (+51.8k message)
- this thread after a compact (`get_usage`, 2026-10-07 15:43): memory files 71.4k · system tools 28.5k · MCP tools 17.1k · skills 14.6k · system prompt 9.2k
- the biggest resident files by bytes: `craft-spawning` 42.9k · `_reminders` 24.0k · root `CLAUDE.md` 14.6k · `craft-pm` 13.9k · frame `AGENTS.md` 12.9k · `fleet-output-format` 11.9k · `fleet-hazards` 11.0k · `dima-stories` 10.6k

### round 2 · 2026-10-07

- **four tiers:** resident · hook-lazy (deterministic trigger, the `memory-load-rule-lazy` mechanism widened) · skill-lazy (rituals) · on demand by pointer. dima's catch: «to spawn a ccrow (on boot) you probably will want to load whole craft-spawning? which is too large … which lazyloaded modules could be split even more? and it should work! you should not forget to actually load relevant memory modules, once you need them» — ccrow starts through `pnpm ccrow:ensure`, a script, so the boot needs no spawn memory; `craft-spawning` splits by trigger (round 3)
- **the floor depends on the born place:** dima: «when born in terminal, you weight less. c desktop app code tab born weights … +~10k roughly, desktop app capabilities like additional mcps, builtin browser support etc. these are not removable, only changeable via born place» — every measure names its born place
- **targets:** memory files 71k → ≤ 25k · MCP tools 17k → ≤ 8k · skills 14.6k → ≤ 9k · ≈ 80k at boot, ≤ 100k after init
- **`dima-stories`:** off the resident set, kept — dima: «i am OK if my stories are useful»; the halt appends, the retro and the sweep read it
- **point of view:** b, «we use…» for shared rules; a only in a passport; c only in dima's quoted words
- **markers:** ✅ do (most lines) · ❌ don't with the wrong example, beside a ✅ · 🚫 banned, one section per file; 📌 and ⚠️ unchanged
- **cross-refs → block html comments** (stripped before injection, measured on `CLAUDE.md` at cc 2.1.241; re-probed on an imported leaf and a `rules/` file in the baseline)
- **a rule a hook enforces is deleted** — `fleet-output-format` shrinks by what reply-check catches. tests: dima: «i'd keep maybe one or few lines in root claude.md, saying that tests are encouraged, overall-type-of-things, and a pointer to guide-code for details. or maybe guide-tests?»

### round 3 · 2026-10-07

- **`craft-spawning` splits by trigger:** spawn-core (first `Agent` / `claude --bg` / `--cloud`), the coder loop (`crew-coder` / `crew-verifier`, a `SendMessage` to a member), models (a `--model` in a spawn), the shared tree (worktrees); the measured evidence moves to `docs/knowledge/spawn-mechanics.md`. the hook refuses the first matching call with the module as its reason, and a prompt-word trigger loads spawn-core while planning; proven in the global review by a fresh session spawning a coder
- **`x:guide-tests`** beside `x:guide-code`; root keeps two lines and the pointer
- **a `shape-*` family:** `x:shape-test-drive` replaces the resident `habit-test-drive`, `x:shape-recipe` replaces `_spec.md` + `habit-recipe-first`
- **the order, amended twice by dima in round 1** (ccrow caught that it was never shown back whole): 0 baseline + prompt-audit scan · 1 research · 2 recipes, the full reshape · 3 dupes · 4 buckets · 5 leaf pass (audit findings applied) · 6 skills · 7 recipe runs · 8 global review
- **recipe candidates join phase 2:** dima: «scan a system for more recipe candidates. what activities do we do what would like to want a recipe? (frequently do activity recipe missing). for example: guide-tests does not have a recipe. what are test writing best practices for agents? how to prevent agents from writing useless tests, and only have useful tests? and it should complement matt's tdd» — [FRM-270](https://linear.app/x-com/issue/FRM-270) moves in
- **measures fold into `refresh-agent-ops`** (guard refusals per rule, skill loads, dima's wait, cost per member), duckdb as the engine; the baseline runs two of them

## phase 01 · baseline · 2026-10-07 18:07

born place: the desktop Code tab, cclio after `/compact` + the checkpoint-2 ingest (`get_usage` self, 18:05)
- memory files 71.7k · messages 66.6k · system tools 28.5k · MCP tools 17.1k · skills 14.6k · system prompt 9.2k · total 210.9k / 1M
- a bare-cc floor: not measured yet (`-p` has no `/context`)

resident bytes, top 10: `craft-spawning` 43.1k · `_reminders` 24.0k · root `CLAUDE.md` 14.6k · `craft-pm` 13.9k · frame `AGENTS.md` 12.9k · `fleet-output-format` 11.9k · `fleet-hazards` 11.0k · `dima-stories` 10.6k · `sys-jev` 6.2k · `dima-strategy` 5.6k. the two biggest leaves are 31 % of the resident bytes

block html comments: **stripped** in `CLAUDE.md`, in an `@`-imported leaf and in a `.claude/rules/` file — a haiku `-p` probe saw the plain-text controls (PROBE-C, PROBE-E) and none of the three comments, cc 2.1.292. cross-refs can move into comments everywhere

duckdb, 30 days of transcripts (1,079 files, 1.7 GB, 1.4 s):
- skill loads, top: `x:cmt` 128 · `x:pm` 91 · `x:guide-code` 90 · `writing-for-agents` 71 · `x:github-contrib` 60 · `x:browser-headless` 59 · `x:guide-typescript` 53 · `x:handoff` / `x:handoff-ingest` / `x:notes` 35 each; 40+ skills with ≥3 loads
- guard refusals: ~21 real ones — gate piped (4), obsidian mv (4), pnpm without `--silent` (4), no safe door (3), zsh `$S:` (2), overwrite (2), staging a missing path (2)
- lazy-rule loads and misses: in `docs/test-drive/memory-load.md` (`pnpm memory-load:replay`), not re-counted

open: `/skill-doctor` + `/doctor prompt-audit` (typed in a terminal), the `claude-api` prompt-audit (an agent, → `.scratch/memory-sweep/prompt-audit.md`)
- prompt-audit (`claude-api` procedure, an opus agent, 241k tokens, 4 min) → `.scratch/memory-sweep/prompt-audit.md`: ~105 KB of 206.5 KB resident can go (~−26k tokens, bytes ÷ 4); memory files −60 % → ~28k, still over the ≤25k bar. top: `craft-spawning` → a skill + stub (−37 KB) · `_reminders` off-resident, the boot prints the stuck ones (−24 KB) · `sys-jev` + root line describe the router as live while `router.off` exists (−5.4 KB) · `craft-pm` mechanics into `x:pm` (−6.4 KB) · `fleet-hazards` lines whose guard exists (−5.5 KB). contradictions: ctx7 trial end 10-07 vs 10-09 · «every reply ends with ➡️» vs «quick answer: no next step» · emoji «generously» vs «judiciously»
- skill use, 30 days (`/skill-doctor` answers «not available on this connection» in the desktop; duckdb over the transcripts instead, model `Skill` loads + typed `/name`): zero use — `x:sweep-issues` (209 lines), `x:guide-go`, `cclio:report`, `x:pre`, `x:mobile-mode`; 1–2 uses — `cclio:shift`, `x:crew-cloud`, `x:crew-designer-interview`, `x:app-essentials`. descriptions over 300 chars (resident every turn): `guide-conventions` 388, `art-kit` 384, `guide-code` 337, `browser-headless` 330, `app-essentials` 307, `notes` 303. bodies over 200 lines: `x:pm` 279, `x:cmt` 224, `crew-coder` 210, `sweep-issues` 209, `cclio:evergreen` 200. typed counts miss `--bg` spawn prompts

## phase 02 · research · 2026-10-07 18:17

- lanes: exa (123 s, $0.10) · parallel (228 s) · `researcher` on the video rules vs our docs (265 s, 105k tokens) → `.scratch/memory-sweep/research/`
- self-memory, the agreed core: a hard resident budget that fails visibly · stable provenance per line (source, verify, trigger, last use) · usage nominates, never deletes · one batched digest of ≤5 clusters, per-item yes / keep / later, no «approve all» · rejected proposals logged so they never resurface · the old text stays recoverable (git)
- the split: exa leans on measured length/density losses; parallel found a 1,650-session study with no size effect for one simple rule — the cost is stacked constraints and irrelevant context, not line count itself
- video rules: mostly folded already; the 100-line preview applies only to a file linked from a linked file; third person bans only «I…» / «you…», none of our 31 descriptions use them; resident files have 0 «think carefully» lines

### dima's verdicts · 2026-10-07 18:41

- prompt-audit: «suggest the slice → i go read its part in prompt audit → process → clear that part up once done → file dissolves incrementally»
- `craft-spawning` → a skill for «an independent coordinator for a squad (e.g., coordinator/coder/verifier)»; his name: crew-coordinator, asks for others
- `sys-jev`: «disconnect it until jev is unfrozen» → the barrel line stays as a plain pointer, no `@`
- ctx7 dates in two places: «only one trial period date place should be source of truth, do not scatter» → `fleet-tooling` drops its date, `_reminders` holds it
- ➡️ vs a quick answer: «fix» → `fleet-output-format` names the exception
- skills: `x:pre` deleted (his word); `x:mobile-mode`, `cclio:shift`, `x:crew-cloud` («$236 of $250 left, expires november 5»), `x:crew-designer-interview`, `x:app-essentials` kept; `x:sweep-issues` and `cclio:report` — «judge for yourself»
- descriptions: «they also contain useful data … groom them, keep useful parts but reduce size»
- memory shape: «you can handle large memory, it just needs to be written in a way so you apply it to yourself efficiently. good structure, good shape, and good vectors set for you via properly described sentences»
- the doctors: «plan a run from CLI next time i boot you»

### the fresh-boot baseline · 2026-10-07 ~18:55 (dima's terminal, Warp)

born place: a **terminal** `claude` in `~/frame/cclio` (not the Code tab), monitors already armed
- before `/cclio:boot`: 124.3k total — memory files **80.1k** · skills 8.2k · messages 7.6k · MCP tools 0 (loaded on demand) · custom agents 776 · system prompt 6.5k · system tools 20.8k
- after `/cclio:boot`: **153.2k** — memory 80.1k · messages 36.5k (the boot ritual costs ~29k)
- the Code tab (this thread, 18:05) for comparison: MCP tools 17.1k (resident there) · skills 14.6k · system tools 28.5k · system prompt 9.2k → the desktop born place costs **~33k more** at the same memory
- 📌 memory 80.1k in the terminal vs 71.7k in the compacted Code-tab thread: unexplained yet (one ? to measure at phase 09 in the same born place)

### `/skill-doctor` (now the plugin manager's Stats tab, cc 2.1.292) · 7 days

- most tokens attributed: `x:cmt` 162m (236×) · `x:ftr` 117m (27×) · `x:github-contrib` 116m (65×) · `x:guide-code` 113m (123×) · `crew-coder` 80m (44×) · `x:pm` 76m (135×) · `writing-for-agents` 57m (107×)
- heaviest listings (context every turn): `typesafe-ai` ~230 (4 uses) · `writing-for-humans` ~160 · `humanize` ~160 · `code-review` ~150 · `guide-conventions` ~130 · `guide-code` ~120 · `ai-check` ~120
- plugins unused: `context7`, 15 days → feeds the ctx7 verdict (10-09)
- 📌 «7d tokens» counts the whole session around a load, so `x:ftr` at 4.3m per load is likely context, not the skill itself (inference)

### dima's verdicts · 19:02

- emoji: «I just like emojis. Probably "generously" would be wrong, so let's use judiciously. i like emojies but not when confetti pops from everywhere» → `fleet-voice`
- the squad skill: `x:crew-lead` ✓
- specs are archived, never deleted → `docs/agents/issue-tracker.md`, pocket 34
- the delete digest: yes — «hunt redundant memories each time, and also propose grooms, trims to keep it tidy»
- provenance light: «i agree if it makes sense to you»
- `x:sweep-issues` + `cclio:report` deleted (their two ideas already live in `crew-verifier`) · audit slice 1: `_reminders` off the resident set
