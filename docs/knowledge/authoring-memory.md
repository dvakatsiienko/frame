---
researched: 2026-08-23
sources-current-as-of: cc 2.1.296 · code.claude.com/docs memory · arXiv 2608.11095 · arXiv 2605.10039 · claude.dev blog 2026-07-24
refresh-when: `paths:` scoping, html-comment stripping, or the 200-line target changes in the cc docs — rerun the probes below
ticket: DOT-216
---

# memory authoring — where a fact goes, decided before it is written

## contents

- the buckets — audience decides
- the pre-write checklist
- the mechanics, and their probes
- what the measurements say
- the context budget
- where a rule comes from
- precedence
- what never goes in
- hazards that bite silently
- how the files are organised
- the method, when a file needs rethinking
- upkeep is mechanical
- the groom card

sibling to `authoring-skill.md`: that one is how to write a skill, this one is where anything written belongs. **placement is decided before the write, not repaired after it.** claim tags: **[measured]** run here or in a published experiment · **[read]** anthropic's docs or a paper · **[inferred]** our judgment, untested.

## the buckets — audience decides

🎯 **audience decides, never topic.** a memory lands in the widest bucket whose whole audience benefits.

- **root `~/.claude/CLAUDE.md`** — every session, every project. test: would a new session in any repo be worse without it?
- **`~/.claude/rules/*.md`, no `paths:`** — the same audience, one granular area per file so root stays lean. test: worth paying for in every session on the machine?
- **`rules/*.md` with `paths:`** — a convention tied to a kind of file or a directory. test: does a glob name when it matters? a topic or an intention has no glob
- **`~/projects/AGENTS.md`** — every coding session, no coordinator; a deliberate stub today
- **a project `AGENTS.md`** — that one project (`authoring-memory-project.md`). test: wrong or meaningless in another repo?
- **`cclio/memory/*`** — the coordinator only. test: would a coder be misled by it?
- **a skill** — a procedure, or anything needed occasionally; on demand, never resident. test: would someone invoke it by name?
- **a hook, `settings.json`, `permissions.deny`** — anything that must happen. «always» or «before every» is enforcement, and memory is context, not enforcement **[read]**
- **`docs/`** — long, occasional, or a lookup, read on demand

📌 **the worked example:** pnpm feels coder-specific, but any session may run it, even in `~/frame`, so it lives fleet-wide in `rules/fleet-tooling.md`; a trap that bit 2+ repos goes to `rules/fleet-hazards.md`.

📌 **anything only one surface needs is a peek-on-demand doc, never a rule.** `fleet-identity.md` grew fat this way: every coder paid for capabilities of surfaces it will never be.

🚨 **memory supplies knowledge, never capability. [measured]** a root registry of switched-off mcps was meant to let the agent turn one on when needed; there is no `claude mcp enable` and a server binds only at session start, so the registry bought awareness of a wall at full resident cost. dima: *«test failed = you can't. it only creates a mess in memory file.»* a memory that asks the agent to do something to the system names the exact call, or the job moves to `settings.json`, a hook or `permissions.deny`.

## the pre-write checklist

1. **who needs this?** the buckets above
2. **what does it cost?** a `rules/` file with no `paths:` is resident in every session forever; a skill description is resident; a command or a doc costs nothing until used
3. **does it already exist?** a second copy is worse than none: the two drift and nobody can tell which is live
4. **a fact, a rule, or a story?** different homes, different decay rates
5. **a measurement or a standing fact?** a dated «as of» line is a measurement and belongs in the commit that measured it; two went stale within a day (2026-09-08)
6. **can the agent find it by looking?** scripts, layout, `--help`: a doc restating them is a stale cache. cache only the unwritten convention, the reason, the gotcha

## the mechanics, and their probes

