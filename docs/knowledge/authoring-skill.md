---
researched: 2026-08-23
sources-current-as-of: cc 2.1.241 · code.claude.com/docs/en/skills · mattpocock-skills 1.2.3 · theo t3 breakdown transcript · bytemonk claude.md transcript · anthropic skill best practices + prompting fable 5 (snapshots 2026-10-02, `docs/research/skill-authoring-best-practices/`)
refresh-when: the skill listing budget mechanics change, or `writing-for-agents` ships a new version — diff `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/`; or the anthropic snapshot diff (nurture-memory, research vectors) shows a delta
ticket: DOT-216
---

# skill authoring — the full reference

## contents

- read matt's skill first
- frontmatter
- writing the description
- the skill listing budget (cc only)
- invocation control
- what belongs in a skill rather than a memfile
- splitting: by trigger, not by topic
- give the model a stop point
- completion criteria
- anthropic's structure rules — what we adopt
- do we still need `skillsmith`? — no
- argument placeholders

conventions for the skills in `home/.claude/plugin-x/skills/`. `cw` reads the same files —
`home/.claude/plugin-x-cw/` symlinks into them and ships as the `x-cw` plugin, so a
skill is written once and every surface gets the edit.

📌 **a plugin runs from its cache copy, so everything its `bin/` and skills import lives inside the plugin dir.** `package-json-shape` imported `../../../../script/lib/…`, which resolves only in the frame checkout; from the desktop app's PATH (the cache) it died with `ERR_MODULE_NOT_FOUND` and blocked every `package.json` commit in bytes. the rules moved to `plugin-x/lib/` (`eb47811f`, 2026-09-27).

⚠️ **this file is the local half.** the writing craft — pointers, information hierarchy,
completion criteria, leading words, pruning — is `writing-for-agents`, and it is good. do not
restate it here. **read the skill, then use this file for what it does not know: our budget, our
frontmatter, our invocation habits.**

claim tags: **[measured]** on this machine · **[read]** stated by docs or a practitioner ·
**[inferred]** our judgment.

---

## read matt's skill first — verdict 2026-08-23

`mattpocock-skills:writing-for-agents` (v1.2.3), plus its `SKILL-MECHANICS.md` branch.

✅ **it holds up, and the research replicates its two strongest claims:**

- **a description is a trigger, not a summary.** matt calls it a *context pointer* whose wording
  decides when the material is reached. theo, independently: *«think of the description of a skill
  as the trigger keywords rather than as an actual description»* — he removed the explanatory half
  and trigger reliability went up. **[read]** two practitioners, no controlled experiment.
- **negation backfires.** stating the banned behaviour drags it into context. prompt the positive.
  **[read]** matt only; consistent with everything known about attention, untested here.

⚠️ **what it does not cover, and you must supply from `authoring-memory.md`:**

- no measured numbers. every lever is reasoned, none is benchmarked
- **nothing about the mechanics that actually gate loading** — html-comment stripping, `paths:`
  scoping, import expansion, the listing budget. those are cc facts, not writing facts
- it treats `AGENTS.md`/`CLAUDE.md` as the same object as a skill. **[inferred]** that is true for
  the *writing* and false for the *economics*: a skill body is paid on invoke, a memfile is paid
  every turn forever. the hierarchy it teaches has no rung for «resident in every session on the
  machine, whether or not it fires»

📌 **so: `writing-for-agents` is the craft layer, `authoring-memory.md` is the mechanics layer.**
neither replaces the other. use both, matt's taking the final word on wording.

---

## frontmatter

`name` and `description` are the contract cc reads. one optional field is ours:

```yaml
intended-models: fable, opus
```

- **meaning** — the models this skill is written for, best first. `fable, opus` reads "fable
  normally, opus when fable is unavailable".
- **enforcement is procedural, not mechanical.** nothing blocks a lower-tier model from loading it.
  routing is where it is honoured.
- **a model running a skill above its tier prints a note** saying so, then proceeds. the note is
  the signal, never a refusal.
- omit the field when the skill is model-agnostic. most are.

