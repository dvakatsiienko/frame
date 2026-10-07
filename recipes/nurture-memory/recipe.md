---
kind: nurture
cadence: "the mechanical pass on every commit (code, seconds); the full run on dima's word, no timer; the delete digest at every halt (card.md)"
artifacts: [docs/knowledge/authoring-memory.md, docs/knowledge/authoring-memory-project.md, docs/knowledge/authoring-skill.md, recipes/nurture-memory/card.md]
script: none
---

# nurture-memory

grooms root `CLAUDE.md`, `rules/`, `~/projects/AGENTS.md`, project `AGENTS.md`, cclio memory and skills — **run it instead of re-planning an inventory**. run #2 ([FRM-267](https://linear.app/x-com/issue/FRM-267)) reads `docs/research/skill-authoring-best-practices.md` first: its checklist is that run's input, these steps the method.

contents:
- the want
- standing rules
- the run, 15 steps
- vectors
- findings

## the want

dima's, 2026-08-27:

> «i want fleet memory system to be pristine. every bit of memory should live in its place
> vertically. the memory must not be a poem, nor the bytecode. as slim as possible to do its
> job, natural for me to sometimes peek, trim, tweak. primarily maintained by fleet. no
> useless, stale memories. i am the owner overall, carrier of the ideas. skill-wise: same.»

the checkup, his idea in run #1's plan (2026-08), so he never prints a checkup plan again:

> «what do you think about creating a major cc system checkup based on this run? enable tracing at
> the start (fresh sess), and in parallel to all other activities write / evergreenify the checkup
> plan — and fix-improve it in place while we go and open new discoveries?»

run #1's finding: opus writes long by default, its own internals included; asked who the long version served, it answered «the user». dima: **«i do not need 90% of it, it only overwhelms me. i tell you when i want it expanded.»** ~70 % of written text is not needed, in skills, rules and `CLAUDE.md` too. his spec for those files, verbatim and complete:

> info that is useful to **you**, in a format appropriate to **you**

