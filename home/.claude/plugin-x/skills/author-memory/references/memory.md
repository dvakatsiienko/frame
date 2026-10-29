---
researched: 2026-08-23
sources-current-as-of: cc 2.1.296 · code.claude.com/docs memory · arXiv 2608.11095 · arXiv 2605.10039 · claude.dev blog 2026-07-24
refresh-when: `paths:` scoping, html-comment stripping, or the 200-line target changes in the cc docs — rerun the probes below
ticket: FRM-216
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

sibling to `skill.md`: that one is how to write a skill, this one is where anything written belongs. **placement is decided before the write, not repaired after it.** claim tags: **[measured]** run here or in a published experiment · **[read]** anthropic's docs or a paper · **[inferred]** our judgment, untested.

## the buckets — audience decides

🎯 **audience decides, never topic.** a memory lands in the widest bucket whose whole audience benefits; the short list is `SKILL.md` § where a line goes, below are the tests and the extra buckets.

- **root `~/.claude/CLAUDE.md`** — every session, every project. test: would a new session in any repo be worse without it?
- **`~/.claude/rules/*.md`, no `paths:`** — the same audience, one granular area per file so root stays lean. test: worth paying for in every session on the machine?
- **`rules/*.md` with `paths:`** — a convention tied to a kind of file or a directory. test: does a glob name when it matters? a topic or an intention has no glob
- **`~/projects/AGENTS.md`** — every coding session, no coordinator; a deliberate stub today
- **a project `AGENTS.md`** — that one project (`memory-project.md`). test: wrong or meaningless in another repo?
- **`_clio/memory/*`** — the coordinator only. test: would a coder be misled by it?
- **a skill** — a procedure, or anything needed occasionally; on demand, never resident. test: would someone invoke it by name?
- **a hook, `settings.json`, `permissions.deny`** — anything that must happen. «always» or «before every» is enforcement, and memory is context, not enforcement **[read]**

📌 pnpm feels coder-specific, but any session may run it, so it lives in `rules/fleet-tooling.md`; a trap that bit 2+ repos goes to `rules/fleet-hazards.md`.

📌 **anything only one surface needs is a peek-on-demand doc, never a rule** — every other surface pays for it resident.
<!-- failure: fleet-identity.md grew fat with per-surface capabilities; every coder paid for surfaces it will never be; `dispatch.md` cost every bytes coder ~2.1k tokens. -->

🚨 **memory supplies knowledge, never capability. [measured]** a line asking the agent to act on the system names the exact call, or the job moves to `settings.json`, a hook or `permissions.deny`. dima: *«test failed = you can't. it only creates a mess in memory file.»*
<!-- failure: a root registry of switched-off mcps; no `claude mcp enable` exists and a server binds only at session start, so it bought awareness of a wall at full resident cost. -->

see `writing-for-agents` for the craft (pointers, the ladder, pruning, no-ops, leading words); this doc holds where a line goes and the cc mechanics.

## the pre-write checklist

`SKILL.md` § where a line goes holds the short checks (who needs it, a fact/rule/story, findable by looking); the detail:

1. **what does it cost?** a `rules/` file with no `paths:` is resident in every session forever; a skill description is resident; a command or a doc costs nothing until used
2. **does it already exist?** a second copy is worse than none: the two drift and nobody can tell which is live
3. **a measurement or a standing fact?** a dated «as of» line is a measurement and belongs in the commit that measured it; two went stale within a day (2026-09-08)

## the mechanics, and their probes

