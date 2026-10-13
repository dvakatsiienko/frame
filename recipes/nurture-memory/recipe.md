---
kind: nurture
owner: coordinator
artifacts: [home/.claude/plugin-x/skills/author-memory/references/memory.md, home/.claude/plugin-x/skills/author-memory/references/memory-project.md, home/.claude/plugin-x/skills/author-memory/references/skill.md]
script: none
groomed: 2026-10-13 (dima)
was: [nurture-skills]
---

# nurture-memory

grooms the fleet's memory and skills: root `CLAUDE.md`, `rules/`, `~/projects/AGENTS.md`, project `AGENTS.md`, cclio memory, skills. 📌 a memory sweep is a run of this recipe, never a new plan.

## contents

- the want
- the run
- vectors
- artifacts
- findings

## the want

dima, 2026-08-27:

> «i want the fleet memory system to be pristine. every bit of memory should live in its place
> vertically. the memory must not be a poem, nor bytecode. as slim as possible to do its
> job, natural for me to sometimes peek, trim, tweak. primarily maintained by the fleet. no
> useless, stale memories. i am the owner overall, the carrier of the ideas. skill-wise: same.»

the checkup, his idea in run #1's plan (2026-08), so he never prints a checkup plan again:

> «what do you think about creating a major cc system checkup based on this run? enable tracing at
> the start (fresh sess), and in parallel to all other activities, write / evergreenify the checkup
> plan — and fix-improve it in place as we go and make new discoveries?»

dima, 2026-10-11, after printing the whole sweep script a second time:

> «i printed the whole script again, which i shouldn't — we already did such a big sweep once. make sure the memory sweep script is clearly defined in a recipe so it is not buried. it serves as the global plan outline for each memory sweep and evolves with the live sweep: we refresh this recipe live as we gain new findings. that's why i asked you to log our memory sweep process as we go and trace it. after the sweep we do a retro on the actions we performed, refresh the script one more time at the very end, and seal it until the next memory sweep.»

dima, 2026-10-07, his brief for run #2 (`_hq/memory-sweep.md` in the vault):

> «i don't expect the data to only grow. think critically and suggest deleting data that produces no value and doesn't make the fleet faster and better — no dead weight. it applies to everything we process: memories, skills and recipes.»

> «overall tactic: let's aim for delete-first. i started maintaining cc memory 1.5–2 years ago, and a lot has changed since. this sweep i'd rather try it: intend to delete first, see how it affects you, then add back gradually. it relates to the note where the recent anthropic 5.5 models were marketed as "not compatible with old memory setups". let's unload the memory as much as possible and keep only the overall, what relates to what i want. if some details drop and you start behaving differently from what i want, that's fine, we'll tweak the memories. tldr: prefer zipping/deleting. not too aggressively though.»

> «how to optimize your init so you weigh less. is everything you preload truly useful?» — measured 2026-10-07: cclio on boot 117k of 1m tokens, memory files 81.2k, skills 8.2k

dima, 2026-10-12, on what delete-first means, since it sounds dangerous:

> «i don't ask you to delete everything. the system should work, and our habits should stay. what i don't want in a memory is fluff or unnecessary info: it holds only the instructions i asked for, or instructions that help the fleet operate. nothing else — no duplicates, no unnecessary explanations. delete first is only about this.»

> his two reasons: «our memory was bloated because you mostly only add into memories and skills — folding the lanes' retros and the flawlog — and no mechanism reduces it; that's why the halt now also grooms and trims the places you fold into.» and «the anthropic 5.5 release: its memory and skill docs suggest dropping much old memory — the restrictions, the capitals, the yelling; a study cut the cc system prompt by a large share, and performance did not drop, maybe even grew.»

dima, 2026-10-12, the run's outline:

> «1. the nurture-memory script tells you to trace the memory sweep process, for the retro at the end. 2. the full sweep. 3. once the full sweep is done: review, hunt drifts, fix them. 4. then a retro on the sweep's trace file: what were the interesting findings, what were the mistakes, and how to improve the nurture-memory recipe so future runs go better. 5. then done.»

dima, 2026-10-11, on anthropic's «older skills are often too prescriptive … consider removing older instructions if default performance is better»:

