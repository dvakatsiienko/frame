---
researched: 2026-08-23
sources-current-as-of: cc 2.1.241 · arXiv 2601.11783 · Offscript CHIIR 2026 · measured on this corpus
refresh-when: a mechanical check is added or falsified, or the drift-latency finding stops holding
ticket: DOT-216
---

# nurture-memory — recipe

**run this instead of re-planning an inventory.** it is the recipe that came out of the first
full sweep; the sweep itself was one execution of it. recipe entity per [_spec.md](_spec.md).

📌 **run #2 ([FRM-267](https://linear.app/x-com/issue/FRM-267)) reads
`docs/research/skill-authoring-best-practices.md` first** — Anthropic's skill best practices and
the Fable 5 guide, checked against us, one action line per rule, and the run's checklist to copy
and tick. the steps below stay the method; that file is the run's input.

## the want (dima's, 2026-08-27)

> i want fleet memory system to be pristine. every bit of memory should live in its place
> vertically. the memory must not be a poem, nor the bytecode. as slim as possible to do its
> job, natural for me to sometimes peek, trim, tweak. primarily maintained by fleet. no
> useless, stale memories. i am the owner overall, carrier of the ideas. skill-wise: same.

## research vectors (DRAFT — re-groom with dima before the next run's research phase)

- what changed in cc's memory / import / `paths:` / skill mechanics since last run
- new agent-doc craft worth distilling (incl. dima's channel parses — theo, matt pocock — via
  yt-transcript)
- new memory-hygiene practice and tooling for agent fleets — new checks worth adding to the
  loop, anthropic memory features, community approaches
- **the snapshot diff, first and cheapest**: re-download Anthropic's two pages as `.md` (append `.md`
  to the docs url) and `diff` them against the snapshots in
  `docs/research/skill-authoring-best-practices/` — only the delta is new reading; then replace the
  snapshots

## analysis vectors (local evidence — the running agent is the instrument)

- which memories misfired or sat unused across recent sessions — a leaf never load-bearing
  since the last sweep is a retirement candidate, not a keeper by default
- did any silent-failure class (dead import, truncate-before-read, index sweep) fire since
  last run — and does `method-silent-failures` already name its shape?
- placement drift: any leaf grown past one decision, any fact living at the wrong altitude
  (project-wide fact in a coordinator leaf, fleet fact in a project file)?

## artifacts (pointed at, never housed — the pristine distilled results)

- `docs/knowledge/authoring-memory.md` · `authoring-memory-project.md` · `authoring-skill.md` —
  distilled from research runs and video parses; each research phase refreshes them, raw
  findings die after the distill
- the memory tree itself is the run's working surface, not an artifact
- 🧹 **keeping the two authoring docs fresh** — every run, on both:
  - the snapshot diff (research vectors) decides what is new; nothing is re-read whole
  - one layer per file: craft is matt's `writing-for-agents`, these hold cc mechanics + the rules we
    adopt; a line that restates another layer is cut
  - every claim keeps its tag ([measured] / [read] / [inferred]) with a version or date; a fact
    whose version is behind the running cc is re-probed or cut
  - investigation stories move to a research doc with a `dies-when`; the doc keeps the conclusion
  - a size budget per file, written in the file's frontmatter; a fold that crosses it trims first