- **block html comments** — `<!-- … -->` is stripped before injection: free storage for the why. **[measured]** in a `CLAUDE.md`, an imported leaf and a `rules/` file (cc 2.1.292; re-run on 2.1.296, haiku + sonnet, 2026-10-11); a directly read AGENTS.md is unproven
- **`paths:` frontmatter** — a `.claude/rules/*.md` with `paths:` is absent at boot and fires on touching a matching file, never on an intention. **[measured, cc 2.1.296, 2026-10-11]** opus 5.5 and sonnet 5.5, 3 tries each, 24/24: it loads on Bash `cat` and `Edit` of a matching file, and on a `Write` followed by a read; touching nothing matching loads nothing. haiku: `Read` loads it too, a bare `Write` of a new file does not. (cc 2.1.288 / 2.1.293 widened it — before, only `Read` fired.) 📌 the rule arrives inside the tool result: written as a secret token, haiku flagged it as injected text; written as a project convention, every opus and sonnet run used it. a scoped rule reads as a plain project rule
- ❗ **a wrong frontmatter key** — `globs:` is not a key; the rule silently loads unconditionally. **[measured]**
- **`@imports`** — expand at launch: they buy organisation, not context **[read]**
- **size** — under 200 lines per `CLAUDE.md`; over 4 MiB is skipped **[read]**
- **`MEMORY.md`** — the auto-memory index is cut at 200 lines or 25 KB, the rest dropped on load **[read]**
- **delivery** — `CLAUDE.md` arrives as a user message after the system prompt: context, never enforcement **[read]**
- **compaction** — the project-root `CLAUDE.md` is re-read from disk after `/compact`; nested files and `paths:` rules reload only when re-matched; conversation-only instructions are gone **[read]**
- **did it load?** — `/context` (and `/memory`) list every loaded memory file, AGENTS.md included: the probe of record. the `InstructionsLoaded` hook never reports an AGENTS.md loaded as project instructions, how frame and cclio load **[read, 2026-10-11]**; a one-line `CLAUDE.md` holding `@AGENTS.md` makes it fire
- **`/doctor prompt-audit`** (2.1.283) audits instructions; plain `/doctor` proposes trims of derivable content and offers moves into skills **[read]**

the probes — rerun them, never trust the list above:

```bash
# 1. is the comment stripped?
mkdir p && cd p
printf '# p\n\nvisible: ZEBRA.\n\n<!--\nhidden: WALRUS.\n-->\n' > CLAUDE.md
claude -p "YES or NO: does the exact word WALRUS appear in your context?" --model haiku </dev/null
# measured 2026-08-23 → NO   (and ZEBRA → YES)

# 2. does paths: scoping work? (the full 2026-10-11 run, one arm per touch: `recipes/nurture-memory/scripts/paths-probe.sh`)
mkdir -p q/.claude/rules && cd q
printf -- '---\npaths:\n  - "**/*.zzz"\n---\n\nscoped: OTTER.\n' > .claude/rules/probe.md
printf 'x\n' > thing.zzz
claude -p "YES or NO: does OTTER appear in your context?" --model haiku </dev/null
# measured 2026-08-23 → NO   (boot)
claude -p "Read thing.zzz. Then YES or NO: does OTTER appear in your context?" --model haiku </dev/null
# measured 2026-08-23 → YES  (after the match)
```

## what the measurements say

**[read]** arXiv 2605.10039 (McMillan, 2026-05), 1,650 cc sessions, sonnet 4.6:

- 🚫 file size, instruction position, file architecture and contradictions in adjacent files showed no detectable effect on adherence (BF10 0.05–0.10 for size and conflict)
- ✅ the one real effect is **within-session decay**: each extra function generated is ~5.6 % lower odds of compliance (OR 0.944), reproduced on opus 4.6
- ⚠️ the target was one trivial annotation, not 39 competing rules: it does not say a bloated file is free

**[read]** arXiv 2608.11095 (Chakrabarti, 2026-08), 1,867 repos, 247,694 instruction lifetimes:

- files grow +226 % over their life, +4.9 net instructions per commit; median 39 instructions
- 76.8 % of instruction deaths happen in wholesale rewrites; old rules get harder to remove
- **the rationale decays faster than the instruction** — once the why is gone, proving a deletion safe is exponential: *catastrophic remembering*
- ✅ writing the reason as a comment at write time: excess size +211.3 % control vs +1.4 % treatment; a real-world replication lifted constraint satisfaction 50.4 % → 62.0 %
- ⚠️ controlled runs used 2–3 instructions vs a median of 39; the wild numbers rest on an llm judge

**[read]** anthropic, «the new rules of context engineering for Claude 5 generation models» (claude.dev blog, 2026-07-24): they cut over 80 % of Claude Code's system prompt «with no measurable loss»; the shifts are rules → judgement, examples → interface design, all upfront → progressive disclosure, instructions said once. a `CLAUDE.md` stays light and spends its tokens on gotchas; conflicting messages across system prompt, skills and `CLAUDE.md` make the model «think more carefully». three 2026 papers agree that context files earn their place with gotchas and non-standard practice, never repo overviews (arXiv 2602.11988, 2607.27250, 2601.20404).

