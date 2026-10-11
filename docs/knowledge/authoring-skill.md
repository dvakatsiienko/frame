---
researched: 2026-08-23
sources-current-as-of: cc 2.1.296 · code.claude.com/docs/en/skills · mattpocock-skills 1.3.1 · theo t3 breakdown transcript · anthropic skill best practices + prompting fable 5 (snapshots 2026-10-02, unchanged on 2026-10-11, `docs/research/skill-authoring-best-practices/`)
refresh-when: the skill listing budget mechanics change, or `writing-for-agents` ships a new version — diff `~/.claude/plugins/cache/mattpocock/mattpocock-skills/` (1.3.1 on 2026-10-11); or the anthropic snapshot diff shows a delta
ticket: DOT-216
---

# skill authoring — the local half

## contents

- two layers: matt's craft, our mechanics
- frontmatter
- writing the description
- the skill listing budget
- invocation control
- what belongs in a skill rather than a memfile
- splitting: by trigger, not by topic
- stop points and completion criteria
- anthropic's structure rules — what we adopt
- argument placeholders
- evals

conventions for the skills in `home/.claude/plugin-x/skills/`. `cw` reads the same files: `home/.claude/plugin-x-cw/` symlinks into them and ships as the `x-cw` plugin, so a skill is written once. **a new `x:*` skill asks the cw question at create time**: `plugin-x-cw` is a curated symlink set, so a skill reaches cw only by `ln -s ../../plugin-x/skills/<name>` in `plugin-x-cw/skills/` plus a bump of both plugins.

📌 **a plugin runs from its cache copy, so everything its `bin/` and skills import lives inside the plugin dir.** `package-json-shape` imported `../../../../script/lib/…`, which resolves only in the frame checkout; from the cache it died with `ERR_MODULE_NOT_FOUND` and blocked every `package.json` commit in bytes. the rules moved to `plugin-x/lib/` (`eb47811f`, 2026-09-27).

claim tags: **[measured]** on this machine · **[read]** docs or a practitioner · **[inferred]** our judgment.

## two layers: matt's craft, our mechanics

