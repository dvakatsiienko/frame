---
researched: 2026-08-23
sources-current-as-of: cc 2.1.241 · docs.claude.com/en/docs/claude-code/memory · arXiv 2608.11095 · arXiv 2605.10039 · bytemonk claude.md transcript
refresh-when: `paths:` scoping, html-comment stripping, or the 200-line target changes in the cc docs — reprobe with the two probes recorded below
ticket: DOT-216
---

# memory authoring — where a fact goes, decided BEFORE it is written

## the vertical map — pick the bucket BEFORE writing

🎯 **AUDIENCE decides, never topic.** every memory lands in exactly one bucket — the widest one
whose whole audience benefits. wrong-bucket placement is the mistake this map kills.

- **root `~/.claude/CLAUDE.md`** — the entire fleet benefits: every session, every project.
- **`~/.claude/rules/*`** — same global audience as root: each file one granular area (output
  format, voice, linear floor, …), split so root stays lean.
- **`~/projects/AGENTS.md`** — every coding session, no coordinator: true in every repo under
  `~/projects` and nowhere else. cclio fills it. currently a deliberate stub.
- **project-level `AGENTS.md`** — sessions in that one project only. cclio fills these too.
- **`cclio/memory/*`** — the coordinator only; a coder reading it would be misled.
- **skills** — any audience, but loaded on demand, never resident. a memory that reads like
  steps wants to be a skill.
- **`docs/`** — read on demand: long, occasional, or a lookup.

📌 **the worked example — how the audience test runs:** pnpm FEELS coder-specific (topic: package
management), so the reflex says `~/projects/AGENTS.md`. but ask who benefits: any session may run
pnpm, even in non-coding projects like `~/frame` — so it parks fleet-wide, in `rules/fleet-tooling.md`
(which tool does which job, plus its one-line gotcha); a trap that bit 2+ repos goes to `rules/fleet-hazards.md`. run every placement
through this shape: name the audience, ignore the topic.

## the pre-write checklist — five questions, before ANY memory write

1. **who needs this?** everyone · every coder · one project · one surface · one role — the map above
2. **what does it cost?** a rule is resident in every session forever; a skill description is
   resident; a doc costs nothing until read
3. **does it already exist somewhere?** a second copy is worse than none — the two drift
4. **is it a fact, a rule, or a story?** different homes, different decay rates
5. **is it a measurement or a standing fact?** a dated «as of» line in an `AGENTS.md` or doc is a
   measurement and belongs in the commit that measured it; two such lines went stale within a day
   and each cost a false finding (2026-09-08). docs state what does not expire
6. **can the agent find it by looking?** scripts, layout, `--help` — a doc restating those is a
   stale cache. cache only the unwritten convention, the reason, the gotcha

## a new x:* skill asks the cw question

creating a skill in `plugin-x` does NOT reach the desktop — `plugin-x-cw` is a curated symlink
set. at create time, decide cw inclusion; if yes: `ln -s ../../plugin-x/skills/<name>` in
`plugin-x-cw/skills/` + bump both plugin versions.

## skill descriptions — WHEN only