- **block html comments** — `<!-- … -->` at column 0 is stripped before injection: free storage for the why. ❗ an indented one, inside a list item, is NOT stripped and loads whole **[measured 2026-10-11, cclio's own root attachment + a sonnet probe]**: put the comment at column 0, after the list. **[measured]** in a `CLAUDE.md`, an imported leaf and a `rules/` file (cc 2.1.292; re-run on 2.1.296, haiku + sonnet, 2026-10-11); an `AGENTS.md` loaded as project instructions too (cclio's own: its line-51 comment is on disk and absent from the loaded copy, 2026-10-11)
- **`paths:` frontmatter** — a `.claude/rules/*.md` with `paths:` is absent at boot and fires on touching a matching file, never on an intention. **[measured, cc 2.1.296, 2026-10-11]** opus and sonnet 5.5, 24/24: Bash `cat`, `Edit`, and a `Write` followed by a read load it; haiku: `Read` too, a bare `Write` of a new file not; touching nothing matching loads nothing (`recipes/nurture-memory/scripts/paths-probe.sh`). 📌 the rule arrives inside the tool result, so write it as a plain project convention: a secret-token probe read as injected text to haiku
- **`@imports`** — expand at launch: they buy organisation, not context **[read]**
- **size** — a `CLAUDE.md` over 4 MiB is skipped (the 200-line and `MEMORY.md` cuts are in `SKILL.md`) **[read]**
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

# 2. does paths: scoping work? one arm per touch
recipes/nurture-memory/scripts/paths-probe.sh
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
- 📌 the `permissions.deny` bare-deny trick has no primary measurement behind its savings and costs capability; memory is the bigger lever by 4× **[measured + read]**

## where a rule comes from — audit, do not invent

**[read]** theo wrote his memfile from his own agent history: per-model failure rates first, then one rule per failure that really happened.

- a rule with no observed failure behind it is a guess, paid in every session forever
- when a thread goes badly, ask the agent to bucket its own tool calls and say which were useless; the answer is usually a stale or missing memfile line
- 🚫 never copy another person's memfile: borrow the shape, derive the content from your own failures
- **tone matching** **[read]**: how a memfile is written pulls replies toward it, so its register is load-bearing
- **one ❌ / ✅ pair** from a real output beats a paragraph describing the preference **[read]**

## precedence — which layer wins

more specific wins, narrowest last: root `CLAUDE.md` → `rules/*.md` → `~/projects/AGENTS.md` → project `AGENTS.md` → leaf `AGENTS.md`. the person in the room outranks all of it. layers are additive: a leaf overrides root only where they disagree; a genuine conflict is root's house rule. conflicting instructions may get resolved arbitrarily **[inferred]**, though McMillan saw no adherence effect from adjacent-file conflicts: fix them either way.

## what never goes in

- **an expanded version for the reader** — dima's spec: *info that is useful to **you**, in a format appropriate to **you***. roughly 70 % of written text is not needed
- **a rule inferred but not tested** — the label does not help (the auto-unassign fix, falsified by the first push)
- **a claim relayed from another agent** — attribute it, or verify it
- **a no-op or a needless ban** — `writing-for-agents` § pruning, § leading words

## hazards that bite silently

the mechanics above hold the wrong key, the import cost and the `MEMORY.md` cut; these bite on top:

- ❗ **an `@import` path** resolves from the importing file: from `memory/_MEMORY.md` a sibling is `@leaf.md`, and `@memory/leaf.md` fails silently
- ❗ **a hand-written barrel can lie** — `_clio/memory/` is index-authoritative, so a missing line disables a memory; cclio's barrel makes every leaf resident from turn one
- ❗ **a subagent does not inherit the parent's cwd** — every path in a brief or a memfile is absolute

## how the files are organised

- one leaf, one decision; colocate by area — dima's test: *«optimize your linear activity habits»* lands him in one place
- a stale pointer means proposing to delete the line and the file, no tombstones
## the method, when a file needs rethinking

⭐ **two alternative drafts, dima picks**, rather than an edit in place: incremental editing preserves the layout, and a rethink exists because the layout is wrong. 76.8 % of real deletions happen in rewrites anyway **[read]**.

## upkeep is mechanical — regression checks, never an llm judge

the checks (command · file · ticket · probe · quote-diff) are `SKILL.md` § upkeep; run them when a file is touched, since a quarterly cadence catches nothing (drift measured under 24 hours **[measured]**). the ticket check is the sharpest: ~92 %, 11 real defects on its first run **[measured 2026-08-23]**

🚫 **never an llm-judge memory audit**: agents draft memory well, but llm evaluators cannot separate good from bad instructional material, so existence and deletion stay human **[read]**. judge models agree on verdicts >99.88 % of the time while fabricating different reasoning per run (~19 % stability). deterministic checks in code; llms only for semantics a human confirms **[read]**.
