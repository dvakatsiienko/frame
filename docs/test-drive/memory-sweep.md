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