**the description is ONLY the load trigger** — «Load BEFORE …», «Load EVERY time …», «Load
when …» (dima's call 2026-08-25, sharpening `docs/knowledge/authoring-skill.md`). the NAME carries
the entity, the BODY carries the what — details are one invoke away. never let a description
explain or answer: that is body content paid resident, every turn.
**a «Not for …» clause is part of the trigger**, added only when a misfire is on record — it names
the lookalike case in the words that misfired («Not for a 1password vault or item.») (dima's yes,
2026-10-01, after the jev router's miss log).
**seed the trigger with magic keywords** — the literal words dima would type («commit this», a
pasted url, «walk me through»), not an abstract paraphrase of the situation; the description
fires by matching the prompt, and it can only match words that actually appear in one.


## contents

- the mechanics that decide everything else
- what the measurements actually say
- the context budget
- where a rule comes from — audit, do not invent
- two levers that cost almost nothing
- the pre-write checklist
- the buckets, and the test for each
- precedence — which layer wins
- what NEVER goes in
- hazards that bite silently
- how the files are organised
- the method, when a file needs rethinking
- upkeep is mechanical
- trimming — the order is binding

sibling to `authoring-skill.md`: that one is how to write a skill, this one is where anything
written belongs. **placement is decided before the write, not repaired after it.**

claim tags: **[measured]** run on this machine or in a published experiment · **[read]** stated by
anthropic's docs or a paper · **[inferred]** our judgment, untested.

---

## the mechanics that decide everything else

these are the levers. get them wrong and no amount of good prose helps.

| mechanic | the fact | tag |
| --- | --- | --- |
| **block html comments** | `<!-- … -->` in a `CLAUDE.md` is **stripped before injection**. free storage for the why | **[measured]** probe below, cc 2.1.241 · **[read]** docs |
| **`paths:` frontmatter** | a `.claude/rules/*.md` with `paths:` is **absent at boot** and loads when a matching file is read | **[measured]** probe below |
| ❗ **a wrong frontmatter key** | `globs:` is not a key. the rule silently loads **unconditionally**. no error, no warning | **[measured]** probe below |
| **`@imports`** | expand at launch. splitting a file into imports buys organisation, **not context** | **[read]** docs |
| **size target** | under **200 lines** per `CLAUDE.md`. over 4 MiB is skipped entirely | **[read]** docs |
| **`MEMORY.md`** | auto-memory index is hard-cut at **200 lines or 25KB**. content past it is dropped on load | **[read]** docs |
| **delivery** | `CLAUDE.md` arrives as a **user message after the system prompt**, not as system prompt. it is context, never enforcement | **[read]** docs |
| **compaction** | project-root `CLAUDE.md` is re-read from disk after `/compact`. nested files and `paths:` rules reload only when re-matched. conversation-only instructions are gone | **[read]** docs |

### the two probes — rerun these, do not trust this table

```bash
# 1. is the comment stripped?
mkdir p && cd p
printf '# p\n\nvisible: ZEBRA.\n\n<!--\nhidden: WALRUS.\n-->\n' > CLAUDE.md
claude -p "YES or NO: does the exact word WALRUS appear in your context?" --model haiku </dev/null
# measured 2026-08-23 → NO   (and ZEBRA → YES)

# 2. does paths: scoping work?
mkdir -p q/.claude/rules && cd q
printf -- '---\npaths:\n  - "**/*.zzz"\n---\n\nscoped: OTTER.\n' > .claude/rules/probe.md
printf 'x\n' > thing.zzz
claude -p "YES or NO: does OTTER appear in your context?" --model haiku </dev/null
# measured 2026-08-23 → NO   (boot)
claude -p "Read thing.zzz. Then YES or NO: does OTTER appear in your context?" --model haiku </dev/null
# measured 2026-08-23 → YES  (after the match)
```

### the probe for «did it load at all»

`InstructionsLoaded` hook — logs which instruction files loaded, when, and why. **[read]** docs.
this is the answer to the silent-import hazard: stop inferring, read the log.

`/context` lists loaded memory files. `/doctor` (v2.1.206+) proposes trims for a checked-in
`CLAUDE.md` — it cuts what is derivable from the codebase and keeps pitfalls, rationale, and
conventions that differ from tool defaults.

---

## what the measurements actually say — and it is not what folklore says

**[read]** arXiv 2605.10039 (McMillan, 2026-05) — factorial study, **1,650 cc sessions**, 16,050
function-level observations, two typescript codebases, sonnet 4.6 primary:

- 🚫 **file size, instruction position, file architecture, and contradictions in adjacent files
  produced no detectable effect on adherence.** size and conflict carry affirmative-null bayes
  factors (BF10 0.05–0.10). position and architecture are failures to reject.
- ✅ the one real effect is **within-session decay**: each additional function generated is
  **~5.6% lower odds of compliance** (OR 0.944). reproduced on a second codebase and on opus 4.6.
- ⚠️ **do not over-read it.** the target was **one trivial annotation**, not 39 competing rules.
  it says structure did not move a simple instruction; it does not say a bloated file is free.

**[read]** arXiv 2608.11095 (Chakrabarti, 2026-08) — 1,867 repos, 247,694 instruction lifetimes:

- files grow **+226%** over their lifetime, **+4.9 net instructions per commit**; median file ends
  at **39 instructions**
- **76.8% of instruction deaths happen in wholesale rewrites**, not incremental deletion
- deletion hazard **declines with age** (−0.032/commit). old rules get harder to remove, not easier
- **the mechanism**: the rationale decays faster than the instruction. once the why is gone,
  proving deletion is safe costs `O(2^|D|)`. they call it **catastrophic remembering**
- ✅ **the intervention worked.** writing the reason as a comment at write time: excess size at
  T=51 steps **+211.3% control vs +1.4% treatment**. real-world replication lifted constraint
  satisfaction **50.4% → 62.0%** (+11.6pp, CI [5.1, 18.3])
- ⚠️ limitations they state: controlled runs used 2–3 instruction covers vs a median of 39; the
  wildifeval numbers rest on an llm judge and a second judge differed by 3.8pp

### the synthesis, and it changes our rule

our old rule said *no provenance in prose*. that stands — and it was only half the answer.
**[inferred]** the two findings reconcile exactly:

> the **why** must survive, and it must not cost context.
> → write it in a block html comment. paid: zero. **[measured]**

so: **every rule gets a comment carrying failure · why · outcome.** the shape the paper measured:

```markdown
<!--
failure: incident 412 — payout job wrote payouts, timed out before ledger_entries, 1,300 orphan rows.
why: one transaction means both commit or neither.
outcome: held. no orphan rows in 11 months.
-->
- every multi-table write uses a transaction.
```

⚠️ **«added to fix an issue we saw earlier» performed the same as no comment at all.** **[read]**
a comment without an outcome is an unvalidated guess left for the next reader.

### the second job of a comment: navigation 🧪

dima's design, and it follows from the same free-storage fact. **the instruction stays slim; the
comment carries everything a maintainer needs and a reader does not.**

```markdown
<!-- why here: coordinator-only — a coder session would act on it wrongly.
     how it helps: stops the pm flow being re-explained every boot. -->
- label AND project AND parent AND milestone, decided at create time.
```

- **the entry is the instruction. nothing else.** no audience note, no rationale, no history
- **the comment is the maintenance layer**: why this piece is *here*, how it helps, what would
  move it
- 🎯 the point is not documentation — it is **removing the temptation to over-describe the entry**.
  the urge to explain has somewhere free to go, so the instruction stays an instruction

🚫 **the cap, because free storage invites flooding.** dima's own objection to this design, and it
stands: a comment costs zero tokens but still costs **his reading time and its own maintenance**.

- **not every entry gets one.** most rules are self-evident; a comment there is noise with a
  zero-token price tag
- **three lines maximum** — the shape the paper measured, and it measured a *short* one
- write one only when the **why is non-obvious**: a hidden constraint, a past incident, a placement
  that would look wrong to the next reader
- 📌 **it is not a barrel-index job.** a one-line hook in an index is written for dima to navigate
  by, so it stays visible text. the comment is for the maintainer question the hook cannot answer —
  *why is this leaf here rather than in `rules/`* — and only where that is actually in doubt

⚠️ **a comment is evidence, not proof.** **[read]** it tells the next reader what to go and check;
it never establishes that deleting is safe. keep a human in the loop before removing anything —
and the more expensive the blast radius, the harder that rule binds.

📌 **why one-by-one deletion testing does not work.** **[read]** two rules can overlap so that
removing *either* is safe and removing *both* breaks. «i deleted it and nothing broke» is therefore
not evidence the rule was dead.

---

## the context budget — what the measurements license

<!-- absorbed from docs/research/context-budget-and-memory-authorship.md and
     context-engineering-memory.md (deleted 2026-08-24); sources live in git history. -->

- 🚫 **there is no safe token number to hunt.** degradation is a gradient from small inputs up, not
  a cliff (chroma, 18 models). hunt the two countable proxies instead: **resident tokens a turn
  will not use**, and **duplicate statements** — a divergent duplicate is a measured distractor,
  and duplication is a **decay multiplier**: one board change once falsified the same sentence in
  eight files. **[read + measured]**
- **flat, separable statements retrieve better than elegant narrative** — models scored better on
  shuffled haystacks than logically structured prose. write memory as separable facts, not essays.
  **[read]**
- **the prettiness has a price: ~2.89 chars/token vs ~4.0 for plain prose** — emoji prefixes,
  tables, backticks and url schemes cost ~38% more per character. not a reason to stop; a cost to
  weigh when a table could be three bullets. **[measured 2026-08-23]**
- **batch boot-file edits.** every edit to resident files invalidates the prompt-cache prefix on
  the next call; volatile session-scoped content belongs outside the boot path entirely. **[read]**
- **agents draft memory well; they must not own existence or deletion.** llm evaluators cluster
  their scores and cannot separate good from bad instructional material — an agent grading its own
  memory is exactly that weak loop. drafting: agent. should-this-exist and should-this-die: human.
  **[read]**
- 📌 the `permissions.deny` bare-deny trick (dropping tool schemas) has **no primary measurement**
  behind its quoted savings, is already applied on this machine, and costs capability — a denied
  tool is invisible, not merely blocked. memory is the bigger lever by 4×. **[measured + read]**

## where a rule comes from — audit, do not invent 🔎

**[read]** the strongest published example of a memfile was not written from taste. theo scraped his
own agent history first, then wrote rules against what actually broke:

> can you look through my history with models like fable, opus and gpt-5.6 in claude code and codex
> on this machine to see what the most common mistakes are… break down the most common failure modes
> and how often each model hits them.

the output was per-model failure rates — process-killing, draft PRs, repo-wide checks, tool misuse,
corrections per 100 messages — and **his file's whole «ways to hurt yourself» section came straight
out of it.** each rule names a failure that really happened to him.

- ➡️ **a rule with no observed failure behind it is a guess.** it still costs context in every
  session, forever
- **when a thread goes badly, ask the agent why.** what gave it the indication this was right? a
  simple change that took 30 minutes instead of 5 → ask it to bucket its own tool calls and say
  which were useless. the answer is usually a line in a memfile that is stale, or missing
- 🚫 **do not copy another person's memfile.** the value is the reasoning path, not the text — theo
  deliberately does not publish his, on exactly this ground. borrow the *shape*, derive the content
  from your own failures

## two levers that cost almost nothing

- **tone matching.** **[read]** *«models are good at tone matching. if you talk a certain way to the
  model, the model's more likely to talk that way back»*. so how a memfile is written is itself an
  instruction — a file written in clipped, plain, lowercase prose pulls replies toward it. this is
  why voice rules work at all, and it means the register of these files is load-bearing, not taste.
- **paired good/bad examples.** **[read]** *«agents are really good at bad and good examples… you've
  seeded its weights with the things that matter to you»*. one `❌ … / ✅ …` pair, drawn from a real
  output you disliked, outperforms a paragraph describing the same preference.

---

## the pre-write checklist

before writing or editing ANY memory, rule, or `CLAUDE.md`, answer these five.

1. **who needs this?** everyone on the machine · every coder · one project · one surface · one role
2. **what does it cost?** a `rules/` file with no `paths:` is resident in **every** session,
   forever. a skill's `description:` is resident in every session. a command costs nothing until
   typed. a doc costs nothing until read
3. **does it already exist somewhere?** a second copy of a rule is worse than no rule — the two
   drift and nobody can tell which is live
4. **is it a fact, a rule, or a story?** different homes, different decay rates
5. **can the agent already find it by looking?** `package.json` scripts, the directory layout,
   `--help` output. a doc restating those is a **cache** of a cheap lookup, and it goes stale.
   cache only what cannot be looked up: the unwritten convention, the reason, the gotcha

---

## the buckets, and the test for each

| bucket | holds | the test |
| --- | --- | --- |
| root `CLAUDE.md` | guiding for **everyone** — what we do, why, the main dos and donts | would a brand new session in any repo be worse without it? |
| `rules/*.md`, no `paths:` | granular globals, same audience as root, split so one file is not a dump | same test as root, **plus**: worth paying for in every session on the machine? |
| `rules/*.md` **with `paths:`** | code-shaped conventions tied to a file type or a directory | is there a **glob** that names when it matters? if the trigger is a topic and not a file, `paths:` cannot reach it |
| `~/projects/CLAUDE.md` | the coder-global layer — conventions every coding session wants and no coordinator does | would a session that never writes code be worse off reading it? if no, it belongs here and not in root |
| project `CLAUDE.md` | only what is true of **this** project — see `authoring-memory-project.md` | would it be wrong or meaningless in another repo? |
| coordinator memory | one decision, coordinator-only | would a coder session be confused or misled by it? |
| skill | a multi-step procedure, or anything needed occasionally | does it have a name someone would invoke? |
| hook | a thing that must run at a lifecycle point | are you writing «always» or «before every»? then it is not memory. **[read]** memory is context, not enforcement |
| `docs/` | reference read **on demand** | is it long, occasional, or a lookup? |

**the sharpest single rule:** anything only ONE surface needs is a **peek-on-demand doc**, never a
rule. `fleet-identity.md` grew fat exactly this way — every coder in every repo pays for capabilities of
surfaces it will never be.

🚨 **memory supplies knowledge, never capability. MEASURED — dima ran it deliberately.**

the dormant-tools registry in root was an **experiment, not documentation**. the goal was context
thrift: keep rarely-used mcps (`computer-use`, `claude-in-chrome`) switched off, and have the agent
turn one on when a task needs it and off again after. **the obstacle it was built to solve: a
disabled mcp is invisible to the session** — the agent cannot ask for what it cannot see. so the
registry existed to tell the agent those servers were there.

it failed, and the reason is the general lesson: **knowing about a capability is not having a
mechanism to reach it.** there is no `claude mcp enable`, and a server only binds at session start,
so no written awareness produces the toggle. dima's verdict: *«test failed = you can't. it only
creates a mess in memory file.»*

so the bucket test below is not a preference. **when a memory file asks the agent to DO something
to the system, name the exact call that does it.** no call → the file buys awareness of a wall, at
full resident cost, and the only thing it produces is clutter. that job belongs to `settings.json`,
a hook, or `permissions.deny`, which act instead of informing.

📌 what made it expensive: a registry describing an unreachable action reads exactly like one
describing a reachable one. it looked correct for as long as nobody tried.

📌 **`paths:` is narrower than it looks.** **[measured]** it fires on **reading a matching file**.
that fits `guide-typescript`. it does not fit `linear-flow.md`, whose trigger is an intention.

🚨 **and narrower still: the trigger is the `Read` TOOL, not file access.** **[measured]** three
canary rules, two fresh sessions: `cat <matching file>` through Bash fires nothing, `Read` on the
same path injects the rule instantly. **so a session instructed to prefer Bash for reads never
fires a single scoped rule** — and cannot tell a scoped rule from a deleted one. bypass mode says
exactly that. weigh this before converting anything a coordinator depends on.

## precedence — which layer wins

**more specific always wins.** the order, narrowest last:

```
root CLAUDE.md  →  rules/*.md  →  ~/projects/CLAUDE.md  →  project CLAUDE.md  →  leaf CLAUDE.md
```

and **the person in the room outranks all of it** — a user instruction beats every file, always.

📌 the layers are **additive, not exclusive**: a leaf does not replace root, it overrides root *on
the points where they disagree*. everything root says that the leaf is silent about still binds.
when two layers genuinely conflict, that is a defect to fix in the files, not a precedence puzzle
to solve at read time — say so rather than silently picking one.

---

## what NEVER goes in

- **an expanded version for the reader.** dima's spec, verbatim: *info that is useful to **you**, in
  a format appropriate to **you***. roughly 70% of written text is not needed
- **timestamps and lineage in prose.** the tracker stores times natively. **keep** a date that IS
  the fact — an expiry, a deadline, a scheduled review. put the rest in an html comment, free
- **a rule inferred but not tested.** labelling it «inferred» does not help — it reads as a rule
  regardless. the auto-unassign fix was marked inferred, written into two binding files, and
  falsified by the first push. **test it, then write it**
- **a claim relayed from another agent, asserted as your own.** attribute it, or verify it
- **a no-op.** an instruction the model already obeys by default pays load to say nothing. the test
  is model-relative: settle it by running the document, not by arguing
- **a prohibition where a positive works.** stating the banned behaviour drags it into context and
  makes it *more* available. write the target («write one-line comments»), not the ban. keep a
  prohibition only as a hard guardrail, and pair it with the positive

---

## hazards that bite silently

- ❗ **a broken `@import` loads NOTHING and says nothing.** paths resolve relative to the
  **importing file**. from `memory/MEMORY.md` a sibling is `@leaf.md`; the intuitive
  `@memory/leaf.md` becomes `memory/memory/leaf.md` and fails in silence. **on-disk presence is not
  evidence of loading** — check the `InstructionsLoaded` hook or `/context`
- ❗ **a wrong frontmatter key downgrades a rule to always-on**, silently. **[measured]**
- ❗ 🚨 **splitting a big file into `@imports` buys ORGANISATION, NOT CONTEXT.** **[read]** the
  imported files still load at launch — the total is unchanged, only the layout moved. **`paths:`
  scoping is the only thing that actually keeps a file out of context until it is needed.** this is
  the single most common false economy in memfile work, and our own barrel is exactly this shape:
  45 leaves, every one resident from turn one
- ❗ **a hand-written barrel can lie.** add a leaf, skip the pointer, and the index says it does not
  exist. `cclio/memory/` is index-**authoritative**, so a missing line genuinely disables a memory
- ❗ **`MEMORY.md` past 200 lines is truncated on load**, not rejected. **[read]**
- ❗ **a subagent does not inherit the parent's cwd** — it gets the git repo root. **every path in a
  brief or a memfile must be absolute**
- ❗ **a rule describing another surface is still resident everywhere.** `dispatch.md` cost every
  bytes coder ~2.1k tokens describing a coordinator it will never be
- ❗ **conflicting instructions are resolved arbitrarily.** **[read]** two files disagreeing is not
  a tie broken by precedence unless precedence is written down

---

## how the files are organised

- **one leaf, one decision.** not a topic dump
- **colocate by hot spot.** 40 flat files is unnavigable. group by AREA. the test is dima's:
  *«optimize your linear activity habits»* should land him in ONE place
- **co-location within a file**: a concept's definition, rules and caveats under one heading.
  scattering one meaning across many places is a different bug from duplicating it, and worse
- **filenames are subject-first**, readable at a glance
- **a stale pointer means delete both the line and the file.** no tombstones
- **the emoji prefix is a salience marker** (❗ 📌 ⏰ 🧭 ⭐ 🚫), never decoration

---

## the method, when a file needs rethinking

⭐ **write TWO alternative drafts and let dima pick, rather than editing in place.** his standing
rule for visual work says exactly this. incremental editing preserves the layout, and a rethink
exists precisely because the layout is wrong.

📌 **[read]** 76.8% of real-world instruction deletions happen in wholesale rewrites anyway. the
two-draft method is the same move, done deliberately and with the reasons preserved.

---

## upkeep is mechanical — regression checks, never an llm judge

<!-- absorbed from docs/research/memory-upkeep-loop.md (deleted 2026-08-24). -->

memory upkeep is a **regression check on mechanical claims**, run when files are touched — not an
eval, not an audit-by-agent:

- a rule naming a **command** → run `--help`, confirm the flag exists
- a rule naming a **file** → confirm it exists
- a rule naming a **ticket** → confirm the state matches the tense — the highest-precision check
  measured (~92%: 11 real defects in resident files on its first run) **[measured 2026-08-23]**
- a rule carrying a **probe** → rerun the probe

📌 drift latency here measured **under 24 hours** — a sweep's own output went stale the day it was
written. the check runs when a file is touched or it is theatre; a quarterly cadence catches
nothing. **[measured]**

🚫 **never build an llm-judge memory audit.** judge models agree on verdicts >99.88% of the time
while fabricating different reasoning per run (~19% reasoning stability) — an agent auditing its
own memory produces confident, unfalsifiable verdicts. deterministic checks in code; llms only
for semantics a human then confirms. **[read]**

## trimming — the order is binding

the «why» paragraphs are **scaffolding, not fat**, while a surface is still being built: a rule
without its reason can only be obeyed or deleted, never corrected. they come out **last**, in this
order, and no earlier:

1. the coordinator's own story reaches a verdict
2. the obsidian `worklog.md` and `inbox.md` are exhausted
3. frozen handoffs are reviewed and resolved
4. **then** the memory is freed from clutter

📌 and «out» now means **into an html comment**, not deleted. the reason costs nothing there, and
the measured cost of losing it is a file that regrows faster than it did the first time.