- **craft** — wording, hierarchy, triggers, completion criteria, leading words, pruning, load economics: `mattpocock-skills:writing-for-agents` (1.3.1) and its `SKILL-MECHANICS.md`. read it first; it takes the final word on wording, and this file never restates it
- **claude code mechanics** — html-comment stripping, `paths:` vs the silent `globs:` typo, `@import` resolution, the listing budget, invocation flags, evals: this file and `authoring-memory.md`. they rot on a different clock
- one authority per layer: a third artifact restating either is the failure. that is why there is no `skillsmith` ([DOT-132](https://linear.app/x-com/issue/DOT-132), closed): `writing-for-agents` already is the trigger for both skills and memory files
- the two strongest craft claims replicate **[read]**: a description is a trigger, not a summary (theo cut the explanatory half and reliability went up); negation backfires, so prompt the positive
- what matt does not cover: measured numbers, and the economics — a skill body is paid on invoke, a memfile every turn forever

## frontmatter

`name` and `description` are the contract cc reads; cc ignores unknown top-level keys silently, and custom keys belong under `metadata:` **[read, docs 2026-10-11]**.

- **`intended-models: fable, opus`** — ours: the models a skill is written for, best first. enforcement is procedural: a model running a skill above its tier prints a note and proceeds. omitted when the skill is model-agnostic, most are. open for `nurture-skills` step 6: it moves under `metadata:`, or drops on touch
- **theo's `requires:`** **[read]** — the env var or credential the skill cannot work without: «if it is unset, tell the user instead of guessing». worth stealing, same procedural kind
- model strengths that decide the value: `home/.claude/rules/models.md`

## writing the description

the single most expensive line, and the only one that decides whether the skill fires **[read]**:

- **front-load the trigger word**; one trigger per branch — synonyms renaming one branch are one branch written twice
- **WHEN only** (dima's call 2026-08-25): «Load BEFORE …», «Load EVERY time …», «Load when …». the name carries the entity, the body the what; a description that explains or answers is the body paid resident. theo: *«I've seen skills where the description gives you everything you need and you don't even need to use the skill»*
- **a «Not for …» clause** is added only when a misfire is on record, naming the lookalike in the words that misfired («Not for a 1password vault or item.») (dima's yes, 2026-10-01)
- **seed it with the literal words dima types** («commit this», a pasted url, «walk me through»): a description can only match words that appear in a prompt
- **a user-only skill's description is written for a human** — it is shown, never matched **[read, matt 1.3.1]**

🚨 **the name is read before the description, sometimes instead of it. [measured]** four mcp tools shipped as `transcript_*`; a `cw` thread listed them and refused them as «your session/handoff transcript store … not YouTube captions». renamed `yt_transcript_*`, they worked first try. a wrong entity name is not recoverable by a good description, and the entity is as specific as the namespace it claims (dima: *«we may have more things for transcripting»*). the entity-first rule lives in root `CLAUDE.md`.

## the skill listing budget

skills are **half-lazy**: `name` + `description` are resident from boot (~80–100 tokens per skill); the `SKILL.md` body enters on invoke and stays for the session; bundled files load only when read, so bulk content belongs there.

- the listing shares a **character budget, ~1 % of context**; on overflow descriptions truncate, then drop, least-invoked first, down to name-only — the mechanical cause of «the skill exists but never fires». **[read, docs 2026-10-11]** it scales with the model's window, and an overflow now writes a debug-log warning; `/doctor` estimates the cost per contributor. our older note said the budget used a 200k baseline even on 1m models, with no changelog fix found: a re-measure is owed (`nurture-skills` step 4)
- two knobs in `settings.json`, documented in the settings reference: `skillListingBudgetFraction` (default `0.01`, ours `0.025`, 2026-08-19, DOT-64, sized for the library) and `skillListingMaxDescChars` (default `1536`, ours unset). `settings.json` carries no comments, so this line is the only record of why
- **after a compaction, an invoked skill re-attaches its first 5,000 tokens, 25,000 across all skills** **[read, docs 2026-10-11]**: a crew skill's operating contract sits in its first 5k
- descriptions are the precious bytes; one umbrella skill beats many narrow ones (`conventions`: one description, N rule files read on demand); there is no `SkillSearch`

## invocation control

📌 **commands and skills are the same thing** — the docs: *"Custom commands have been merged into skills."* a command is billed exactly like a skill (**[measured]** the `cclio:*` commands sit in the listing at ~30–40 tokens each).

- **only dima invokes it** → `disable-model-invocation: true`: the description leaves the listing — the saving. it also stops preloading into subagents and (v2.1.196+) runs from a scheduled task
- **only claude invokes it** → `user-invocable: false`: hidden from the `/` menu, description still resident. ⚠️ the trap — it reads like the one you want
- **dima-only without editing the file** → `"user-invocable-only"` in `skillOverrides`: reaches loose skill files, 🚫 never a plugin skill («Overrides don't apply to plugin skills», settings reference, read 2026-09-28); a third-party plugin skill is kept whole or vendored with the flag
- **cross-skill calls** are written «call the Skill tool with "x:foo"», one skill per call, never routed to a `disable-model-invocation` skill **[read, matt `invocation.md`]**

**the habit**: mark a skill user-only when dima is the only one who should start it (side effects and timing: `/commit`, `/deploy`). 🚫 but read the body for self-triggering first — a skill meant to fire on its own dies silently when flagged: `cclio:halt` (dima may just say «we are done»), `cclio:flawlog` (a mistake just happened), `x:cmt` (any commit). the saving is ~30–40 tokens, never worth a habit. **[read]** matt's router skill — one user-invoked skill naming the others — cures a pile-up past what dima remembers.

## what belongs in a skill rather than a memfile

**[read]** anthropic's split: a multi-step procedure → a skill; something for one part of the codebase → a `paths:`-scoped rule (it loads on a read, `cat` or edit of a matching file, `authoring-memory.md`); something that must run → a hook; what must be true every session → `CLAUDE.md`.

## splitting: by trigger, not by topic

**[read]** theo split `file-pr` and `babysit-pr`: «once i added the keywords … it was good enough at triggering … also, i often want one and not the other.» two tests: do the triggers differ (one phrase pulls in half the body)? does the user ever want one without the other? 📌 a split becomes possible only once the descriptions carry good trigger words; a weak description forces skills to stay merged.

## stop points and completion criteria

- **a stop point** **[read]**: *«when you give the model a stop point, life gets much better»* (theo). a skill whose last step is «report and wait» is the cheap fix for one that keeps doing a step too many **[inferred]**
- **completion criteria** **[read, matt]**: every step ends on a condition telling done from not-done; clarity stops early exits, demand («every modified model accounted for») forces the work, and binds flat reference too («every rule applied»)

## anthropic's structure rules — what we adopt

**[read]** [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) and the [Fable 5 guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5), snapshotted 2026-10-02, no content change on 2026-10-11. the full check against us: `docs/research/skill-authoring-best-practices.md`.

- **freedom matches fragility** — many valid paths: prose; a preferred shape: a template with knobs; fragile or destructive: an exact script. the test per step: «what happens if Claude does it differently?»
- **`SKILL.md` under 500 lines, every reference file linked straight from it** — a file reached through another may be previewed with `head -100` only
- **a contents list on any on-demand file over 100 lines**; resident memory loads whole and needs none
- **an ordered workflow carries a checklist** the model copies and ticks, with «if X fails, return to step 3»; none where order does not matter
- **a quality-critical step runs a validator loop**, and **plan → validate → execute** guards batch or destructive work (our `x lane` plan + `--apply`)
- **say «run X» or «see X»**; scripts solve and name the fix in their errors; packages are named, never assumed
- **prescriptive skills hurt Fable 5** — CAPS, «ALWAYS», enumerated cases; the delete-test in `nurture-memory` decides what stays
- **never ask the model to reproduce its reasoning** — on Fable 5 it can trigger the `reasoning_extraction` refusal
- ⚠️ **two rules we do not adopt** (local wins, root CLAUDE.md invariant #9): third-person what-descriptions (ours say only when) and gerund names (ours are entity-first)

## argument placeholders

- **[measured 2026-09-07, cc 2.1.263]** `$1` renders the second word of the arguments; the docs now say `$N` is 0-based, so `$0` is the first **[read, 2026-10-11]**. `$ARGUMENTS` carries the whole string; prefer it and say in prose which word means what
- a slash command expands in a typed turn and in a `claude --bg` / `claude -p` argument; it does **not** expand inside a `SendMessage`, which arrives as raw text (measured 2026-09-07, haiku probe)

## evals

- **a description edit is proven by `claude plugin eval`, never by reading it** (proven 2026-09-12, DOT-243): 3–4 of dima's real prompts per skill under `plugin-x/evals/`, a `tool_used: Skill` grader, `--runs 3`, one `--case` glob per call, ~$5 a skill. the finding that set the shape: the literal words he types go first, plus «even mid-sentence or after another instruction» — cmt 1/12 → 12/12, notes 2/9 → 9/9. it grades the trigger only; the body stays a human read
- **[read, 2026-10-11]** what the next round adds: should-not-trigger near-miss cases (`tool_used: Skill, min: 0, max: 0`); a held-out test split; `--ablation none` for trigger-only runs at half the cost; a baseline at ≥95 % is saturated, stop climbing it; never paste eval prompts into a description (anthropic's hillclimb overfitting rule)
- `/skill-doctor` gives a candidate list only: its «never fires» is unreliable (cc issue #92327) — confirm against real `Skill` calls in transcripts
- `/claude-api hillclimb` is the api-app version; its train/test split and one-change-per-round discipline are what is borrowed
