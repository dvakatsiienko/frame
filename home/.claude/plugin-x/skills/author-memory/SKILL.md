---
name: author-memory
description: Load BEFORE writing or grooming any file an agent reads as instructions — a SKILL.md, an AGENTS.md or CLAUDE.md, a `rules/` file, a cclio memory leaf, a recipe, a command; and once up front before a halt flush, a flawlog parse or a memory sweep. «author memory», «where does this line go», «groom this skill».
---

# author-memory — where a line goes, and how it is written

craft (wording, triggers, pruning, leading words) is `mattpocock-skills:writing-for-agents`: load it beside this one. this body is the core; the references hold the measurements, probes and full skeletons.

## the two tests every line passes

- **keep only what proved useful** — a skill, a memory line, a tool earns its place by use; an unproven one goes
- **not maximum instructions, but the minimum useful context at the right time** — the right bucket and the right moment beat more words

## where a line goes — audience decides, never topic

the failure this prevents: a line landing where it was convenient instead of where it belongs (cclio's phrase, dima's pick, 2026-10-16) — the widest bucket whose whole audience benefits:
- root `CLAUDE.md` / `rules/` without `paths:` → every session pays for it, forever
- `rules/` with `paths:` → a convention tied to a glob; an intention has no glob
- a project `AGENTS.md` → wrong or meaningless in another repo
- a nested `AGENTS.md` beside the code it covers → knowledge only that folder's work needs; it loads when the folder is touched (a Read, or a Bash read through our loader hook), so a split part that has a code folder goes there; a part triggered by root files (a manifest, a workflow) keeps a `docs/` file and a pointer naming those files
- `_clio/memory/` → the coordinator only
- a skill → a procedure, or anything needed occasionally
- a hook, `settings.json`, `permissions.deny` → anything that must happen; memory is context, never enforcement
- `docs/` → long, occasional, a lookup

before the write: who needs it · what it costs resident · does it already exist (a second copy drifts) · a fact, a rule or a story · can the agent find it by looking (then it is a cache, skip it). a line asking for an action names the exact call.

## how it is written

- one instruction per line; the why goes in a block html comment **at column 0, after its list** (failure · why · outcome, ≤3 lines) — an indented comment loads whole; a doc opened with `Read` and a skill body keep their comments, so there the story goes to git or a research doc
- a rule carries the one command that proves it, or is labelled an inference
- no CAPS, no «ALWAYS», no enumerated cases (they hurt Fable 5)
- no timestamps or lineage in prose, unless the date is the fact
- every add reads the whole file and grooms it: merge, cut what it outdates, name the cuts

## the mechanics that bite silently

- a broken `@import` loads nothing and says nothing; paths resolve from the importing file
- `globs:` is not a key: the rule loads unconditionally **[measured]**; `paths:` fires on a Read, `cat` or Edit of a match
- `MEMORY.md` is cut at 200 lines or 25 KB; a `CLAUDE.md` stays under 200 lines
- every resident edit invalidates the prompt cache: batch them
- `/context` is the probe of record for what loaded

## a skill

- the description says WHEN only, front-loads the literal words dima types; the name is read first, entity-first
- name + description are resident (~80–100 tokens); the body loads on invoke; bulk goes into references, each linked straight from `SKILL.md`, under 500 lines; a reference over 100 lines opens with a contents list
- a gotcha stays in `SKILL.md`: the agent cannot know to open a reference for a trap it does not see coming
- `disable-model-invocation: true` takes it out of the listing; never on a skill that must self-trigger
- a quality step runs a validator loop
- a description edit is proven by `claude plugin eval`, run only on dima's word (`rules/fleet-tooling.md`); until then it is labelled an inference, never proven by reading it

## a project AGENTS.md

a communication file for an agent about to change code, never a README. under 200 lines, nothing root or `rules/` already holds; the skeleton and its verbatim blocks are in [memory-project.md](references/memory-project.md).

## upkeep — mechanical, never an llm judge

a named command → its `--help` holds the flag; a file → it exists; a ticket → its state matches the tense; a probe → rerun it; a groomed file → `python3 ~/frame/_clio/script/quote-diff.py HEAD <file>`, every quote of dima's restored or shown to him.

## references

- [memory.md](references/memory.md) — the buckets in full, the cc mechanics with their probes, the papers, the context budget, precedence
- [skill.md](references/skill.md) — frontmatter, descriptions, the listing budget, invocation control, structure rules, placeholders, evals