**[read]** theo carries a second optional field worth stealing — `requires:`, naming an env var or
credential the skill cannot work without: *«i don't want the skill on machines where i don't have
the token… if it is unset, tell the user instead of guessing»*. the enforcement is the same kind as
`intended-models` — procedural, stated in the body — but it converts a confusing failure into a
one-line explanation.

model strengths that decide the value: `home/.claude/rules/models.md`.

## writing the description

it is the single most expensive line in the skill and the only one that decides whether the skill
ever fires. **[read]** matt + theo agree on all four:

- **front-load the trigger word.** the first words do the work
- **one trigger per branch.** synonyms renaming one branch are one branch written twice
- **cut identity the body already carries.** the description says *when*, the body says *what*
- 🚫 **never let the description carry the answer.** theo: *«I've seen skills where the description
  gives you everything you need and you don't even need to use the skill»* — that is the whole body
  paid resident, every turn

🚨 **and the name is read BEFORE the description, sometimes instead of it. [measured].** four mcp
tools shipped as `transcript_fetch` / `transcript_list` / `transcript_recall` / `transcript_transit`.
a `cw` thread listed all four, then refused to use them:

> «x-cw's `transcript_*` tools wouldn't have helped anyway: those are your session/handoff
> transcript store (agent-fleet CSTs), not YouTube captions. Different meaning of "transcript".»

the description said *«Download the video transcript from a YouTube url»*. it never got that far.
renamed `yt_transcript_*`, worked first try.

two consequences, both load-bearing:

- **a wrong entity name is not recoverable by a good description.** no longer reasoned, an agent
  demonstrated it
- **the entity must be as specific as the namespace it claims.** `transcript_*` claimed a whole
  namespace that youtube occupies a corner of. dima's framing: *«we may have more things for
  transcripting»*

the rule itself is entity-first, and it lives in root `CLAUDE.md`.

## the skill listing budget (cc only)

skills are **half-lazy**. resident from boot = `name` + `description` (~80–100 tokens per skill).
the `SKILL.md` body enters context on invoke, as one message, and persists for the rest of the
session. files bundled next to a skill load only when actually read — near-zero resident cost, so
**that is where bulk content belongs**.

on `cc` the whole listing shares a **character budget, ~1% of context**. on overflow descriptions
truncate, then drop entirely, least-invoked first, down to name-only. that is the mechanical cause
of «the skill exists but never fires» — nothing errors, the skill just goes quiet.

⚠️ **known bug**: the budget is computed against a 200k baseline even on 1m-context models, so a
large window does not buy listing room.

two unofficial knobs, `settings.json`:

| key | default | ours |
| --- | --- | --- |
| `skillListingBudgetFraction` | `0.01` | `0.025` (2026-08-19, DOT-64 — sized for the current library) |
| `skillListingMaxDescChars` | `1536` | unset |

📌 the file is strict json and carries no comments, so this table is the only record of why that
number is what it is. change one, change the other.

consequences:

- **descriptions are the precious bytes.** every word competes with every other skill's description
- **prefer one umbrella skill over many narrow ones.** `conventions` is the pattern: one description
  resident, N rule files read on demand
- unlike mcp tools, skills have **no `ToolSearch` equivalent** — mcp overflow degrades to lazy
  retrieval, skill overflow degrades to silent truncation. there is no `SkillSearch`

## invocation control — the only lever that removes a description from the budget

📌 **commands and skills are the same thing now.** the docs state it plainly: *"Custom commands have
been merged into skills."* `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both
create `/deploy` and behave identically. so **a command is billed exactly like a skill** —
**[measured]** on this machine, the four `cclio-*` commands sit in the resident listing at ~30–40
tokens each. there is no cheap tier by being "a command".

three fields, and two of them are easy to confuse:

| what you want | set this | description resident? |
| --- | --- | --- |
| **only dima invokes it** | `disable-model-invocation: true` | ❌ **no — this is the saving** |
| only claude invokes it | `user-invocable: false` | ✅ yes, always |
| dima-only, without editing the file | `"user-invocable-only"` in `skillOverrides` (settings) | ❌ no |