the enforceable ruleset: [DOT-127](https://linear.app/x-com/issue/DOT-127).

## standing rules

- 📌 **the run order is dima's plan** (written for run #1, moved out of [DOT-73](https://linear.app/x-com/issue/DOT-73)'s body): an agent may improve it, never replace it.
- **live recipe**: a wrong step or a miss is fixed here the same session; a recipe written afterwards is a memory of a recipe.
- **run state lives in a run file, never in chat** (run #1 took four sessions; run #2: `.scratch/memory-sweep/` + `docs/test-drive/memory-sweep.md`). linear holds what outlives the run, `cclio/pocket.md` cross-session carry-over only.
- **the coordinator executes**, booted in `~/frame/cclio` (dima's approach b): it holds every leaf resident, a spawn pays ~50k to rebuild a worse copy. spawns only for judgment-free bulk reads (outer project files) and research. it may ask for a fresh session mid-run (cold boot ~115k in run #1), saying why.
- run #1's working rules, binding until dima changes them: no auto-commit, he reads the diffs and commits · step by step · trace well, fix in place · objections welcome · one fresh session, start to finish.
- **the per-item report**, never a wall; expand only on his ask, then print the diff:
  ```
  [memfile filename]: what it is about
  issue
  suggestion how to solve
  ```
- **a fold is scoped to what was said, not to what is actionable now**: run #1's plan lost a block marked «to be done after setting up you as coordinator» to a summary whose agent-written ordering read finished. a future-dated block is written in full, marked deferred.
- ⭐ **a file being rethought gets two drafts, dima picks** (`authoring-memory.md` § the method).
- 🚫 **no llm-judge memory audit** (arXiv 2601.11783's numbers: `authoring-memory.md` § upkeep; Offscript, CHIIR 2026: 84.6 % flagged, 22.2 % material after human review). its advice: «delegate all deterministically verifiable logic to code, reserve llms for semantic evaluation.» step 2 is code, step 12 human.
- **drift latency is under 24 hours**: `rules/dispatch.md` was deleted one morning and two docs described it in the present tense that afternoon — the mechanical pass runs on commit, never on a calendar.
- 📌 decided 2026-10-02: after run #2 this becomes `cclio:nurture`, user-invoked; run #2 closes with that verdict. `docs/knowledge/authoring-*.md` stay put: every session editing memory or a skill reads them, coders included.

## the run

1. **research first** — no write before it lands. (template)
   - the snapshot diff, first and cheapest: re-download anthropic's two pages as `.md` (append `.md` to the docs url), `diff` against `docs/research/skill-authoring-best-practices/`, read only the delta, replace the snapshots
   - the vectors below, all lanes at once (`x:shape-recipe`)
   - distill into the authoring docs: one layer per file (craft is matt's `writing-for-agents`, these hold cc mechanics + our rules; a restated line is cut) · every claim tagged [measured] / [read] / [inferred] with a version or date, one behind the running cc re-probed or cut · stories to a research doc with a `dies-when` · a size budget in each file's frontmatter, a fold over it trims first
   - done: every authoring doc touched or named «unchanged»
2. **the mechanical pass** — code only, no model; it shortens every later step. (script)
   - closed-ticket citations: every `FRM-N` / `BYT-N` in a resident file → its linear state → flag Done/Canceled within 2 lines of open-state words (`tracks it`, `trial`, `awaiting`, `pending`, `until he decides`). run #1: 12 flagged, 11 genuine (~92 %)
   - dead `@import` · barrel omission both ways (run #1: 54/54) · a named `rules/` file, skill or doc that is gone (caught `dispatch.md`) · a named flag missing from `--help` · a carried probe, rerun · `docs/research/` past `dies-when`
   - 🚫 a naive path-existence regex flagged 94, ~2 real; run #1's `cursor://file/` anchor died 2026-09-26 (https-only links) — a new anchor is owed, or the named-reference check stands alone
   - done: every check ran, its flags listed
3. **inventory and map** — before moving anything. (template)
   - dima's order, binding: gather ALL memfiles across repos → eval cc's default «go upd memory», asked twice, diff-based: right places? poems? → map `rules/` pointers, dead ones included → map the voice / format / style wiring → **the connection graph first**, a real one (he asks for a drawing; regenerate it from the numbers) → the plan, no edit before it → flush → touch every piece
   - per file: bytes, tokens at **2.89 chars/token** (`/4` undercounts ~38 %), resident or deferred; 🎯 the number is `resident × never-used`
   - one script over the file list (sizes, pointers, inbound links), read only its flags — the chain is in context, traversal costs zero reads
   - an isolated leaf is not a verdict, but where dima looks first (run #1: he deleted both)
   - ⚠️ measure on disk: `/context` shows the boot snapshot, deleted files included
   - the connector pass (pointers, precedence, placement) stays apart from pruning content; every failure point is captured durably — dima: no cleaning is needed when no trash is produced
   - done: map and plan in the run file
4. **the cruft pass** — prompts written for older models. (template)
   - `/doctor prompt-audit` (cc 2.1.280+): CLAUDE.md, skills, agents, commands, one invoke. 📌 terminal only, like `/skill-doctor` — the Code tab answers «not available on this connection» (2026-10-07); dima types it, or fall back below + a duckdb join of skill loads. ? unprobed: `claude --bg '/doctor prompt-audit'` (dima's yes 2026-09-28)
   - the `claude-api` skill's `prompt-audit` per file: root + `rules/`, cclio memory, skills — hedges, restated defaults, «be thorough» no-ops, `file:line` + a diff. 2026-09-07: four hunks, all applied
   - 🎯 the Fable 5 delete-test — anthropic: older skills «are often too prescriptive … consider removing older instructions if default performance is better». each prescriptive line (CAPS, «ALWAYS», a case list, a step done anyway): the real ask in a fresh session with and without it, grouped per skill; kept only if without is worse. a line with a written incident stays unless proven a no-op
   - done: every finding applied or verdicted
5. **duplication** — the highest-value check: one board change once falsified **twelve** files. one home, copies deleted, a pointer only where the reader would not find it. run #1: 8 of 11 real defects were one sentence written eight times. 🚨 the wins cross layers: the spawn-defaults table in a rule and a leaf, one boot rule in three places. done: no claim lives twice. (open)
6. **merge, one subject per file** — each fragment pays preamble, cross-refs, frontmatter. run #1: five spawn files → one at 43 % of the total, ten pm → 40 %, six strategy → 53 %. so it never becomes «merge everything»: merge a split *decision*, never two decisions sharing a topic («state the proving command» and «do not relay unverified» stayed apart). done: every split decision merged. (open)
7. **placement** — the bucket test in `authoring-memory.md` (it already exists; run #1's ticket said «none of which exist», a day stale): «who pays for this, and do they need it». (open)
   - 🎯 **does this line change a behaviour, or describe a mechanic and justify a rule?** sharper than «is it stale», it emptied `## Global Defaults` alone; a harness mechanic reads correct because it is
   - a line asking the agent to DO something names the exact call, or moves to `settings.json`, a hook, `permissions.deny`
   - the order, binding: root + `rules/` (maybe-useful-later goes to `docs/`) → cclio leaves one by one (read all first; keep / trim / move; judge filenames, then a filename sweep) → project files: frame, `bytes`, `dvakatsiienko`, `inner-marker`, `reinforcement-learning` → skills → a final review of the whole
   - a memory that is really a skill is named on sight, or a second round follows; effort ≈ 60 % mems / 40 % skills: mems are the mess, skills «+- ok»
   - cclio is the pm lead, everyone else a senior contributor, not a junior: ticket links reach everyone, linear milestones only cclio; lean slightly global
   - `~/projects/AGENTS.md` is a deliberate stub ([DOT-195](https://linear.app/x-com/issue/DOT-195)), a bucket of its own
   - open, dima's: the `guide-*` split — «basically the info at those files is what ccli code do when codifying. this was my intention when i asked ccli opus to create these at a skill lvl. but i was looking far, with idea of modularization — pick right tool at right time. reality is when you do code, then it is 90% typescript and/or react, and both are code. 🤔» his counter: skills cost nothing at rest; his call: observe, move as we go
   - open, barrels: a hand-written barrel can lie (the rot that killed membank v1); generating it from frontmatter waits for the bucketing or bakes today's layout in, and fixes no hook. it defers nothing (3,333 tokens, run #1) — folding the leaves removes it, dima's call. `rules/` has no index; is cclio's index-authoritative model (a leaf loads only if imported) the fleet-wide one?
   - done: every item placed or verdicted
8. **deferral** — `paths:` is the only lever that keeps a file out of context (`authoring-memory.md`: the `Read`-tool trigger, the `globs:` no-op). (template)
   - canaries at cc 2.1.241: frontmatter alone excludes nothing, the `paths:` key does
   - `Write` of a NEW matching file fires nothing (2026-08-25)
   - injection beat descriptions: description-triggered skills missed 2/2, an injected `paths:` trigger hit 1/1 (2026-08-25); descriptions stay primary only for new files and intentions. the live pattern: `rules/authoring-trigger.md` (`guide-skill-trigger.md` was the second, since gone)
   - per rule, weighed: the glob must be the real trigger, an intention cannot defer
   - frontmatter only where read: `name:` drifts on a rename, `type:` is not read at runtime
   - done: every candidate verdicted — `paths:`, a doc behind a pointer, a skill, or stays
9. **skills** — the same loop, plus per skill: (template)
   - a completion criterion: a checkable state (a hash, an `ls`, a named list — an eval oracle too), or why none
   - keep / trim / merge / drop + the bucket check; paired skills get symmetric descriptions (a pair-pointer in an unloaded body fires too late)
   - a description edit is proven by `claude plugin eval`, never by reading (`recipes/nurture-skills/`)
   - the research file's rules 2, 5, 6, 8: steps tagged by freedom, a fragile one is a script · reference files linked from `SKILL.md` · contents past 100 lines · an ordered skill has a checklist and a «return to step N»
   - the groom, proven on 15 skills (2026-08-25): a full taste rewrite · tables → bullets (even «real matrix» claims died on contact) · drop `intended-models` · WHEN leads, WHAT trails · heavy human-only skills get `disable-model-invocation: true` · history to a doc · a doubted trigger gets a TRACER naming the door that fired
   - `writing-for-agents` loads first on any edit: run #1's root pass invoked it zero times across a dozen edits, right after writing the line telling itself to; `rules/authoring-trigger.md` closed that 2026-08-26 (a new file fires nothing), and a bash `cat` read still skips it, so «make it fire» stays open. no hook — dima, 2026-08-25: «what if i want you to surely run x10 skills? bloat settings.json with hardcode? meh»
   - entity-first names owe a scope: `x:*` / `cclio:*`, `plugin-x/skills/` dirs, `script/` entrypoints. tools shipped as `transcript_*` were refused by a cw thread that took them for CSTs while the descriptions said «YouTube»; `yt_transcript_*` worked first try — a description cannot rescue a wrong entity
   - **Claude B**: a fresh session runs one real ask per changed skill; its transcript shows unopened files, skipped steps — a miss returns here
   - done: every skill verdicted, each changed one past Claude B
10. **project leaves** — they age apart. `find ~/projects -name AGENTS.md -o -name CLAUDE.md`, skip templates; examine the project (scripts, deps, layout) before the file: environment restated → a pointer, tutorials → delete, keep conventions and gotchas; what a file owes: `authoring-memory-project.md`. a bulk `cat` bypasses the `paths:` authoring trigger (measured) — load `writing-for-agents` by hand. done: every file verdicted. (template)
11. **the leaf review** — one item per round via `x:step-by-step`, «next» advances: placement first, prose second · every leaf a rewrite candidate (opus-era wording) · a rename is a graph operation: grep before and after (barrel, wikilinks, docs, `plugin-x-cw` symlinks), re-probe the barrel · commit per cluster with pathspecs once dima read the diff. done: every leaf through a round. (open)
12. **the human gate** — pruning is never delegated: an agent files the candidate with evidence, dima decides that a file exists and that it stops. deletes go out as the `card.md` digest. done: every candidate verdicted. (open)
13. **self-correction** — a flaw seen twice becomes a check, a script or a hook, never a third prose line. a check firing often is a root to fix, not a gate — dima, 2026-10-02: «if it triggers too much on a repeating answer, it essentially forces you to do additional turns … if a certain assert repeats a lot, then it needs to be fixed instead». `pnpm reply-check:report`: fix a top rule's cause, block only a rare costly one, keep the positive target («every id is a link») and cut enforcement prose («the mechanical scan before sending») once the log shows it holds. done: every repeat has a mechanism or a ticket. (open)
14. **the cw field** — only when a `<!-- sync: cw -->` section (root `CLAUDE.md`, `rules/*.md`) changed; cw gets cc memory only by dima's paste (the bridge recipe retired 2026-10-02: «it is manual now and no longer automated»). his want: «cc is the source of truth, generally. cw memory is a derived view, never the origin.» · «i dont want a mess there» · «memory must be pretty» · «no poems!». `pnpm memory-sync:map` → `pnpm memory-sync:copy` → he pastes into settings › account › profile › instructions → a new cw thread runs `/x-cw:memory-update check`. done: check passed, or «no synced section changed». (script)
15. **log** today's line in `log.md`. done: the line is there.

## vectors

research (re-groomed with dima each run):
- what changed in cc's memory / import / `paths:` / skill mechanics since the last run
- new agent-doc craft, dima's channel parses included (theo, matt pocock) via `x:yt-transcript`
- new memory-hygiene practice and tooling for agent fleets: checks for the loop, anthropic memory features, community approaches
- the context budget: dima's «what do we do wrong» outranks any token number (his full question in `log.md`, the answer in `authoring-memory.md`)

analysis (local evidence):
- which memories misfired or sat unused — a leaf never load-bearing since the last sweep is a retirement candidate, not a keeper by default
- did a silent-failure class fire, and does `method-silent-failures` name its shape?
- placement drift: a leaf past one decision, a fact at the wrong altitude
- the failure-mode scrape, theo's method — rules written against what broke: `~/.claude/projects/`, `~/.claude/history.jsonl`, `~/.claude/shelf/flawlog/` (the labelled set); each transcript's model first, events not opinions, bucket then count. scripted (duckdb), never an agent reading transcripts, which samples 2 % and reports a total. codex and gpt out of scope

## findings

beyond the shared shape:
- resident tokens before → after, on disk, per layer
- what moved, merged and died, each with its reason
- each mechanical check's precision, and any new check earned
- what the run proved wrong here, fixed here
