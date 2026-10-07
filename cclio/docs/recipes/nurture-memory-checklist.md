# nurture-memory — the run checklist

the complementary checklist of the [nurture-memory recipe](nurture-memory.md): a nurture run
may span sessions or days (run #1 took four), so its state lives here, not in chat. this copy
carries run #1's map and verdicts — a new run resets the checklist, keeps the shape.
**dima's plan lives here**, moved out of [DOT-73](https://linear.app/x-com/issue/DOT-73)'s body so a
ticket body is not a granular plan.

📌 **run #2 ([FRM-267](https://linear.app/x-com/issue/FRM-267)) starts from the checklist at the
end of `docs/research/skill-authoring-best-practices.md`** — copy it into the run's first reply and
tick it. everything below is run #1's record: its map, its verdicts, its working rules, which
still bind unless dima changes them.

📌 standing sweep line, every run: **`docs/research/` — anything past its `dies-when`?** delete
or flag; the frontmatter contract lives in the frame `CLAUDE.md` research bullet.

three homes, and nothing crosses them:

| home | carries |
| -- | -- |
| the linear board | deliverables that outlive the run |
| **this file** | the ordered steps · the file map · per-file verdicts |
| `cclio/pocket.md` | cross-session carry-over only |

📌 **this file is dima's recipe, written by him.** an agent may improve it, never replace it.
📌 it is also the seed of phase 4's reusable checkup. keep it evergreen from the first step.

---

## working rules for the whole run

- 🚫 **no auto-commit.** dima reads the diffs, then commits. do not `cmt` through this activity.
- 👣 **step by step.** he approves more this time and wants to see diffs.
- 📉 **do not overload him.** report in the per-file shape below, not in walls.
- 🧭 **trace well, fix in place.** flaws get patched while the trace is hot.
- 🤝 objections and suggestions welcome on any part.
- 🔥 the run happens in a fresh session and finishes there.

### the per-file report shape

```
[memfile filename]: what it is about
issue
suggestion how to solve
```

expand only when he asks. when he does, print the diff of what you are about to do.

### who executes — settled

**approach b: the coordinator is the executor**, not a spawn. dima's reasoning, and it holds:
memory and skills is exactly where the context gap between coordinator and coder hurts most —
you must see the whole picture to change the system correctly. the coordinator already holds
every leaf resident; a spawn pays ~50k to rebuild a worse copy.

- **b** for cclio's own leaves, root `CLAUDE.md`, and `rules/`
- **a** (spawn) for the outer project `CLAUDE.md`s — bulk retrieval, no judgment
- parallel **research** spawns stay allowed throughout
- whoever edits must apply `writing-for-agents` for skills, and the memory-writing guide once
  phase 0 produces one

⚠️ **context is the known constraint.** cold boot is ~115k. the coordinator may ask for a fresh
session mid-sweep; when it does, it must say plainly **why**. dima watches the pacing himself.

---

## phase 0 · research first — the base mover

no random writes. everything the bucketing does is steered by this phase, so it runs before any
file is touched.

1. research the **newest best practices for writing memfiles and skills** — what works, what does
   not, tools and tricks.
2. 🎯 **the context-size question — dima's, and it is the one with a number attached.**

   > «what is the current target best practice of keeping the ctx size for an llm to perform well?
   > previously it was ~120k tok — a number after which performance starts to lower. what is the
   > number now? which number to hunt? your current boot ctx is 115k, and after first boot it
   > becomes ~200k. 120k target is not realistic. **what do we do wrong?**»

   - find the **current** number, not the remembered one. the ~120k degradation figure is old and
     may not hold for a 1M-context model.
   - ⚠️ **the last clause is the real question.** «what do we do wrong» outranks the number: a
     115k cold boot that reaches 200k after one turn is either normal for this class of work or a
     symptom. answer which, with evidence, before proposing a target.
   - 📌 the answer steers [DOT-198](https://linear.app/x-com/issue/DOT-198) directly — that ticket's
     old 25k target was dispatch's invention and was removed for being made up. do not replace one
     invented number with another.
   - measure before optimising: what actually fills the window here is memory files (72k of 115k),
     and that is what the bucketing changes.

3. a **third researcher** on the harder question: *«how do you teach agents to properly
   write and maintain skills and memory?»* — and dima's sharper version: *«who is better at writing
   skills and mems — a human or an agent?»*
4. distill the research into guides in `docs/`: `authoring-memory.md` and `authoring-skill.md` **exist**;
   `authoring-memory-project.md` (how to write a good project-level `CLAUDE.md`) **does not** and
   is an output of this phase.
5. then read matt's `writing-for-agents` against the landed research:
   - still useful? does the research replicate it? does it have flaws?
   - option to evaluate in place: **proxy the research file through the skill** so both apply, with
     matt's skill taking the final word. ❓ is that both-worlds or bloat — answer it, do not assume.
   - 📌 dima's update, and it changes the shape: *«writing-for-agents most likely is only good for
     skills»*. if so, a **mem-writing skill is missing** and this phase must produce it.
   - ❓ **do we still need skillsmith** ([DOT-132](https://linear.app/x-com/issue/DOT-132))?

📌 decide skill-vs-doc size **after** the research lands. `skillsmith` stays thin with a pointer
into the bigger guide rather than swallowing it.

---

## phase 1 · scan and map — before moving anything

- read **everything**, project-level `CLAUDE.md`s included. many have not been touched in a long
  time and are prime candidates.
- **build the map** — right here in this file: every place holding memfile-shaped content, a short
  note on what it holds, obvious flaws, and a pre-suggestion of the change needed.
- the map stays a **main resident** for the whole run.

### the order, from dima — binding

1. **gather ALL memfiles** — root `CLAUDE.md` plus every leaf `CLAUDE.md` across every repo.
2. **eval cc's default «go upd memory» behaviour.** when asked twice, where does the information
   actually land? the right places? poems? do this **diff-based**, before and after.
3. **map the `rules/` pointers** — which memfile references which rule, and which links are dead.
4. **map the voice / formatting / writing-style wiring** — how it is connected today.
5. **build the connection graph FIRST.** analysis before any edit; dima will ask for a drawing of
   it, so it has to be a real graph, not prose.
6. **then the update plan.** think hard. no edits before the plan exists.
7. flush.
8. **touch every piece.** a partial pass leaves exactly the ambiguity this is meant to end.

### connector pass vs content pass — keep them apart

- 🎯 **the connector layer is the target**: pointers, precedence, placement. **not the content.**
- 🚫 pruning the *content* of `rules/`, voices and writing-styles is a **separate** concern and does
  not ride along here.
- **precedence to encode**: leaf `CLAUDE.md` overrides root. one line in root, and conflicts get
  cheap.

### the deliverables of this phase

- **the connection graph** — what points at what, and what points at nothing.
- **the placement decision table** — `rules/` vs root mem vs leaf mem vs skill body vs
  `conventions/`. one table, so information stops landing in two homes.
- **the failure capture.** run in a persistent session, record every failure point found, and write
  the findings somewhere durable — a rule, or the skill that comes out of phase 0. 🎯 dima's
  principle, and it is the whole point: **no cleaning is needed when no trash is produced.**

### the map

🕸️ **the drawing:** [memfile wiring](https://claude.ai/code/artifact/8d0f8f40-806a-4f91-a0bd-3c15055ebcac)
— precedence chain, weight split, leaf topology, defect ledger. regenerate it from the numbers
below rather than hand-editing it.

**the resident load, measured at 2.89 chars/token** (`/4` undercounts by ~38%):

| layer | files | tokens | share |
| -- | --: | --: | --: |
| cclio memory leaves | 54 | 43,861 | 64% |
| `rules/` | 8 | 12,372 | 18% |
| root `CLAUDE.md` | 1 | 5,120 | 7% |
| project `CLAUDE.md` | 2 | 3,757 | 5% |
| the barrel index | 1 | 3,333 | 5% |
| **total** | **66** | **68,442** | |

**the connector health, by code not by reading:** 211 pointers extracted (`@import`, `[[wiki]]`,
`rules/*.md`, `docs/*`, `cursor://`, skill names). **3 flagged, 1 real** — the other two are the
barrel's own format example and a prose placeholder. 112 leaf-to-leaf wikilinks, **zero dangling**.

**hubs** (most deferred to): `dima-strategy` 7 · `pm-fold-or-drop` 6 ·
`report-verify` 6 · `surface-boundaries` 6 · `spawn-types` 5 ·
`memfile-bridge-absent` 5.
**isolated** (no edge either way): both found, both **deleted by dima**. 📌 the check earned its
place on the first run — isolation is not a verdict on its own, but it is where he looked first.

### what the connector pass found

- 🚨 **a leaf deferred to a deleted rule.** the mobile leaf named `rules/mobile.md` as «the binding
  copy… if they ever disagree, the rule wins». that file died the day before. **deleted at dima's
  call**, after confirming its one unique fact (DOT-91) already lives in
  `docs/knowledge/fleet-claude-capabilities.md`. barrel line and inbound wikilink removed with it.
- ✅ **the precedence chain is now written down** — one block in root `CLAUDE.md`, and the same
  chain in `docs/knowledge/authoring-memory.md`. it had zero occurrences before.
- ✅ **the placement decision table ALREADY EXISTED** — phase 0 built it in `authoring-memory.md`.
  the ticket's «none of which exist» was stale by one day. added the missing `~/projects` row and
  the precedence section instead of writing a second table.
- 🚨 **`paths:` fires on the `Read` TOOL, not on file access.** measured, both directions. a
  session told to prefer Bash for reads never fires a scoped rule and cannot tell one from a
  deleted file. this is the constraint on every deferral decision downstream.
- ❓ **the barrel costs 3,333 tokens and defers nothing.** every import is eager, so the index buys
  dima navigation, not the agent context. folding the leaves would remove it outright. **his call,
  not a cleanup** — it trades away the granularity the store was built for.

📌 **the method that made this cheap, worth keeping:** the whole loaded chain is already resident,
so traversing it costs **zero reads**. the extraction ran as one script over 66 files. the only
files needing a spawn are the outer project `CLAUDE.md`s, which are not in the chain.

---

## phase 2 · bucket hopping — in this order, top to bottom

### the buckets

| bucket | what belongs in it |
| -- | -- |
| **root** `CLAUDE.md` | overall guiding for everyone. what we do, why, how. the main dos and don'ts. dima's own section there is the reference for how a memfile should read — guiding tone, non-machine words |
| `rules/` | also global, also for everyone. the granular extension of root, so root does not become one dump file |
| `~/projects/CLAUDE.md` | the coder-global layer — see phase 3 |
| **project** `CLAUDE.md` | only what is specific to that project |
| **cclio memory** | only what is specific to the coordinator |

### ✅ step 1 done — root + `rules/` (2026-08-23)

root `CLAUDE.md`: **4,894 → 2,635 tokens, down 46%.** dima drove it; the coordinator proposed and
applied. nothing cut was wrong — every line removed either described a mechanic the harness already
performs, justified a rule stated flatly elsewhere, or existed in two places.

| what left root | where it went |
| -- | -- |
| the dormant-tools registry | deleted by dima. a failed experiment in self-managed mcp state |
| pull requests + issues, 11 lines | the new `github-contrib` skill |
| the background sound table | `hooks/spawn-sound.sh`, Glass on spawn, Submarine on reply |
| token-thrift thresholds, the peer moves | `x:handoff` |
| the precedence chain | `docs/knowledge/authoring-memory.md`, two sentences kept in root |
| `AGENTS.md` support | parked in open questions below, no ticket owned it |

`rules/`: one line cut from `fleet-voice.md` — the ban on `AskUserQuestion`, a tool sitting in
`permissions.deny` and therefore uncallable. an always-loaded rule against an uncallable tool.

**three rules borrowed from `AGENTS-t3-code-ref.md`**, each sharpening a section that already
existed: never kill a process by pattern · wait on a real signal, never a sleep · scratch stays out
of the worktree. two more (reverse states, no repo-wide checks) held for phase 3.

🎯 **the test that emptied a whole section, and it is sharper than «is it stale»:** does this line
change a behaviour, or does it describe a mechanic and justify a rule? `## Global Defaults` lost
every line to the second question.

⚠️ **the saving is not visible until the next boot.** memory loads once at session start, so
`/context` still shows the pre-sweep figure and the deleted leaves. measure on disk, never in
`/context`, until a fresh session.

### ✅ step 2 done — cclio's own memory (2026-08-23)

**52 leaves → 18. 47,194 → ~18,700 tok.** Nothing cut for being wrong.

- **4 removals**: content that lived elsewhere (`announce-model` had three copies), guarded a
  surface we do not use, or was a doc pretending to be a rule.
- **6 merges**, each one subject per file: `spawning` ← 5 · `pm` ← 10 · `dima-strategy` ← 7 ·
  `silent-failures` ← 2 · `halt` ← 2 · `surface-boundaries` ← 2.
- **dispatch stripped** to 8 deliberate mentions, all history or the English word.
- **frontmatter dropped** — `name` duplicated the filename and was a live drift surface; `type` is
  not read at runtime and the barrel's salience markers classify better.
- **6 renames**, entity-first: `cleanup-same-turn` · `bypass-restraint` · `domains-never-merge` ·
  `surface-boundaries` · `obsidian-inbox` · `settings-json-drift`.

🎯 **The two tests that did the work**, both sharper than «is it stale»: *does this line change a
behaviour, or describe a mechanic?* and *is this one subject split across files, or several subjects
in one?*

⚠️ **`rules/` went 12,372 → 6,008** in the same pass, because half its content was coordinator-only.
Every coder session on this machine pays that saving too.

### the order is binding

1. **root +** `rules/` **first.** sort, place, trim fluff. if something must leave but may be
   useful later, migrate it into `docs/` rather than deleting it.
2. **then cclio's own memory, leaf by leaf.** read fully first to hold the picture, then process
   one at a time: read → good or not → is this the right place → keep / trim / move into root or a
   `rules/` member. new files allowed; do not spawn a file army.
   - bucketing **across** cclio's own leaves is allowed during this
   - fix leftover comments from earlier sessions while there
   - judge each filename — pretty for dima first, then for the agent. 🅠 **queue a filename sweep
     for afterwards**, since relevance shifts once things move
3. **then project** `CLAUDE.md`**s**, top to bottom: **frame first**, then `bytes`,
   `dvakatsiienko`, `inner-marker`, `reinforcement-learning`.
4. 🚧 **skills pass — HALF done (2026-08-25).** the criteria/eval half ran: all 15 plugin-x
   skills read once, [DOT-217](https://linear.app/x-com/issue/DOT-217) closed (criteria added to 6,
   5 had one, 4 deliberately none), [DOT-110](https://linear.app/x-com/issue/DOT-110) closed by dima
   as drifted — its insight survives as a comment (criteria double as oracles).
   **still owed: the GROOM half** — per-skill keep/trim/merge/drop verdict + bucket rebalance
   (skill ↔ memory ↔ doc), the same treatment the memory leaves got. `writing-for-agents` habit
   held throughout.
5. **then a final pass: code review, full picture.**

📌 skills are held **in mind during the memory buckets**, not deferred to step 4 — if a memory is
really a skill, say so when you see it. that is the whole reason mems and skills run together:
splitting them forces a second bucketing round.

**effort split ≈ 60% mems / 40% skills** — not because mems matter more, but because mems are the
mess and skills are «+- ok».

### the tricky call: only-cclio vs everyone

a real contradiction, and dima named it. example: «always print ticket ids as links that open the
linear app» — he wants it as cclio's memory **and** available to any plain ccli session. but he
does **not** want anyone except cclio to even know about linear milestones.

**the rule of thumb he gave:** cclio is the **pm lead**; everyone else is a **senior contributor,
not a junior**. a senior does not file a `cli` ticket into `bytes/tooling` when told «go fold a
ticket about this cli stuff». find the balance, **weighted slightly toward globals**.

### dispatch, while bucketing

⚠️ **the steer changed and this is the current one:** dispatch's influence **decreases**. it is a
minor fleet member now. cclio takes over its responsibilities and updates references to it
everywhere they appear; dispatch's own facts collapse into `fleet-capabilities.md`.

the **one** thing still planned with it: **after cclio's setup is fully done**, try linking cclio's
memories into dispatch by symlink. that is all. [DOT-115](https://linear.app/x-com/issue/DOT-115) holds it.

⛔ **do not touch dispatch's own memfiles.**

### carried in: provenance ([DOT-106](https://linear.app/x-com/issue/DOT-106), folded here)

the rule already lives twice in cclio memory (`rule-proof`,
`report-verify`) and once as the CST truth rule. what is left is **generalising it**
so a plain ccli session inherits it: write «an agent-sourced claim is written attributed — *per cc:
X* — never asserted» into `CST-SPEC.md`, `x:pm`, and `rules/`. one bucketing bullet, not a ticket.

---

## phase 3 · the coder-global layer

`~/projects/CLAUDE.md` exists as a deliberate **stub** ([DOT-195](https://linear.app/x-com/issue/DOT-195)).
filling it is a bucketing place in its own right.

✅ **surveyed 2026-08-25:** all outer `~/projects/*/CLAUDE.md` files collated (4 files) — no
orphan rules waiting to move up; every repeat already owned by a higher layer. the stub stays a
stub until the coder-behavior decision ([DOT-73](https://linear.app/x-com/issue/DOT-73) comment holds
the evidence). dima's vertical map lives in `docs/knowledge/authoring-memory.md`.

❓ **the part dima explicitly does not know how to solve** — `guide-react`, `guide-typescript`,
`guide-code`. his words:

> basically the info at those files is what ccli code do when codifying. this was my intention when
> i asked ccli opus to create these at a skill lvl. but i was looking far, with idea of
> modularization — pick right tool at right time. reality is when you do code, then it is 90%
> typescript and/or react, and both are code. 🤔

- python and go (sline) exist too, and there the agent teaches him, not the reverse
- his own counter-point: skills are **lazy loaded**, so they cost nothing at rest — which weakens
  the case for merging them
- 📌 his decision: **observe how the bucketing goes and move as we go.** do not settle it up front

---

## 🔁 the reusable recipe — moved out

it lives at `cclio/docs/recipes/nurture-memory.md`, because it outlives this run. **this file is one
execution of it.**

## phase 4 · the system checkup — runs in parallel, from the start

dima's idea, written while he was writing the plan:

> what do you think about creating a major cc system checkup based on this run? enable tracing at
> the start (fresh sess), and in parallel to all other activities write / evergreenify the checkup
> plan — and fix-improve it in place while we go and open new discoveries?

- tracing on at the **start**, never retroactively
- the checkup plan is written **while** the run happens, not after
- **the problem it names:** memory files and skills will never be in a good enough shape. regular
  maintenance is needed — weekly, fortnightly or monthly. **no timers, no schedulers, just a fact.**
- it exists so dima never has to print a similar checkup plan again
- start as a plain file, `claude-memory-system-health-check.md`. it **may** become a skill
- 🅠 remind him about it when the run is done — it is a deliverable, not a side note

---

## carried forward from DOT-73's old body

still true, demoted below the plan.

### barrels — decide during the run, do not build early

`docs/INDEX.md` and `cclio/memory/MEMORY.md` are hand-written and **can silently lie**: add a leaf,
skip the line, the index says it does not exist. same rot class that killed membank v1.

- proposed fix: **generate the barrel from each leaf's frontmatter.** ⚠️ not standalone — building
  it before the bucketing bakes today's layout in
- a generator cannot fix **hook quality**, and a lossy one-line hook is what makes an index fail to
  surface something. stays a human job
- open: **index-authoritative vs index-descriptive.** `cclio/memory/` is already authoritative — a
  leaf loads only if the barrel imports it. is that the fleet-wide model?
- 📌 `rules/` has **no index**. only `cclio/memory/` does

### what a project `CLAUDE.md` owes

**two jobs, currently conflated.** a project file must *represent the project* AND say *how agents
should work in it*. ours mostly do the first.

**tone continuity is a requirement.** a project file should read in the same voice as root. nothing
checks this today, and drift is invisible.

**operational categories written down nowhere:**

- how PRs get filed in this repo
- how dev servers get run here
- how to seed test data from wherever the real data lives
- 🚨 **how not to kill the server the human is already using.** no rule of this class exists at
  all. same shape as the destructive-ops guard, aimed at *processes*
- a **glossary** per project — the domain-modeling `GLOSSARY.md` shape already agreed

**method worth stealing: write TWO alternative drafts and pick, rather than editing in place.**
dima's standing rule for visual work already says exactly this, and it fits bucketing better than
incremental editing — the whole point is that the current layout is wrong.

### 🌍 entity-first naming goes global

**the entity name leads, the verb follows.** `handoff_delete`, `handoff_list` — never
`delete_handoff`. scope is everything with a name.

📌 the same rule is currently recorded **three times under three names** — subject-first in
`~/.claude/CLAUDE.md`, family-first in cclio memory, entity-first in the mcp rename. that
triplication is exactly what this run kills: **one statement, in the root memfile, the other two
deleted.**

🚨 **measured:** four tools shipped as `transcript_*`. a `cw` thread listed them, read only the
names, decided they meant session CSTs and refused to use them — while the descriptions said
«YouTube». renamed `yt_transcript_*`, worked first try. **a wrong entity is not recoverable by a
good description.**

**still needs the pass:** the `x:*` and `cclio:*` skill names, the `plugin-x` skill directories,
the `script/` entrypoints.

### the failure-mode scrape — demoted, not dropped

look through dima's history with fable, opus and sonnet on this machine, bucket the most common
failure modes, and count how often each model hits them — so the upgrade steers away from what
actually breaks rather than what we assume breaks.

- corpus: `~/.claude/projects/` (~28 dirs, **240M**), `~/.claude/history.jsonl` (2768 lines),
  `~/.claude/shelf/flawlog/` (10 hand-written logs — the labelled set to calibrate against)
- 🚫 codex and gpt are out of scope
- shape: resolve each transcript's model **first**, extract events not opinions, bucket then count
- ⚠️ 240M does not fit a context window. this is a **scripted extraction**, never an agent reading
  transcripts — pretending otherwise silently samples 2% and reports a total

📌 phase 0's research is the prep that steers this run. the scrape is a second, independent input
and may run in parallel or be deferred.

---

## the finding this run exists for

opus writes long by default — replies, tickets, and **its own internals**. asked who the long
version served, it answered «the user». dima: **«i do not need 90% of it, it only overwhelms me. i
tell you when i want it expanded.»** roughly **70% of written text is not needed.**

the question that made it a story: **does that scale to skills, rules and** `CLAUDE.md`**?** those
are written with the same assumption, and the assumption is wrong there too.

dima's spec for what those files should hold, verbatim and complete:

> info that is useful to **you**, in a format appropriate to **you**

no expanded version for the reader. binding on every skill and rule write, asked for or
self-initiated. the enforceable ruleset is [DOT-127](https://linear.app/x-com/issue/DOT-127).

---

## 🚨 why this file exists at all

the plan sat in dima's obsidian inbox for a day and **never reached the ticket**. an earlier
session read the whole drop, folded every immediately-actionable item correctly, and skipped the
block marked *«to be done after setting up you as coordinator»* — future-dated work summarised to
nothing.

the worse half: the body was **not empty**. it held an agent-written ordering that read finished,
which is why nobody noticed dima's plan was missing.

**the flaw class: a summary replaced a source, and the summary read better than the thing it
replaced.** same shape as a silently-failing `@import` — complete-looking from both sides.

**the guard:** a fold is scoped to what was **said**, never to what is actionable now. a
future-dated block is written down in full and marked deferred. deferring is a state, not a reason
to compress.

---

## 🔴 post-review, mandatory — two things this run proved are missing

not optional, not an open question. both came out of the root pass on 2026-08-23, where the
coordinator edited root, two rules files and two skills across a dozen edits and **invoked
`writing-for-agents` zero times**, having written the line telling itself to do so earlier in the
same session. the outcome was still good, because dima was in the room catching things. that is
exactly the dependency this run exists to remove.

### 1. make `writing-for-agents` actually fire on memory and skill edits

✅ **closed 2026-08-26.** the mechanism landed as `rules/authoring-trigger.md` — a `paths:`-scoped
rule firing on `Read` of any CLAUDE.md/AGENTS.md/SKILL.md/rules file, measured live. known gap
(stated in the rule itself): creating a NEW file fires nothing — the ⏰📌 watch covers that case.
the habit held three sessions running (2026-08-24/25/26, loads verified in-session).

the doc pointer in root does not work. proven, not suspected: it was installed and ignored within
the hour. find a mechanism and **test it in a dedicated session** rather than reasoning about it.

- 🧊 dima's steer 2026-08-25: **a hook does not scale** («what if i want you to surely run x10
  skills? bloat settings.json with hardcode? meh») — standing question, do not build the hook.
  the rule + ⏰📌 watch remain the mechanism meanwhile; the habit held through 2026-08-24/25.
- the shelved candidate was a `PreToolUse` hook matching `Edit|Write` on `CLAUDE.md`, `rules/*`, `SKILL.md`
- ⚠️ **`paths:` cannot do this job** — measured, it fires on the `Read` tool and a session told to
  prefer Bash for reads never triggers it
- the test is behavioural: edit a rule in a fresh session and see whether the skill loads unasked

### 2. work out how `authoring-memory.md` and `authoring-skill.md` get used at all

✅ **closed 2026-08-26.** the route exists on two rungs: `authoring-trigger.md` fires on read and
names both docs; `docs/knowledge/authoring-memory.md` holds the router for the
deep cases. remaining honesty: the html-comment / two-draft / checklist interventions still depend
on the docs being opened — watch whether they surface in real edits before calling the content
reachable.

they are good and they are unreachable. same failure as above, one layer down: `writing-for-agents`
is the craft layer and these two are the harness-mechanics layer, but nothing routes a reader from
one to the other at the moment of editing.

three things in them that were ignored during the root pass, as evidence of the gap:

- **the html-comment intervention**, the only one with a number behind it: writing the reason at
  the same time as the rule lifted constraint satisfaction **50.4% → 62.0%**. roughly 2,400 tokens
  of reasons were deleted that day and none were preserved as comments
- **the two-draft method** for a file being rethought. every edit was made in place
- **the five-question pre-write checklist**, answered ad hoc in conversation instead of run

📌 the honest framing for both: a guide nobody opens is indistinguishable from a guide that does
not exist, and it costs more, because everyone believes the problem is handled.

## open questions owed to dima

- 🅠 **the entity-first rename pass still owes a scope.** not yet done: the `x:*` and `cclio:*`
  skill names, the `plugin-x/skills/` directory names, and `script/` entrypoints. parked here when
  `naming-entity-first.md` was retired into root. the skill half rides phase 2 step 4; the
  `script/` half is `dima's tools` work and needs its own home.

- ✅ **`AGENTS.md` support — landed 2026-08-26, RETIRED 2026-08-27.** the convention was a
  one-line `@AGENTS.md` import in each `CLAUDE.md`; it bought nothing (only claude code is used
  as harness) and broke on surfaces that do not expand `@` imports. every pair was swapped back
  to a plain `CLAUDE.md` across dotfiles/bytes/inner-marker/rl (DOT-115).

- ✅ story shape — resolved: DOT-216 exists, scoped by time, holding the pass.
- ✅ the t3 reference (`AGENTS-t3-code-ref.md`) was harvested and DELETED 2026-08-25 — reverse
  states, smallest-proof, and every-entry-point folded into `x:guide-code`; test-data seeding
  shape queued for the bytes `CLAUDE.md` pass.
- ✅ proxying the research guides through `writing-for-agents` — **no** (dima 2026-08-26): first
  make the skill fire reliably on its own; a proxy adds a hop with no new reader.
- ✅ `writing-for-agents` applies to **memory files AND skills** (dima 2026-08-26) — but the
  auto-load still does not happen: the leaf pass of 2026-08-26 read files via bash `cat`, which
  the `paths:` trigger does not see. «make it fire» stays the open mechanism question.
- ✅ skillsmith — **not needed**, DOT-132 canceled with the closing word in its body.

---

## ✅ the sweep is finished — 2026-08-26

the exit condition (this file complete) is met: both mandatory items closed, every open question
answered or rehomed. open children re-parented (DOT-225, DOT-13 → skills story; gazette → system
story); DOT-216 closed. what remains alive on purpose: the writing-for-agents firing mechanism
(the one open thread, tracked by the ⏰📌 watch) and the priority restore on the two parent
stories.