- ⚠️ **`user-invocable: false` is the trap.** it reads like the one you want and is the opposite:
  it hides the skill from the `/` menu, keeps claude's access, and keeps the description resident.
- **`disable-model-invocation: true` also stops** the skill being preloaded into subagents, and
  (v2.1.196+) stops it running when a scheduled task fires with it as the prompt.
- 📌 `"user-invocable-only"` in `skillOverrides` reaches skills we do not own but that sit as
  loose files (a project repo's `.claude/skills`). 🚫 **it never reaches a plugin skill** — the
  settings reference: «Overrides don't apply to plugin skills, which you manage through `/plugin`»
  (code.claude.com/docs/en/settings-reference#skilloverrides, read 2026-09-28). a third-party plugin
  skill is either kept whole or vendored into a skills dir with `disable-model-invocation: true`.

### the habit

**mark a skill user-invocable-only whenever dima is the only one who should ever start it.** the
docs' own test is side effects and timing — `/commit`, `/deploy`, `/send-slack-message`.

🚫 **but check for self-triggering FIRST, and read the skill body, not just its name.** a skill that
is *supposed* to fire on its own dies silently when flagged, and nothing reports it:

- `cclio-halt` **must stay model-invocable** — dima may simply say something that means
  «we are done», and starting the ritual is the agent's job
- `cclio-flowlog` fires «whenever a mistake just happened»
- `cclio-report` fires on «sup» / «where are we»
- `x:cmt` loads on any commit, typed or not

the saving is ~30–40 tokens per skill. **that is never worth killing a habit for.** when in doubt,
leave it invocable.

📌 **[read]** matt's *router skill*: when user-invoked skills multiply past what dima can remember,
one user-invoked skill that names the others cures the pile-up. it can only hint, never fire them.

## what belongs in a skill rather than a memfile

**[read]** anthropic's own split:

- a **multi-step procedure** → skill, not bullet points in `CLAUDE.md`
- something that matters **only in one part of the codebase** → a `paths:`-scoped rule
- something that **must run** at a lifecycle point → a hook. memory is context, not enforcement
- everything else that must be true every session → `CLAUDE.md`

## splitting: by trigger, not by topic

**[read]** theo shipped `file-pr` and `babysit-pr` as one skill, then split them:

> originally i had the file PR and babysit PR skills as one skill, but i noticed once i added the
> keywords that it was good enough at triggering that i didn't really need that anymore. also, i
> often want one and not the other.

two tests, in order:

1. **do the triggers differ?** if one phrase should pull in half the body and never the other half,
   that is two skills. topical similarity is not the question
2. **does the user ever want one without the other?** if yes, splitting removes a body they did not
   ask for from context

📌 the enabling condition is worth noticing: **the split only became possible once the descriptions
had good trigger keywords.** a weak description forces skills to stay merged, because merging is the
only way either one gets found.

## give the model a stop point

**[read]** *«when you give the model a stop point, life gets much better»* — theo, prompting a model
he expected to overreach: *«make your changes. don't commit or push to any machines yet. i'll tell
you when.»*

**[inferred]** the same lever belongs inside a skill body, not only in prompts. a skill whose last
step is «report and wait» behaves differently from one that ends by acting — and it is the cheap fix
for a skill that keeps doing one step too many.

## completion criteria — the lever we under-use

**[read]** matt, untested here. every step ends on a condition telling the agent it is done.

- **clarity** — can the agent tell done from not-done? a vague bound invites stopping early
- **demand** — *«every modified model accounted for»* forces work that *«produce a change list»*
  does not. it binds flat reference too: *«every rule applied»*

**[inferred]** this is the strongest thing in matt's skill that none of our skills currently do.
worth a pass over `plugin-x/skills/` on its own.

## anthropic's structure rules — what we adopt

**[read]** [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
and the [Fable 5 guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5),
both snapshotted 2026-10-02. the full check against us, with numbers, is
`docs/research/skill-authoring-best-practices.md`; these are the rules a new or edited skill meets.

- **freedom matches fragility** — a step with many valid paths is plain prose (high); a preferred
  shape is a template with knobs (medium); a fragile or destructive step is an exact script with
  few or no flags (low). one skill mixes levels. the test per step: «what happens if Claude does it
  differently?» — nothing much → loosen it; something consequential → script it
- **`SKILL.md` under 500 lines; every reference file linked straight from it** — a file reached only
  through another file may be previewed with `head -100` instead of read whole
- **a contents list on top of any on-demand file over 100 lines**, so a partial read still shows the
  whole scope. resident memory loads whole and does not need one
- **an ordered workflow carries a checklist the model copies into its reply and ticks**, and its
  verify step says where to go back to («if X fails, return to step 3») — that line is what stops a
  failed step being ticked. no checklist where order does not matter
- **a quality-critical step runs a validator loop**: check → fix → check again, and proceed only on a
  pass. the validator can be a script or a file read and compared (a style guide)
- **plan → validate → execute** for batch, destructive or high-stakes work: the plan is a file, a
  script checks it, only then it runs. our `x lane` plan + `--apply` is this pattern
- **say «run X» or «see X»** — whether a bundled script is executed or read as reference
- **scripts solve, they do not defer**: they handle their errors with a message that names the fix,
  and every constant says why it is that value
- **packages are named, never assumed** — matters for skills a cloud or cw session runs
- **prescriptive skills hurt Fable 5** — CAPS, «ALWAYS» and enumerated cases written for older
  models; the delete-test in `nurture-memory` decides what stays
- **never ask the model to reproduce its reasoning in the reply** — on Fable 5 it can trigger the
  `reasoning_extraction` refusal; ask for a short summary of the answer instead

⚠️ **two anthropic rules we do not adopt** (local wins, fleet-identity #9): third-person descriptions
that say *what* the skill does (ours say only *when*, `authoring-memory-and-skills`), and gerund
names (`processing-pdfs`; ours are entity-first). and one open conflict for the sweep: our
`intended-models` frontmatter above vs `nurture-memory`'s «drop `intended-models` on touch».

## do we still need `skillsmith`? — no. settled, DOT-132 closed

an earlier draft here said «yes, thin»: the guides are docs with no trigger, so skillsmith would be
the trigger. **that reasoning was wrong, and it was written without opening matt's skill.**

`writing-for-agents` **already is that trigger.** its own description: *«use when creating or editing
skills, or modifying AGENTS.md or CLAUDE.md»* — both artifacts, already covered. and it is not
craft-only: it carries a section «the two loads» defining *«context load — the cost of always-loaded
material on the agent's window… spending tokens and attention whether or not it fires»*, plus
completion criteria, pruning, progressive disclosure and single-source-of-truth.

**so the split is by layer, and there are only two:**

| layer | authority |
| --- | --- |
| craft — wording, hierarchy, triggers, pruning, load economics | matt's `writing-for-agents` |
| **claude code harness mechanics** | this file and `authoring-memory.md` |

the second exists because a general writing guide should not carry one tool's internals: html
comment stripping, `paths:` vs the silent `globs:` typo, `@import` resolution, the 200-line
`MEMORY.md` cut, `InstructionsLoaded`, `/doctor`. those rot on a different clock.

📌 **one authority per layer.** a third artifact restating either is the failure this decision
avoids.

## argument placeholders — measured, not documented

- **[measured 2026-09-07, cc 2.1.263]** `$1` in a skill body renders the **second** word of the arguments (`/x:crew-coder AAA BBB CCC` → `The ticket is \`BBB\``). whether `$0` is the first is unmeasured. `$ARGUMENTS` carries the whole string; prefer it and say in prose which word means what.
- a slash command expands (the body replaces the line, placeholders substituted) in a typed turn and in the `claude --bg '<prompt>'` / `claude -p '<prompt>'` argument; it does **not** expand inside a `SendMessage` — that arrives as raw text, and the invocation flag is not the cause: an unflagged skill (`/x:queue …`) arrived raw too (measured 2026-09-07, haiku probe, zero `command-message` blocks).
