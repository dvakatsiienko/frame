---
researched: 2026-08-23
sources-current-as-of: cc 2.1.296 · code.claude.com/docs/en/skills · mattpocock-skills 1.3.1 · theo t3 breakdown transcript · anthropic skill best practices + prompting fable 5 (snapshots 2026-10-02, no content change on 2026-10-13, `docs/research/skill-authoring-best-practices/`)
refresh-when: the skill listing budget mechanics change, or `writing-for-agents` ships a new version — diff `~/.claude/plugins/cache/mattpocock/mattpocock-skills/` (1.3.1 on 2026-10-11); or the anthropic snapshot diff shows a delta
---

# skill authoring — the local half

## contents

- two layers: matt's craft, our mechanics
- frontmatter
- writing the description
- the skill listing budget
- invocation control
- splitting: by trigger, not by topic
- stop points
- anthropic's structure rules — what we adopt
- argument placeholders
- evals

conventions for the skills in `home/.claude/plugin-x/skills/`. `cloud-chat` reads the same files: `home/.claude/plugin-x-cloud-chat/` symlinks into them and ships as the `x-cloud-chat` plugin, so a skill is written once. **a new `x:*` skill asks the cloud chat question at create time**: `plugin-x-cloud-chat` is a curated symlink set, so a skill reaches cloud chat only by `ln -s ../../plugin-x/skills/<name>` in `plugin-x-cloud-chat/skills/` plus a bump of both plugins.

📌 **a plugin runs from its cache copy, so everything its `bin/` and skills import lives inside the plugin dir** — outside it the import dies with `ERR_MODULE_NOT_FOUND` (`script/lib/plugin-bin-imports.test.ts` checks the bins).

claim tags: **[measured]** on this machine · **[read]** docs or a practitioner · **[inferred]** our judgment.

## two layers: matt's craft, our mechanics

- **craft** — wording, hierarchy, triggers, completion criteria, leading words, pruning, load economics: `mattpocock-skills:writing-for-agents` (1.3.1) and its `SKILL-MECHANICS.md`. read it first; it takes the final word on wording, and this file never restates it
- **claude code mechanics** — html-comment stripping, `paths:` vs the silent `globs:` typo, `@import` resolution, the listing budget, invocation flags, evals: this file and `memory.md`. they rot on a different clock
- one authority per layer: a third artifact restating either is the failure

## frontmatter

`name` and `description` are the contract cc reads; cc ignores unknown top-level keys silently, and custom keys belong under `metadata:`, as a map, never reusing a field name like `paths` **[read, docs 2026-10-13]**. a claude.ai upload or the Skills API refuses any top-level key beyond `name, description, license, compatibility, metadata, allowed-tools`.

## writing the description

the single most expensive line, and the only one that decides whether the skill fires **[read]**:

- **WHEN only**: «Load BEFORE …», «Load EVERY time …», «Load when …». the name carries the entity, the body the what; a description that explains or answers is the body paid resident
- **a «Not for …» clause** is added only when a misfire is on record, naming the lookalike in the words that misfired («Not for a 1password vault or item.»)
- **seed it with the literal words dima types** («commit this», a pasted url, «walk me through»): a description can only match words that appear in a prompt

🚨 **the name is read before the description, sometimes instead of it. [measured]** four mcp tools shipped as `transcript_*`; a `cloud-chat` thread listed them and refused them as «your session/handoff transcript store … not YouTube captions». renamed `yt_transcript_*`, they worked first try. a wrong entity name is not recoverable by a good description, and the entity is as specific as the namespace it claims (dima: *«we may have more things for transcripting»*). the entity-first rule lives in root `CLAUDE.md`.

## the skill listing budget

skills are **half-lazy**: `name` + `description` are resident from boot (~80–100 tokens per skill); the `SKILL.md` body enters on invoke and stays for the session; bundled files load only when read, so bulk content belongs there.

