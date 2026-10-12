---
kind: nurture
owner: coordinator
artifacts: [home/.claude/plugin-x/skills/author-memory/references/skill.md]
script: none
groomed: 2026-10-11 (dima)
was: [nurture-skills-hillclimb]
---

# nurture-skills

keeps every skill lean, clear, firing when it should, and in agreement with resident memory. sibling of [nurture-memory](../nurture-memory/recipe.md): a memory sweep runs this one as its step 9.

## the want

dima, 2026-10-11:

> «then do the same with skills: review each skill and groom, trim, cut, and rebalance the info load across the other parts where it makes most sense.»

> «i want all skills to be lean and clear, while not conflicting with resident memory.»

> «skills should be shaped via the best practices defined in our skills knowledge.»

his standing call, 2026-10-06: a skill nobody fires that costs context is a prune candidate before any hillclimb.

## the run

- **the knowledge is the rulebook**: every groom follows `author-memory/references/skill.md` and matt's `writing-for-agents` (its `SKILL-MECHANICS.md` for frontmatter and invocation), loaded before the first edit.
- **one home per line**: a skill line that restates or contradicts resident memory, or another skill, keeps one home; the other becomes a pointer or goes.
- **a description edit is proven by `claude plugin eval`**, never by reading.
- **his working rules**, as in `nurture-memory`: no auto-commit, a per-item report, and every action traced in the sweep's run file the same turn.

1. **groom this recipe** — `x:shape-recipe` step 0. done: dima's word, `groomed:` stamped. (open)
2. **research** — the vectors below, all lanes at once (`x:shape-recipe`). done: every lane landed or failed out loud. (template)
3. **the distill** — into `author-memory/references/skill.md`, concise without dropping a useful line; bytes before and after. done: the doc touched or «unchanged», sizes logged. (open)
4. **the census** — per skill: fire count, last use, token cost, from `refresh-fleet-ops`' skill-load measure and `/skill-doctor` (terminal only, dima types it). done: the ranked list in the run file. (script)
5. **the conflict hunt** — every skill against resident memory (root `CLAUDE.md`, `rules/`, cclio leaves) and against its siblings: a duplicated or contradicting line gets one home. done: every hit verdicted. (open)
6. **the groom**, one skill per round through `x:step-by-step`, census order: (open)
   - a completion criterion that can be checked, or why none
   - keep, trim, merge or drop
   - the description leads with WHEN; a pair gets symmetric descriptions
   - steps tagged by freedom, a fragile one becomes a script
   - contents past 100 lines
   - tables become bullets
   - a heavy human-only skill gets `disable-model-invocation: true`
   - entity-first names carry a scope (`x:*`, `cclio:*`)
   - the info load rebalanced: what every branch needs stays inline, the rest behind a pointer
   - **Claude B**: a fresh session runs one real ask per changed skill; an unopened file or a skipped step sends it back
   - done: every skill verdicted, each changed one past Claude B
7. **the fire loop** — only for a skill with a miss (a flawlog «skill not loaded» line, a router near-miss 0.30–0.70): dima's real prompts as `plugin-x/evals/<skill>-*` cases, split train and held-out test (`cmt`, `notes`, `pm` are the pattern); a baseline `claude plugin eval` on both; change one thing, keep it only if train rises and test does not drop; a round cap set first; each round logged in `docs/test-drive/`. done: every missed skill looped or capped. (template)
8. **log** today's line in `log.md`. done: the line is there.

## vectors

### research

- what changed in cc's skill mechanics since the last run: loading, descriptions, `disable-model-invocation`, plugin evals, `/skill-doctor`
- anthropic's skill best-practice pages, the delta since the snapshot in `docs/research/skill-authoring-best-practices/`
- prior art in skill evals and hillclimbing: `author-memory/references/skill.md` § evals — prior art

### analysis

- the flawlog's skill misses since the last run, `#dima-caught` first
- the census: skills that cost context and never fire
- skills against resident memory: where they restate or contradict it
- `x:crew-coder` and the other crew skills against the 5k-token re-inject cap

## artifacts

- `home/.claude/plugin-x/skills/author-memory/references/skill.md` — the skill authoring craft and its evals prior art; the distill folds new mechanics and our rules in

## findings

beyond the shared shape:
- tokens per skill before → after
- fire rates for every looped skill, train and test
- what moved, merged and died, each with its reason