### the synthesis: the why survives in a comment

> the **why** must survive, and it must not cost context → a block html comment, paid zero **[measured]**

the shape the paper measured, three lines at most:

```markdown
<!--
failure: incident 412 — payout job wrote payouts, timed out before ledger_entries, 1,300 orphan rows.
why: one transaction means both commit or neither.
outcome: held. no orphan rows in 11 months.
-->
- every multi-table write uses a transaction.
```

- «added to fix an issue we saw earlier» performed the same as no comment **[read]**: a comment without an outcome is a guess
- the comment is also the **maintenance layer** (dima's design): why this piece is here, what would move it. the entry stays the instruction alone, and the urge to explain has somewhere free to go
- 🚫 **the cap** — dima's own objection: a comment costs zero tokens but still costs his reading time. most rules get none; one only where the why is non-obvious (a hidden constraint, an incident, a placement that would look wrong); a barrel hook stays visible text, it is for him to navigate by
- ⚠️ a comment is evidence, not proof that deleting is safe; two rules can overlap so that removing either is safe and removing both breaks **[read]**

## the context budget

- 🚫 **there is no safe token number to hunt.** degradation is a gradient, not a cliff (chroma, 18 models). hunt the two countable proxies: **resident tokens a turn will not use**, and **duplicates** — a divergent duplicate is a measured distractor, and one board change once falsified the same sentence in eight files **[read + measured]**
- **flat, separable statements retrieve better than narrative** — shuffled haystacks beat structured prose **[read]**
- **prettiness costs ~2.89 chars/token vs ~4.0 for plain prose**: emoji, tables, backticks cost ~38 % more per character **[measured 2026-08-23]**
- **batch boot-file edits**: every edit to a resident file invalidates the prompt-cache prefix **[read]**
- **agents draft memory well; they must not own existence or deletion**: llm evaluators cannot separate good from bad instructional material **[read]**
- 📌 the `permissions.deny` bare-deny trick has no primary measurement behind its savings and costs capability; memory is the bigger lever by 4× **[measured + read]**

## where a rule comes from — audit, do not invent

**[read]** theo wrote his memfile from his own agent history: per-model failure rates first, then one rule per failure that really happened.

- a rule with no observed failure behind it is a guess, paid in every session forever
- when a thread goes badly, ask the agent to bucket its own tool calls and say which were useless; the answer is usually a stale or missing memfile line
- 🚫 never copy another person's memfile: borrow the shape, derive the content from your own failures
- **tone matching** **[read]**: how a memfile is written pulls replies toward it, so its register is load-bearing
- **one ❌ / ✅ pair** from a real output beats a paragraph describing the preference **[read]**

## precedence — which layer wins

more specific wins, narrowest last: root `CLAUDE.md` → `rules/*.md` → `~/projects/CLAUDE.md` → project `CLAUDE.md` → leaf `CLAUDE.md`. the person in the room outranks all of it. layers are additive: a leaf overrides root only where they disagree, and a genuine conflict is a defect to fix in the files, said out loud, never a puzzle resolved at read time.

## what never goes in

- **an expanded version for the reader** — dima's spec: *info that is useful to **you**, in a format appropriate to **you***. roughly 70 % of written text is not needed
- **timestamps and lineage in prose** — keep a date that IS the fact (an expiry, a deadline, a measurement); the rest goes in a comment
- **a rule inferred but not tested** — «inferred» as a label does not help: the auto-unassign fix was marked inferred, written into two files, and falsified by the first push
- **a claim relayed from another agent** — attribute it, or verify it
- **a no-op** — a default the model obeys anyway; settle it by running the document
- **a prohibition where a positive works** — the ban drags the behaviour into context; write the target, keep a ban only as a hard guardrail paired with it

## hazards that bite silently

- ❗ **a broken `@import` loads nothing and says nothing** — paths resolve relative to the importing file: from `memory/_MEMORY.md` a sibling is `@leaf.md`, and `@memory/leaf.md` fails silently. on-disk presence is not loading: check `/context`
- ❗ **a wrong frontmatter key downgrades a rule to always-on** **[measured]**
- ❗ **`@imports` buy organisation, not context** **[read]** — the most common false economy; cclio's barrel is this shape, every leaf resident from turn one. only `paths:` keeps a file out until needed
- ❗ **a hand-written barrel can lie** — `cclio/memory/` is index-authoritative, so a missing line disables a memory
- ❗ **`MEMORY.md` past 200 lines is truncated on load** **[read]**
- ❗ **a subagent does not inherit the parent's cwd** — every path in a brief or a memfile is absolute
- ❗ **a rule describing another surface is still resident everywhere** — `dispatch.md` cost every bytes coder ~2.1k tokens
- ❗ **conflicting instructions are resolved arbitrarily** **[read]**

## how the files are organised

- one leaf, one decision; colocate by area — dima's test: *«optimize your linear activity habits»* lands him in one place
- a concept's definition, rules and caveats under one heading; scattering one meaning is worse than duplicating it
- filenames subject-first; a stale pointer means delete the line and the file, no tombstones
- the emoji prefix is a salience marker (❗ 📌 ⏰ 🧭 ⭐ 🚫), never decoration

## the method, when a file needs rethinking

⭐ **two alternative drafts, dima picks**, rather than an edit in place: incremental editing preserves the layout, and a rethink exists because the layout is wrong. 76.8 % of real deletions happen in rewrites anyway **[read]**.

## upkeep is mechanical — regression checks, never an llm judge

run when a file is touched; a quarterly cadence catches nothing (drift measured under 24 hours **[measured]**):

- a rule naming a **command** → its `--help` holds the flag
- a rule naming a **file** → it exists
- a rule naming a **ticket** → the state matches the tense, the sharpest check (~92 %, 11 real defects on its first run) **[measured 2026-08-23]**
- a rule carrying a **probe** → rerun it
- a groomed file → `python3 cclio/script/quote-diff.py HEAD <file>`: every «…» quote that left is listed, and each of dima's is restored or shown to him (2026-10-11)

🚫 **never an llm-judge memory audit** — judge models agree on verdicts >99.88 % of the time while fabricating different reasoning per run (~19 % stability). deterministic checks in code; llms only for semantics a human confirms **[read]**.

## the groom card

read at every halt; it feeds the delete digest. dima, 2026-10-07: «hunt redundant memories each time, and also propose grooms, trims to keep it tidy». the full run is `recipes/nurture-memory/recipe.md`.

### a line is redundant when it is

- **a dupe** — the same claim in another file or layer: one home keeps it, the copies go, a pointer only where a reader would not find it. duplication multiplies decay: one board change once falsified twelve files
- **superseded** — a newer decision says otherwise, or it names a Done/Canceled ticket in open-state words, a dead file, a dead flag
- **enforced** — a hook, a mod, a check or `settings.json` now does it: the prose line goes, the guard is the rule
- **unused** — never load-bearing since the last sweep; the cost is `resident × never-used`
- **a no-op** — it describes a mechanic the harness performs, or a default the model obeys anyway. the test: does this line change a behaviour?
- **the wrong altitude** — true, but only one surface or one project needs it: it moves down, it is not cut

### trim without losing the reason

- the instruction stays; the why moves into a block html comment, three lines at most: failure · why · outcome. a rule's «why» paragraph is scaffolding while its surface is still being built; it moves into the comment last, never into the bin
- keep every date that IS the fact (an expiry, a measurement), every number, every incident behind a rule; shorten the prose, never the fact
- a line with a written incident stays unless a run proves it a no-op; «deleted and nothing broke» proves nothing when two rules overlap
- 🚫 **dima's words in «» are never cut or reworded** — restructure around them; dropping one needs his word, the original shown beside the change
- the target shape: separable facts, the positive target over the ban, info useful to the agent in a format for the agent — «i do not need 90% of it»

### the digest

- ≤5 clusters per halt, related lines together; each line: the text quoted, why it goes (the kind above), the evidence (a grep, a ticket state, the guard's name, a load count), where the reason survives
- dima answers per line: **yes** / **keep** / **later** — no «approve all», silence changes nothing
- yes → deleted in one batch; the old text stays recoverable in git
- keep → the proposal goes to `retire-log.md` in this folder with his reason, and never resurfaces unchanged; only new evidence re-proposes it, showing what changed
- later → it rides the next digest
- the agent drafts; existence and deletion are his (an llm grading its own memory cannot tell good from bad)