- the listing shares a **character budget, ~1 % of context**; on overflow the least-used skills lose their descriptions and keep only the name — the mechanical cause of «the skill exists but never fires»; truncation is the separate per-skill cap, 1,536 characters across `description` + `when_to_use`. **[read, docs 2026-10-13]** it scales with the model's window, an overflow writes a debug-log warning, `/doctor` estimates the cost per contributor. whether it still uses a 200k baseline on 1m models is unmeasured
- two knobs in `settings.json`, documented in the settings reference: `skillListingBudgetFraction` (default `0.01`, ours `0.025`, sized for the library) and `skillListingMaxDescChars` (default `1536`, ours unset). `settings.json` carries no comments, so this line is the only record of why
- **after a compaction, an invoked skill re-attaches its first 5,000 tokens, 25,000 across all skills, filled from the most recently invoked, so older skills drop whole** **[read, docs 2026-10-13]**: a crew skill's operating contract sits in its first 5k, and its must-hold lines at the top
- **a skill body keeps its html comments** **[measured 2026-10-15, cc 2.1.299, haiku -p, a project skill]**: column-0 and indented comments both arrive raw in the injected text, so a comment in a skill costs what its prose costs; a skill's story goes to git or a research doc, never a comment
- the skill file is never re-read: a line written as a standing instruction («run the tests after every edit») keeps working where a one-shot one («run the tests») is done once **[read, docs]**
- 📌 open upstream: the listing is not re-sent after an auto-compaction, only deltas ([#82017](https://github.com/anthropics/claude-code/issues/82017)); on 2.1.295 the main agent may get the listing late or never ([#100813](https://github.com/anthropics/claude-code/issues/100813)) — a skill miss after a compaction is suspect here first
- a subagent preloads at most 32 skills from its `skills:` list (2.1.295); the rest stay reachable through the Skill tool
- one umbrella skill beats many narrow ones (`guide-conventions`: one description, N rule files read on demand); there is no `SkillSearch`

## invocation control

📌 **commands and skills are the same thing** — the docs: *"Custom commands have been merged into skills."* a command is billed exactly like a skill (**[measured]** the `clio:*` commands sit in the listing at ~30–40 tokens each).

- **only dima invokes it** → `disable-model-invocation: true`: the description leaves the listing — the saving. it also stops preloading into subagents, stops the run when a scheduled task fires with the skill as its prompt, and drops a project `verify` or `simplify` skill's before-each-commit run (2.1.286; plugin skills never get it)
- **only claude invokes it** → `user-invocable: false`: hidden from the `/` menu, description still resident. ⚠️ the trap — it reads like the one you want
- **dima-only without editing the file** → `"user-invocable-only"` in `skillOverrides`: reaches loose skill files, 🚫 never a plugin skill («Overrides don't apply to plugin skills», settings reference, read 2026-09-28); a third-party plugin skill that misfires gets a `Skill(<plugin>:<name>)` rule in `permissions.deny` (blocks model invocation, plugin untouched; whether its description leaves the listing is unchecked), or is vendored with the flag
- **a rule that must hold** → the skill's own `hooks:` frontmatter, registered from invoke to session end (`once: true` drops it after its first success), never a firmer line in prose **[read, docs 2026-10-13]**
- **cross-skill calls** are written «call the Skill tool with "x:foo"», one skill per call, never routed to a `disable-model-invocation` skill **[read, matt `invocation.md`]**

🚫 **the habit: read the body for self-triggering before flagging** — a skill meant to fire on its own dies silently when flagged: `clio:halt` (dima may just say «we are done»), `clio:flawlog` (a mistake just happened), `x:cmt` (any commit). the saving is ~30–40 tokens, never worth a habit.

## splitting: by trigger, not by topic

**[read]** theo's `file-pr` / `babysit-pr` split. two tests: do the triggers differ (one phrase pulls in half the body)? does the user ever want one without the other? 📌 a weak description forces skills to stay merged.

## stop points

- **a stop point** **[read]**: *«when you give the model a stop point, life gets much better»* (theo). a skill whose last step is «report and wait» is the cheap fix for one that keeps doing a step too many **[inferred]**

## anthropic's structure rules — what we adopt

**[read]** [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) and the [Fable 5 guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5), its check against us folded into this file (run #2).

- **freedom matches fragility** — many valid paths: prose; a preferred shape: a template with knobs; fragile or destructive: an exact script. the test per step: «what happens if Claude does it differently?»
- **every reference file is linked straight from `SKILL.md`** — a file reached through another may be previewed with `head -100` only
- **an ordered workflow carries a checklist** the model copies and ticks, with «if X fails, return to step 3»; none where order does not matter
- **plan → validate → execute** guards batch or destructive work (our `x lane` plan + `--apply`)
- **scripts solve and name the fix in their errors**
- **prescriptive skills hurt Fable 5**; the delete-test decides what stays: «would the agent get this wrong without this line?»
- **a default, not a menu**: one tool named, the alternative after it
- **`/doctor prompt-audit <dir>` is a groom's first pass** (2.1.283): it flags lines written for older models, stale paths and contradictions; it runs through the bundled `claude-api` skill, so it dies when that skill is off
- **never ask the model to reproduce its reasoning** — on Fable 5 it can trigger the `reasoning_extraction` refusal
- ⚠️ **two rules we do not adopt** (local wins, root CLAUDE.md invariant #9): third-person what-descriptions (ours say only when) and gerund names (ours are entity-first). 📌 on descriptions every source read on 2026-10-13 says «what it does and when» (cc docs, anthropic, skill-creator, agentskills.io, some «pushy»); our when-only rule rests on theo's one report, never measured on our skills — the next eval round tests it

## argument placeholders

- **[measured 2026-09-07, cc 2.1.263]** `$1` renders the second word of the arguments; the docs now say `$N` is 0-based, so `$0` is the first **[read, 2026-10-11]**. `$ARGUMENTS` carries the whole string; prefer it and say in prose which word means what
- a slash command expands in a typed turn and in a `claude --bg` / `claude -p` argument; it does **not** expand inside a `SendMessage`, which arrives as raw text (measured 2026-09-07, haiku probe)

## evals

- **`claude plugin eval` proves a description edit**: 3–4 of dima's real prompts per skill under `plugin-x/evals/`, a `tool_used: Skill` grader, `--runs 3`, one `--case` glob per call, ~$5 a skill. the finding that set the shape: the literal words he types go first, plus «even mid-sentence or after another instruction» — cmt 1/12 → 12/12, notes 2/9 → 9/9. it grades the trigger only; the body stays a human read
- 📌 **in a two-arm run (with and without the plugin) a `tool_used: Skill` grader is not scored**, only shown as «plugin fired», unless it is the case's only grader; a trigger-only run uses `--ablation none` (half the cost), and a must-not-trigger grader (`min: 0, max: 0`) needs `arm: both` to count **[read, plugin-evals docs 2026-10-13]**. each case otherwise carries one grader on the result and one on the steps
- **the description loop, the borrowed shape** **[read, agentskills.io + skill-creator]**: ~20 queries, half should trigger and half near-misses that should not; 3 runs each, trigger rate ≥0.5 passes; a fixed 60/40 train/validation split kept by hand (`plugin eval` has no split); the best iteration picked by its validation score, never the last; never paste a failed query's words into the description
- cost: `plugin eval` defaults to 3 runs per arm, so one case is 6 agent runs plus judge calls; deterministic graders are free, `llm` graders are not
- `/skill-doctor` gives a candidate list only: it charges a whole session's tokens to every skill touched and counts any mention of a name as a use, so real invocations run ~10× lower ([#92327](https://github.com/anthropics/claude-code/issues/92327), open) — confirm against real `Skill` calls in transcripts