> «it is true — i indeed restrict you too much. some restrictions are also true, but i am myself interested in where i restrict you too much. by removing some constraints from view, you can operate more fluently. … i would be interested to explore loosening your permissions via this recommendation.»

his spec for what a memory file holds, run #1 (2026-08), after «i don't need 90% of it, it only overwhelms me. i'll tell you when i want it expanded.»:

> info that is useful to **you**, in a format appropriate to **you**

his questions, run #1, answered in `author-memory/references/memory.md` and re-asked every run:

> «what's the current best-practice target for the ctx size an llm needs to perform well? previously it was ~120k tok — the number after which performance starts to drop. what's the number now? which number to hunt? your current boot ctx is 115k, and after the first boot it becomes ~200k. a 120k target is not realistic. **what do we do wrong?**»

> «how do you teach agents to properly write and maintain skills and memory?» · «who is better at writing skills and mems — a human or an agent?» · «writing-for-agents most likely is only good for skills» (answered by his own verdict below: it covers both)

his standing calls:
- between sweeps: `cclio:halt` phase 3a, «the redundancy hunt» (dima, 2026-10-07)
- what the cuts never touch (2026-10-11): «i'm interested in memory cuts, but i want to keep things like output format, emojis, and other stuff, and our main flow frameworks. let's see what we can remove without breaking our flow or making your output ugly.»
- `writing-for-agents` covers memory files and skills, and fires first rather than proxying the research («no, make it fire first»); no skillsmith ([DOT-132](https://linear.app/x-com/issue/DOT-132)); the enforceable ruleset is [DOT-127](https://linear.app/x-com/issue/DOT-127)
- no hook forcing skill loads: «what if i want you to surely run x10 skills? bloat settings.json with hardcode? meh» (2026-08-25)
- cw: «it is manual now and no longer automated» (the bridge recipe retired, 2026-10-02) · «cc is the source of truth, generally. cw memory is a derived view, never the origin.» · «i don't want a mess there» · «memory must be pretty» · «no poems!»
- a check firing often is a root to fix (2026-10-02): «if it triggers too much on a repeating answer, it forces you to do additional turns … if a certain assert repeats a lot, then it needs to be fixed instead»

skills, dima, 2026-10-11 (the want of the old `nurture-skills`, merged here on his word, 2026-10-13):

> «then do the same with skills: review each skill and groom, trim, cut, and rebalance the info load across the other parts where it makes most sense.»

> «i want all skills to be lean and clear, while not conflicting with resident memory.»

> «skills should be shaped via the best practices defined in our skills knowledge.»

his standing calls on skills:
- a skill nobody fires that costs context is a prune candidate before any hillclimb (2026-10-06)
- `x:author-memory` stays one skill, with references `memory.md`, `memory-project.md` and `skill.md` (2026-10-13)
- `claude plugin eval` is wanted, but no eval runs at all until his $200 plan: «evals blow ctx too quickly» (2026-10-13, 20:03; it replaced his same-day call to run evals on a free quota window)

## the run

- **trace as you go**, two kinds, the same turn (dima, 2026-10-12): every action lands as one line at the end of the sweep's run file (`docs/test-drive/memory-sweep.md`) — a step with no line did not run, and run state never lives in chat; and a round that shows a flaw class, a mistake or a tip adds one line to that file's `## findings` — the patterns of bad memory to hunt next time, what went wrong, what made the sweep faster. step 10's retro reads `## findings` first. `last/groom-list.md` (born at step 4) holds one line per memory file with its state, flipped the turn its step lands.
- **re-entry, at every start and every resume** (a boot, a checkpoint, a compaction), before any groom (dima, 2026-10-11, after a run groomed 27 files «read whole, unchanged» with the guides out of context: «16k tokens is cheap next to redoing 50 files» — cclio's line, his verdict):
  1. the standard boot: `cclio:boot`, every member woken, «checkpointed» said
  2. read WHOLE, never skimmed: this recipe · `mattpocock-skills:writing-for-agents` · `x:author-memory` (its SKILL.md and all three references) — they are this recipe's research distilled, the lens every file is groomed through
     **why whole, every time — the trap is the reflex that skips them.** the guides look long and the next edit looks small, so reading them feels like overhead. it is the work: they hold 5–10 research rounds and dima's video folds from months, and without them in context a groom checks pointers and cuts nothing. measured 2026-10-11: 27 files passed «read whole, unchanged», the resident drop came only from one lucky cut, and 50 files had to be reopened. ~16k tokens of reading is cheap next to redoing 50 files — cclio's own line, dima's verdict: «it very precisely describes the reason to read these guides before a memory sweep»
  3. the state: `last/groom-list.md` and the last lines of `docs/test-drive/memory-sweep.md`; then the sweep, with all of it in context
- **the goal is the smallest form that does its job** (the want: «as slim as possible … no useless, stale memories»): a groom that checks for staleness and pointers but cuts nothing has not run; size is measured on every file
- **delete-first** (the want, 2026-10-07 and 2026-10-12): a line stays when it is an instruction dima asked for or one that helps the fleet operate; fluff, a duplicate or an explanation goes, and a behaviour that drifts afterwards earns its line back. it never cuts a working habit or the system's flow. boot memory in `/context` (dima types it) is read at the start and the end as a direction, smaller, never a target to hunt: the 10-07 81.2k was one reading, «I just want a memory to be as slim as possible» (dima, 2026-10-11)
- **the cadence, end to end** (dima, 2026-10-11: a whole sweep in ~45 rounds over 3–4 sessions, never one file a turn):
  - a session start: 1 turn, the re-entry reads · step 1: 1 round · step 2: 1 turn launching the lanes in the background, 1 reading them · step 3: 1–2 rounds, one per guide · step 4: 1 scripted turn
  - steps 5–8, every file by size: **≥5 KB alone** in its round (two drafts only for a rethink) · **2–5 KB in pairs** · **<2 KB in batches of ~6** — ~30 rounds for ~84 files. one proposal file per round, each file in it with bytes before → after and its lens verdicts; dima ticks the round once in orbit, a note on one file holds back only that file
  - step 9: ~6 rounds, the same size batching · step 10: 2–3 turns
  - **🌤️ siesta with `wishkeeper` 🐬** after 2 big rounds or 5 smaller ones, whichever comes first; it reads what was applied (ccrow's decision wake reads each proposal as it is written)
  - a fix is never its own report turn: `habit-dima-comms-pacing`
  - **a checkpoint comes on context** (cclio:checkpoint's 600–700k trigger) or dima's word, never on a seam alone (dima, 2026-10-11, o267); when one is due it lands at a clean seam, never mid-round: after step 4 · after `rules/` · after the cclio leaves · before step 9; each CST carries only the state, its META first-act 1 is this recipe's re-entry
- **the order is dima's**: an agent improves it, never replaces it. a wrong step is fixed here the same session; at the end, a retro over the traced actions, one last refresh of this section, then sealed until the next sweep.
- **the coordinator executes**, booted in `~/frame/cclio`: it holds every leaf resident. spawns only for judgment-free bulk reads and research. a sweep spans as many sessions as it needs; the trace carries it.
- **his working rules**: a «chunk» is one groomed file, an `oN` is an orbit ask's id (his tick on it in the board is his answer); no auto-commit; his per-item ticks plus the list of removed lines count as his read, and an untouched item waits for his read of its diff (dima, 2026-10-11, o95) · step by step · objections welcome · a per-item report, expanded only on his ask: `file: what it is · issue · fix`.
- **in every step** (dima, 2026-10-11): the re-entry reads above held in context · conflicts and duplicates hunted first, then fluff and over-explanation · deletion candidates go to him with evidence, never an essential fact or a live habit · reword shorter and natural · each file reads top to bottom · best practices applied (a TOC on a big skill) · a rethought file gets two drafts, he picks.
- **each round's apply runs the touched repos' commit gates, no commit** (ccrow, 2026-10-12: five over-wide claims in a day, each caught hours later by a siesta, because the sweep commits only at the halt): the working-tree forms, never the staged ones (lefthook and `index-run.sh` read the index, so unstaged groom edits pass unseen, and staging them reaches every peer's commit gate): frame `pnpm typecheck && pnpm test`, bytes `pnpm apps:essentials` + `pnpm typecheck`, in every repo the round touched; a red means the round is not applied, and the reply names the gates it ran with their exit codes
- **the quote gate, before every commit of a groomed file**: `python3 cclio/script/quote-diff.py HEAD <files>` lists every «…» quote that left; each one of dima's is restored or shown to him beside its new form before the commit, never judged away in silence (10-11: a groom dropped five of his, «all kept» was said unchecked).
- **dima's `cclio:` comments** (2026-10-11): during a sweep he leaves `<!-- cclio: … -->` notes in the files; each step greps for them first and resolves each in place or answers it in the thread, then removes the note.
- **a fold keeps what was said**: a future-dated block is written in full and marked deferred, never summarised away — run #1's plan lost a block marked «to be done after setting you up as coordinator» to a summary that read finished.
- 🚫 **no llm-judge audit**: what code can verify is code (step 4), pruning is human (step 10); the numbers are in `author-memory/references/memory.md` § upkeep.

1. **groom this recipe** — `x:shape-recipe` step 0: every want line true, every vector serving one, skills included. done: dima's word, `groomed:` stamped. (open)
2. **research** — no write before it lands. first the snapshot diff, the cheapest: re-download anthropic's two pages as `.md`, `diff` against `docs/research/skill-authoring-best-practices/`, read only the delta, replace the snapshots. then the vectors, all lanes at once (`x:shape-recipe`). done: every lane landed or failed out loud. (template)
3. **the knowledge distill** — into `x:author-memory` and every knowledge doc that steers memory and skill edits (`author-memory/references/skill.md` takes the skill mechanics and the evals prior art), concise without dropping a useful line. one layer per file: craft is `writing-for-agents`, these hold cc mechanics and our rules. every claim tagged [measured] / [read] / [inferred] with a version; one behind the running cc is re-probed or cut. stories go to a research doc with `dies-when`. a size budget in each file's frontmatter. done: every doc touched or «unchanged», bytes before and after logged. (open)
4. **the vertical audit — which memories bleed the most**: the rank is `resident × never-used`, tokens at 2.89 chars/token, measured on disk (`/context` shows the boot snapshot). (template)
   - **the mechanical pass**, code only: a closed `FRM-N` / `BYT-N` within 2 lines of open-state words (`tracks it`, `trial`, `awaiting`, `pending`; run #1: 12 flagged, 11 real) · a dead `@import` · barrel omissions both ways · a named rule, skill or doc that is gone · a named flag missing from `--help` · research past `dies-when`. it runs on commit: drift lands within a day. a naive path regex flagged 94 with ~2 real, so it stays out
   - **inventory and map** — dima's order, binding (run #1): gather ALL memfiles across repos → eval cc's default «go upd memory», asked twice, diff-based: right places? poems? → map `rules/` pointers, dead ones included → map the voice / format / style wiring → **the connection graph first**, a real one (he asks for a drawing; regenerate it from the numbers) → the groom list (the plan is that list, never a new plan file), no edit before it → flush → touch every piece. the connector pass (pointers, precedence, placement) stays apart from pruning content — dima: no cleaning is needed when no trash is produced. then one script over the list (sizes, pointers, inbound links), only its flags read; the connection graph drawn from the numbers; the voice and format wiring. an isolated leaf is where dima looks first
   - **the cruft pass**: the newest prompt audit is reused when it predates no big memory change (run #2 reused 10-07's `.scratch/memory-sweep/prompt-audit.md`, dima: «redundant to rerun»); else `/doctor prompt-audit` (terminal only, dima types it) or the `claude-api` skill's `prompt-audit` per file. the audit reruns at step 10, so the sweep ends with a before/after diff. each prescriptive line (CAPS, «ALWAYS», a case list) gets the delete-test: the real ask in a fresh session with and without it, kept only if without is worse. the run prints dima a list «where you restrict me too much»: each line that failed the delete-test, beside what it blocked. a line with a written incident may go too; its incident moves into a column-0 comment
   - **the trigger tag**: each section tagged `file-touch` (matters only when a kind of file is touched), `intention`, or `always`; a `file-touch` one is step 7's deferral candidate (a `paths:` rule loads on a read, `cat` or edit of a matching file, measured cc 2.1.296)
   - **the groom list** (dima, 2026-10-11: «create it before the sweep starts, after the research preps, and follow it as the progress tracker»): `recipes/nurture-memory/scripts/groom-list.sh` writes `last/groom-list.md`, every memory file by layer with its bytes; steps 5–10 flip its lines, and no file groom starts before it exists (steps 1 and 3 groom the recipes and the knowledge docs before it, by design). a new sweep regenerates it here; re-entry reads it only to resume. coverage is proven by diffing its paths against `find ~/.claude ~/frame ~/projects` for `AGENTS.md`, `CLAUDE.md`, `memory/*.md`, `rules/*.md` (worktrees and node_modules out): any extra path joins the list
   - done: the ranking in the run file and the groom list born
5. **root `CLAUDE.md` first** (`home/.claude/CLAUDE.md`), through step 7's lenses. done: dima read the diff. (open)
6. **then every layer in step 8's order; inside a layer, the worst bleeder first** (step 4's ranking). done: step 8's done. (open)
7. **then every leaf**, one per round through `x:step-by-step`, placement before prose; every file gets EVERY lens below, a verdict for each, its bytes before → after measured on disk. (open)
   - **the redundant kinds** — a line goes, moves or shrinks when it is:
     - **a dupe** — the same claim in another file or layer: one home keeps it, the copies go, a pointer only where a reader would not find it. duplication multiplies decay: one board change once falsified twelve files
     - **superseded** — a newer decision says otherwise, or it names a Done/Canceled ticket in open-state words, a dead file, a dead flag
     - **enforced** — a hook, a mod, a check or `settings.json` now does it: the prose line goes, the guard is the rule
     - **unused** — never load-bearing since the last sweep; the cost is `resident × never-used`. no instrument measures a memory line's use yet: the verdict names its evidence (a transcript grep for the line's trigger, a flawlog hit) or says «unmeasured», never a guess
     - **a no-op** — it describes a mechanic the harness performs, or a default the model obeys anyway. the test: does this line change a behaviour?
     - **the wrong altitude** — true, but only one surface or one project needs it: it moves down, it is not cut
   - **protected** — never cut as a no-op or fluff (dima, 2026-10-11, the want's «what the cuts never touch»): output format, emoji, the voice, a skill's trigger words, the main flow frameworks; the verdict names which protected lines the file holds
   - **trim without losing the reason**:
     - the instruction stays; the why moves into a block html comment, three lines at most: failure · why · outcome. a rule's «why» paragraph is scaffolding while its surface is still being built; it moves into the comment last, never into the bin
     - keep every date that IS the fact (an expiry, a measurement), every number, every incident behind a rule; shorten the prose, never the fact
     - a line with a written incident may go under delete-first: its incident moves into a column-0 comment, so the reason survives; «deleted and nothing broke» proves nothing when two rules overlap, so a drift afterwards earns the line back
     - 🚫 **dima's words in «» are never cut or reworded** — restructure around them; dropping one needs his word, the original shown beside the change
     - the target shape: separable facts, the positive target over the ban, info useful to the agent in a format for the agent — «i do not need 90% of it»
   - **merge** a split decision, never two decisions that share a topic
   - **placement** — the bucket test in `author-memory/references/memory.md`: «who pays for this, and do they need it». a line that asks for an action names the exact call, or moves to `settings.json`, a hook, `permissions.deny`. a memory that is really a skill is named. cclio is the pm lead, everyone else a senior contributor: lean slightly global
   - **deferral** — `paths:` is the only lever that keeps a file out of context: frontmatter alone excludes nothing, Bash `cat`, `Read` and `Edit` fire it, a `Write` of a new matching file does not (measured, cc 2.1.296)
   - **a rename is a graph operation**: grep the whole repo before and after (barrel, wikilinks, docs, code, symlinks), re-probe the barrel; done is the root naming rule's `grep -rn '<old name>'` printing nothing outside dated history
   - open, dima's: the `guide-*` split — «the info in those files is what ccli code does when codifying. that was my intention when i asked ccli opus to create these at a skill lvl. but i was looking far ahead, with the idea of modularization — pick the right tool at the right time. the reality is, when you code, it's 90% typescript and/or react, and both are code. 🤔» his call: skills cost nothing at rest, observe, move as we go. and a generated barrel vs a hand-written one
   - done: every file's groom-list line reads `- ✅ <path> — <before> → <after> B · lenses: dupe · superseded · enforced · unused · no-op · altitude · trim · merge · placement · deferral · protected — <what moved>`, each lens with its verdict; «unchanged» is a verdict only with the evidence for every lens; `recipes/nurture-memory/scripts/groom-list-check.sh` exits 0
8. **the order across layers**: root `CLAUDE.md` → `rules/` → all resident memory (cclio leaves; the pm surfaces are reviewed here, `.scratch/memory-sweep/issues/085-pm-review.md`) → project leaves (frame, `bytes`, `dvakatsiienko`, `inner-marker`, `reinforcement-learning`; cclio leaves read all first, keep / trim / move, judge filenames, then a filename sweep). a project leaf: `find ~/projects -name AGENTS.md -o -name CLAUDE.md`, the project examined before the file, a restated environment becomes a pointer, a tutorial goes; what a leaf owes is `author-memory/references/memory-project.md`. `~/projects/AGENTS.md` is a deliberate stub ([DOT-195](https://linear.app/x-com/issue/DOT-195)). done: every layer through step 7. (template)
9. **skills** (effort ≈ 60 % mems / 40 % skills: mems are the mess, skills «+- ok»): each skill reviewed, groomed, trimmed and its load rebalanced, against resident memory. the rulebook is `author-memory/references/skill.md` and `writing-for-agents` (its `SKILL-MECHANICS.md` for frontmatter and invocation); a skill line that restates or contradicts resident memory or a sibling keeps one home. (open)
   1. **the skills research** — a small run of its own, before the groom: the `skills:` vectors, all lanes at once (`x:shape-recipe`), distilled into `author-memory/references/skill.md`, bytes before and after. done: every lane landed or failed out loud, the doc touched or «unchanged»
   2. **the census** — per skill: fire count, last use, token cost, size, from `refresh-fleet-ops`' skill-load measure and `/skill-doctor` (terminal only, dima types it). done: the ranked list in the run file
   3. **the conflict hunt** — every skill against resident memory (root `CLAUDE.md`, `rules/`, cclio leaves) and its siblings: a duplicated or contradicting line gets one home. done: every hit verdicted
   4. **the groom**, the order in the pocket's skills-groom item (crew-coder and crew-verifier first, then the most used and the most bleeding), step 7's size batching:
      - a completion criterion that can be checked, or why none
      - keep, trim, merge or drop
      - the description leads with WHEN; a pair gets symmetric descriptions
      - steps tagged by freedom, a fragile one becomes a script
      - contents past 100 lines; tables become bullets
      - a heavy human-only skill gets `disable-model-invocation: true`
      - entity-first names carry a scope (`x:*`, `cclio:*`)
      - the info load rebalanced: what every branch needs stays inline, the rest behind a pointer
      - **Claude B**: a fresh session runs one real ask per changed skill; an unopened file or a skipped step sends it back
      - done: every skill verdicted, each changed one past Claude B
   5. **the fire loop** — only for a skill with a miss (a flawlog «skill not loaded» line, a router near-miss 0.30–0.70), and only once the $200 plan is live (parked in the pocket until then): his real prompts as `plugin-x/evals/<skill>-*` cases, split train and held-out test (`cmt`, `notes`, `pm` are the pattern); a baseline `claude plugin eval` on both; change one thing, keep it only if train rises and test does not drop; a round cap set first; each round logged in `docs/test-drive/`. a description edit is proven this way, never by reading. done: every missed skill looped, capped or parked for the $200 plan
   - done: steps 1–5 done, each traced in the run file
10. **the review, the gates, the retro** — after the full sweep, in this order (dima, 2026-10-12). (open)
    - **the drift hunt**: one more pass over the whole — what did we miss, and where did a sweep edit drift or break something: a moved section a pointer still names, a dead import, a rule that lost its only home, a skill pointing at a cut line. each one fixed
    - **the human gate**: pruning is never delegated; candidates go out as a digest:
      - ≤5 clusters per halt, related lines together; each line: the text quoted, why it goes (the kind above), the evidence (a grep, a ticket state, the guard's name, a load count), where the reason survives
      - dima answers per line: **yes** / **keep** / **later** — no «approve all», silence changes nothing
      - yes → deleted in one batch; the old text stays recoverable in git
      - keep → the proposal goes to `retire-log.md` in this folder (created by the first keep) with his reason, and never resurfaces unchanged; only new evidence re-proposes it, showing what changed
      - later → it rides the next digest
      - the agent drafts; existence and deletion are his (an llm grading its own memory cannot tell good from bad)
    - **self-correction**: a flaw seen twice becomes a check, a script or a hook; a check that fires often is a root to fix (`pnpm reply-check:report`)
    - **the cw field**, only when a `<!-- sync: cw -->` section changed: `pnpm memory-sync:map` → `pnpm memory-sync:copy` → dima pastes it into cw → a cw thread runs `/x-cw:memory-update check`
    - **the retro on the trace**: read `docs/test-drive/memory-sweep.md` end to end and answer three questions — what were the interesting findings, what were the mistakes, how does this recipe change so the next run goes better; the answers refresh this recipe, then it is sealed until the next sweep
    - done: the gates passed, today's line in `log.md`, the refresh committed

## vectors

### research

- what changed in cc's memory, import, `paths:` and skill mechanics since the last run
- new agent-doc craft from primary sources: anthropic's blog and docs, matt's skills repo
- new memory-hygiene practice and tooling for agent fleets
- the context budget: dima's «what do we do wrong» outranks any token number
- skills: memory and skill authoring practice, what writes well for agents now
- skills: the cc skills docs delta since the snapshot in `docs/research/skill-authoring-best-practices/` (loading, descriptions, `disable-model-invocation`, plugin evals, `/skill-doctor`)
- skills: plugin eval methods, and prior art in skill evals and hillclimbing (`author-memory/references/skill.md` § evals — prior art)

### analysis

- run #1's finding, re-checked: opus writes long by default; ~70 % of written text was not needed
- `docs/research/skill-authoring-best-practices.md`'s checklist against our files: an unchecked item is a finding
- which memories misfired or sat unused: `refresh-fleet-ops`' skill-load measure; a leaf never load-bearing since the last sweep is a retirement candidate
- did a silent-failure class fire, and does `method-silent-failures` name its shape?
- placement drift: a leaf past one decision, a fact at the wrong altitude
- the failure-mode scrape, theo's method: `~/.claude/projects/`, `~/.claude/history.jsonl`, `~/.claude/shelf/flawlog/`; events not opinions, bucket then count, scripted with duckdb — never an agent sampling transcripts
- skills: which fire, and the flawlog's skill misses since the last run, `#dima-caught` first
- skills: resident cost and size per skill; the ones that cost context and never fire
- skills: conflicts with resident memory, where a skill restates or contradicts it
- skills: `x:crew-coder` and the other crew skills against the 5k-token re-inject cap

### cut

- youtube channel parses (theo, matt) — dima, 2026-10-11: «it's 99% outdated»; a video he links is still transcribed on his ask

## artifacts

- `home/.claude/plugin-x/skills/author-memory/references/memory.md` — the memory authoring craft (placement, mechanics, measurements); the distill folds cc mechanics and our rules in; the per-file lenses live in step 7 here
- `home/.claude/plugin-x/skills/author-memory/references/memory-project.md` — what a project leaf owes; updated from step 8
- `home/.claude/plugin-x/skills/author-memory/references/skill.md` — the skill authoring craft and its evals prior art; step 9.1's distill folds new mechanics and our rules in

## findings

beyond the shared shape:
- resident tokens before → after, on disk, per layer
- what moved, merged and died, each with its reason
- tokens per skill before → after, and fire rates for every looped skill, train and test
- each mechanical check's precision, and any new check earned
- what the run proved wrong here, fixed here