- [nurture-memory-checklist.md](nurture-memory-checklist.md) — the complementary run checklist
  (dima's recipe): a run can span sessions, its state lives there; reset per run, shape kept

🔴 **LIVE during a sweep — this file is edited WHILE the work happens, not after.** every step that
turns out wrong, every check that fires false, every thing the loop missed gets fixed here in the
same session it was found. a recipe written up afterwards is a memory of a recipe; this one
has to be the thing that was actually run.

📌 **a skill candidate, not a skill yet.** it earns a trigger once it has run twice and the steps
stop changing. until then it is a doc, reached by a pointer. **decided (dima, 2026-10-02): after
run #2 it becomes `cclio:nurture`, user-invoked only, with this recipe and its checklist inside the
skill dir.** `docs/knowledge/authoring-*.md` stay where they are — every session that edits a skill
or memory reads them, coders included, and a cclio-only skill dir would hide them from that audience.

📌 **executor: a cclio-booted agent, from the cclio dir** — the checkup is vertical by design
(placement is half the job, steps 3 + leaf-review 2), and only the coordinator holds the whole
chain resident to judge placement against.

### step 0 · the mechanical pass — code only, no judgment, no model

runs first because it is free, exact, and it shortens every later step. **never an llm judge here**
(see the guard below).

| check | how | today's precision |
| -- | -- | -- |
| **closed-ticket citations** | every `FRM-N`/`BYT-N` in a resident file → ask linear its state → flag Done/Canceled ids sitting within 2 lines of open-state language (`tracks it`, `trial`, `awaiting`, `pending`, `until he decides`) | **~92%** — 12 flagged, 11 genuine |
| **dead `@import`** | every `@slug` in a barrel resolves to a file | clean |
| **barrel omission** | every leaf on disk is imported; every import exists | clean, 54/54 both ways |
| **dead file reference** | a named `rules/x.md` / skill / doc that is gone | this is what caught `dispatch.md` |

🚫 **the naive path-existence regex does not work — 94 flagged, ~2 real.** run 1 fixed it with the
`cursor://file/` convention (an absolute, machine-checkable path); that convention died on
2026-09-26 (https-only links — the Code tab and cw strip custom schemes). the next run owes a new
anchor for this check, or accepts the named-reference row alone.

### step 1 · the inventory — what exists and what it costs

- every memfile, every rule, every skill, every project `CLAUDE.md`
- for each: bytes, est. tokens at **2.89 chars/token** (measured on this corpus — `/4` undercounts
  by ~38%), and whether it is resident or deferred
- 🎯 **the number that matters is not total size. it is `resident × never-used`.**

🎯 **the method that makes this nearly free, and it is the run-2 accelerator:** the whole loaded
chain is **already in context**, so traversing it costs zero reads. Do the extraction as one script
over the file list — sizes, pointers, inbound-link counts — and read only what the script flags.
The first sweep took a full session; a follow-up should take a fraction, because the map exists and
only the diff needs walking.

⚠️ **measure on disk, never in `/context`.** Memory loads once at session start, so `/context` shows
the pre-sweep figure and lists files already deleted. It is a boot snapshot, not current state.

### step 2 · the duplication pass

**the highest-value single check**, because duplication is a *decay multiplier*, not just a cost:
one board change falsified **twelve** files at once here.

- find the same claim stated in more than one place
- pick the one authoritative home, delete the rest, leave a pointer only if the reader would
  otherwise not find it
- 📌 measured on run 1: 8 of 11 real defects were **one sentence written eight times**

🚨 **duplication crosses layers, and that is where the big wins are.** Run 1 found the same content
in `rules/` and in coordinator memory, in root and in a leaf, in a rule and in a skill. Checking
each layer against itself misses all of it. Examples that fell out: the spawn-defaults table was
verbatim in an always-loaded rule *and* in a leaf · a boot rule existed in three places · a whole
tracker rule duplicated a coordinator memory.

### step 2.2 · the cruft pass — `/doctor prompt-audit`, then `/claude-api prompt-audit`

📌 **a terminal step**: `/doctor prompt-audit` and `/skill-doctor` run only in an interactive `claude` in a terminal — the desktop Code tab answers «not available on this connection» (2026-10-07); dima types them there, or the run falls back to the second door + a duckdb join of skill loads over the transcripts.

first door since cc 2.1.280: `/doctor prompt-audit` (built in) audits CLAUDE.md, skills, agents
and commands for prompting patterns written for older models, in one invoke — agents and commands
are ground the older door never covered. apply its findings by hand. (? unprobed: whether a
`claude --bg '/doctor prompt-audit'` spawn runs it the way `/run-skill-generator` ran — try that
first, else dima types it) (evergreen borrow, dima's yes 2026-09-28)

the second door, still useful on a single file or on memory leaves: the bundled `claude-api` skill's `prompt-audit` subcommand, run over root `CLAUDE.md` + `rules/`
(then cclio's memory, then the skills): it lists instructions written for older models — hedges,
restated defaults, «be thorough»-class no-ops — with `file:line` and a proposed diff, changes
nothing by itself. ran once on 2026-09-07: four hunks over root + rules, all applied. one invoke,
read the report, apply by hand. (dima's fold, 2026-09-07)

🎯 **the Fable 5 delete-test** — Anthropic: skills written for older models «are often too
prescriptive … consider removing older instructions if default performance is better». for each
prescriptive line (CAPS, «ALWAYS», a list of cases a short sentence covers, a step the model does
anyway): run the skill's real ask in a fresh session without the line, compare with a run with it,
keep the line only if the run without it is worse. lines are tested in groups per skill, never one
run per line; a line with a written incident behind it is kept unless the run proves it a no-op.

### step 2.5 · the merge pass — one subject per file

Duplication removes copies; this removes **fragmentation**, and it was the larger win on run 1.

**The test: is this one subject split across several files, or several subjects in one file?**
Splitting by *topic* feels tidy and costs real tokens — each fragment pays its own preamble,
cross-reference block and frontmatter, and the reader pays to reassemble them.

Measured on run 1: five spawn files → one, at 43% of the total · ten pm files → one, at 40% ·
six strategy branches → one, at 53%. **The saving is not the content, it is the connective tissue.**

📌 The counter-test, so this does not become «merge everything»: a merge is right when one *decision*
was split. It is wrong when two decisions merely share a topic. Two files about verification stayed
separate because one says «state the proving command» and the other says «do not relay unverified».

### step 3 · the placement pass

each surviving item through the bucket test (see `authoring-memory.md`). the question is never «is
this true» — step 0 settled that — it is **«who pays for this, and do they need it».**

🎯 **the sharpest single test run 1 produced, and it emptied a whole section on its own:**

> **Does this line change a behaviour, or does it describe a mechanic and justify a rule?**

Documentation of something the harness already does is the most common form of dead resident text,
and it never reads as stale — it reads as correct, because it is. `## Global Defaults` lost every
line to that question.

📌 **A rule that asks the agent to DO something to the system must name the exact call.** No call →
the file buys awareness of a wall at full resident cost. That job belongs to `settings.json`, a hook
or `permissions.deny`, which act instead of informing. **[measured]** — a registry describing an
unreachable action read as correct until someone tried.

### step 4 · the deferral pass

- ✅ **`paths:` WORKS at user scope — measured, both directions.** three canary rules planted in
  `~/.claude/rules/`, two fresh sessions, cc 2.1.241:

  | rule | at boot | after touching a matching file |
  | -- | -- | -- |
  | no frontmatter | loaded | — |
  | frontmatter, no `paths:` key | loaded | — |
  | `paths: ["**/*.canaryzone"]` | **absent** | **injected** |

  so frontmatter alone does not exclude a rule; the `paths:` key does. the deferral lever is real.

  🚨 **the trigger is the `Read` tool, NOT file access.** round 1 read the matching file with
  `cat` through Bash and the rule never appeared; round 2 used `Read` on the same path and a
  system-reminder injected the rule immediately. **this is the finding that decides whether
  `paths:` is safe here** — a session told to prefer Bash for reads (bypass mode says exactly
  that) would silently never fire a single scoped rule. a `paths:` rule and a deleted rule look
  identical from inside such a session.

  📌 `globs:` remains a **silent no-op typo** — a mistyped key downgrades a scoped rule to
  always-on with no error. the key is `paths:`.

  🚫 **converting is still a weighted call per rule**, never automatic: the glob has to genuinely
  be the trigger, and anything whose real trigger is an *intention* cannot defer at all.

  📌 2026-08-25 additions, measured: **`Write` of a NEW matching file fires nothing** — a scoped
  rule cannot remind at creation time, only on later reads. two live `paths:` rules now exist as
  the pattern: `rules/authoring-trigger.md` (agent-consumed docs → load writing-for-agents) and
  `rules/guide-skill-trigger.md` (.ts/.tsx → load the guides). controlled result from one session:
  description-triggered skills missed 2/2, the injected `paths:` trigger hit 1/1 — injection
  beats descriptions; descriptions stay the primary trigger only because injection cannot cover
  new files or intentions.
📌 **frontmatter is usually not the lever it looks like.** A `name:` field duplicates the filename
and is a live drift surface — rename the file and it goes stale silently. A `type:` field is not
read at runtime. Keep frontmatter only where something actually consumes it.

- what else can take `paths:` once proven? (code-shaped conventions tied to a glob)
- what should become a **doc reached by a pointer** instead of a resident rule?
- what should become a **skill** — a recipe with a name someone would invoke?
- ⚠️ what genuinely cannot defer: anything whose trigger is an **intention** rather than a file

### step 4.5 · the skills lane — same loop, two extra questions

skills ride the same steps (inventory, duplication, placement); their extra per-skill questions,
proven 2026-08-25:

- **completion criterion** — does the skill state a checkable done-condition? write one (a state
  assertion: a hash, an `ls`, a named list — it doubles as an eval oracle), or name why the skill
  honestly doesn't want one. no invented ceremony.
- **groom verdict** — keep / trim / merge / drop, plus the bucket check (is this skill really a
  rule, a doc, or memory?). paired skills need **symmetric descriptions** — a pair-pointer inside
  an unloaded body fires after the decision it was meant to steer.
- **a description edit is proven by `claude plugin eval`, never by reading it** — the case
  shape, the grader and the cost live in [nurture-skills-hillclimb](nurture-skills-hillclimb.md).
- **the structure checks** (the research file's rules 2, 5, 6, 8): every step tagged by how much
  freedom it needs — a fragile step is a script, not prose; every reference file linked straight
  from `SKILL.md`; a contents list on any on-demand file over 100 lines; an ordered skill carries a
  copyable checklist and a «return to step N» line on its verify step
- **Claude B**: after a skill changes, a fresh session runs one real ask with it; its transcript is
  read for files never opened, links not followed and steps skipped — a miss goes back to the edit
- the authoring stack for any edit: `writing-for-agents` (craft, load first) →
  `docs/knowledge/authoring-memory.md` (vertical map + checklist) → `docs/knowledge/authoring-*.md`
  (mechanics, on demand).
- **the groom-half checklist, proven on the 15-skill pass (2026-08-25):** full taste rewrite per
  skill (keep points, cut connective tissue — opus-era wordiness is the default finding) · md
  tables → bullets (the ban lives in `fleet-output-format.md`; even «real matrix» claims mostly
  died on contact) · drop `intended-models` on touch · description checked against «WHEN leads,
  WHAT trails» · heavy human-only skills get `disable-model-invocation: true` (removes the
  description from the listing budget) · investigation history moves to a doc, the skill keeps
  conclusions + pointer · a trigger whose firing is doubted gets a TRACER — the injected rule
  tells the reader to name which door fired (see `rules/guide-skill-trigger.md`).

### step 4.8 · the self-correction rule

a flaw seen twice becomes a check, a script or a hook — never a third line of prose. attention runs
out; a validator does not (`method-silent-failures`). the flawlog flush at each halt names the
repeats; the sweep turns each into its mechanism.

**a check that fires often is a root to fix, not a gate to add** (dima, 2026-10-02: «if it triggers
too much on a repeating answer, it essentially forces you to do additional turns … if a certain
assert repeats a lot, then it needs to be fixed instead»). the reply check
(`shelf/hooks/reply-check.py`, log-only) is read with `pnpm reply-check:report`: a rule near the top
gets its cause fixed (a sharper positive rule, a template, a tool that writes the shape for me);
blocking is only for a rule that stays rare and costly. the format rules keep their positive target
(«every id is a link»); the enforcement prose around them («the mechanical scan before sending»)
is cut once the log shows the rule holds.

### step 5 · the human gate

**pruning is not delegated.** an agent files the candidate with its evidence; dima decides a file
should exist and decides a file should stop existing. that split is not caution — it is what the
evidence supports.

### 🚫 the one thing not to build

**do not build an llm-judge memory audit.** measured, arXiv 2601.11783, 115,200 judgments: judges
reach **>99.88% verdict agreement** while their *reasoning* stability collapses to **≈19%** — they
agree on the answer and fabricate different evidence for it each time. `Offscript` (CHIIR 2026) is
the same shape: 84.6% of conversations flagged, **22.2% material after human review**.

📌 that paper's own recommendation is this recipe, stated in its words: *«delegate all
deterministically verifiable logic to code, reserve llms for semantic evaluation.»* step 0 is code,
step 5 is human, and no step scores a rule's quality with a model.

### ⏱️ cadence — and this is the finding that sets it

🚨 **drift latency here is under 24 hours**, measured: `rules/dispatch.md` was deleted in the
morning and two docs still described it in the present tense by the afternoon. **so a monthly or
quarterly checkup cannot be the mechanism.**

- **step 0 runs on commit** — it is code, it takes seconds, and it is the only thing fast enough
- **steps 1–5 run when dima calls an inventory** — no timer, no scheduler, just a fact that it is
  needed periodically

---


## the project-leaf pass — proven 2026-08-26, closes a sweep

the checkup above covers the resident chain; project memfiles (`AGENTS.md`/`CLAUDE.md` in bytes,
inner-marker, rl, …) age separately and get their own pass at sweep end:

1. `find ~/projects -name AGENTS.md -o -name CLAUDE.md` (skip template/tutorial repos)
2. per file: **examine the project first** (scripts, deps, layout), then judge the file — most
   post-overhaul files were already modern; only the untouched ones (space-explorer pair) needed
   rewrites
3. rewrite test: environment restated → point at it; tutorials → delete; keep only unwritten
   conventions and gotchas
4. 📌 measured en route: the `paths:` read-trigger does NOT fire on bash `cat` reads — batch
   file reading bypasses the authoring-trigger rule entirely

## the leaf-by-leaf review — recipe, proven 2026-08-24

🎓 **the round format lives in `x:step-by-step` — invoke it, do not re-invent it here.** the whole
review runs through that skill (one item per round, four bullets, dima steers, «next» advances);
graduated 2026-08-25 after two proven runs (memory leaves, skills groom). what stays here is the
review-specific craft on top:

1. **vertical introspection on every leaf** — can content pour into root memory, `rules/`,
   `projects/CLAUDE.md`, a skill, or a doc? placement first, prose second.
2. **full-rewrite mandate**: every leaf is a rewrite candidate (opus-era wording, dispatch-era
   provenance). keep points, cut connective tissue, current-model taste.
3. **renames are graph operations** — grep for the name before and after; barrel pointer, wikilinks,
   docs, symlinked plugins (`plugin-x-cw`) all carry edges. re-probe the barrel after.
4. **commit per cluster** with explicit pathspecs; count and report unpushed.
5. dedupe across LAYERS (rule vs leaf vs skill), one home per moral, siblings point.

## the cw field — the last step when a synced master changed

cw gets cc memory only through dima's hand: sections under a `<!-- sync: cw -->` line in root
`CLAUDE.md` and `rules/*.md` render into his claude.ai `account / profile / instructions` field.
(this replaced the `memory-bridge-refresh-cw` recipe, retired 2026-10-02 — dima: «it is manual now
and no longer automated».)

- the want, his words: «cc is the source of truth, generally. cw memory is a derived view, never the
  origin.» · «i dont want a mess there» · «memory must be pretty» · «no poems!»
- when the run changed any synced section: `pnpm memory-sync:map` (what reaches cw, chars vs the
  field's cap) → `pnpm memory-sync:copy` → dima pastes into settings › account › profile ›
  instructions for claude → a new cw thread runs `/x-cw:memory-update check`
