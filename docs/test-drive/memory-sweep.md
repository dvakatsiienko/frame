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
