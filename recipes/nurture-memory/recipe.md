---
kind: nurture
owner: coordinator
artifacts: [docs/knowledge/authoring-memory.md, docs/knowledge/authoring-memory-project.md]
script: none
groomed: 2026-10-11 (dima)
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

dima, 2026-10-11, on anthropic's «older skills are often too prescriptive … consider removing older instructions if default performance is better»:

> «it is true — i indeed restrict you too much. some restrictions are also true, but i am interested myself where i restrict you too much. by removing some constraints from view, you can operate more fluently. … i would be interested to explore loosening your permissions via this recommendation.»

his spec for what a memory file holds, run #1 (2026-08), after «i don't need 90% of it, it only overwhelms me. i'll tell you when i want it expanded.»:

> info that is useful to **you**, in a format appropriate to **you**

his questions, run #1, answered in `authoring-memory.md` and re-asked every run:

> «what's the current best-practice target for the ctx size an llm needs to perform well? previously it was ~120k tok — the number after which performance starts to drop. what's the number now? which number to hunt? your current boot ctx is 115k, and after the first boot it becomes ~200k. a 120k target is not realistic. **what do we do wrong?**»

> «how do you teach agents to properly write and maintain skills and memory?» · «who is better at writing skills and mems — a human or an agent?» · «writing-for-agents most likely is only good for skills» (answered by his own verdict below: it covers both)

his standing calls:
- what the cuts never touch (2026-10-11): «i'm interested in memory cuts, but i want to keep things like output format, emojis, and other stuff, and our main flow frameworks. let's see what we can remove by not breaking our flow and not making your output ugly.»
- `writing-for-agents` covers memory files and skills, and fires first rather than proxying the research («no, make it fire first»); no skillsmith ([DOT-132](https://linear.app/x-com/issue/DOT-132)); the enforceable ruleset is [DOT-127](https://linear.app/x-com/issue/DOT-127)
- no hook forcing skill loads: «what if i want you to surely run x10 skills? bloat settings.json with hardcode? meh» (2026-08-25)
- cw: «it is manual now and no longer automated» (the bridge recipe retired, 2026-10-02) · «cc is the source of truth, generally. cw memory is a derived view, never the origin.» · «i don't want a mess there» · «memory must be pretty» · «no poems!»
- a check firing often is a root to fix (2026-10-02): «if it triggers too much on a repeating answer, it essentially forces you to do additional turns … if a certain assert repeats a lot, then it needs to be fixed instead»

## the run

- **the order is dima's**: an agent improves it, never replaces it. a wrong step is fixed here the same session; at the end, a retro over the traced actions, one last refresh of this section, then sealed until the next sweep.
- **trace as you go**: every action lands as one line in the sweep's run file (`docs/test-drive/memory-sweep.md`) the same turn; a step with no line did not run, and run state never lives in chat. `last/groom-list.md` (born at step 4) holds one line per memory file with its state, flipped the turn its step lands.
- **the coordinator executes**, booted in `~/frame/cclio`: it holds every leaf resident. spawns only for judgment-free bulk reads and research. a sweep spans as many sessions as it needs; the trace carries it.
- **his working rules**: no auto-commit; his per-item ticks plus the list of removed lines count as his read, and an untouched item waits for his read of its diff (dima, 2026-10-11, o95) · step by step · objections welcome · a per-item report, expanded only on his ask: `file: what it is · issue · fix`.
- **in every step** (dima, 2026-10-11): `writing-for-agents` and the authoring docs loaded first · conflicts and duplicates hunted first, then fluff and over-explanation · deletion candidates go to him with evidence, never an essential fact or a live habit · reword shorter and natural · each file reads top to bottom · best practices applied (a TOC on a big skill) · a rethought file gets two drafts, he picks · `wishkeeper` 🐬 reads the batch at each siesta, which comes every 5 groomed chunks (dima, 2026-10-11).
- **the quote gate, before every commit of a groomed file**: `python3 cclio/script/quote-diff.py HEAD <files>` lists every «…» quote that left; each one of dima's is restored or shown to him beside its new form before the commit, never judged away in silence (10-11: a groom dropped five of his, «all kept» was said unchecked).
- **dima's `cclio:` comments** (2026-10-11): during a sweep he leaves `<!-- cclio: … -->` notes in the files; each step greps for them first and resolves each in place or answers it in the thread, then removes the note.
- **a fold keeps what was said**: a future-dated block is written in full and marked deferred, never summarised away — run #1's plan lost a block marked «to be done after setting you up as coordinator» to a summary that read finished.
- 🚫 **no llm-judge audit**: what code can verify is code (step 4), pruning is human (step 10); the numbers are in `authoring-memory.md` § upkeep.

1. **groom the nurture recipes** — this one and `nurture-skills`, `x:shape-recipe` step 0: every want line true, every vector serving one. done: dima's word, `groomed:` on both. (open)
2. **research** — no write before it lands. first the snapshot diff, the cheapest: re-download anthropic's two pages as `.md`, `diff` against `docs/research/skill-authoring-best-practices/`, read only the delta, replace the snapshots. then the vectors, all lanes at once (`x:shape-recipe`). done: every lane landed or failed out loud. (template)
3. **the knowledge distill** — into `authoring-memory*` and every knowledge doc that steers memory edits (`authoring-skill.md` is `nurture-skills`' distill), concise without dropping a useful line. one layer per file: craft is `writing-for-agents`, these hold cc mechanics and our rules. every claim tagged [measured] / [read] / [inferred] with a version; one behind the running cc is re-probed or cut. stories go to a research doc with `dies-when`. a size budget in each file's frontmatter. done: every doc touched or «unchanged», bytes before and after logged. (open)
4. **the vertical audit — which memories bleed the most**: the rank is `resident × never-used`, tokens at 2.89 chars/token, measured on disk (`/context` shows the boot snapshot). (template)
   - **the mechanical pass**, code only: a closed `FRM-N` / `BYT-N` within 2 lines of open-state words (`tracks it`, `trial`, `awaiting`, `pending`; run #1: 12 flagged, 11 real) · a dead `@import` · barrel omissions both ways · a named rule, skill or doc that is gone · a named flag missing from `--help` · research past `dies-when`. it runs on commit: drift lands within a day. a naive path regex flagged 94 with ~2 real, so it stays out
   - **inventory and map** — dima's order, binding (run #1): gather ALL memfiles across repos → eval cc's default «go upd memory», asked twice, diff-based: right places? poems? → map `rules/` pointers, dead ones included → map the voice / format / style wiring → **the connection graph first**, a real one (he asks for a drawing; regenerate it from the numbers) → the plan, no edit before it → flush → touch every piece. the connector pass (pointers, precedence, placement) stays apart from pruning content — dima: no cleaning is needed when no trash is produced. then one script over the list (sizes, pointers, inbound links), only its flags read; the connection graph drawn from the numbers; the voice and format wiring. an isolated leaf is where dima looks first
   - **the cruft pass**: the newest prompt audit is reused when it predates no big memory change (run #2 reused 10-07's `.scratch/memory-sweep/prompt-audit.md`, dima: «redundant to rerun»); else `/doctor prompt-audit` (terminal only, dima types it) or the `claude-api` skill's `prompt-audit` per file. the audit reruns at step 10, so the sweep ends with a before/after diff. each prescriptive line (CAPS, «ALWAYS», a case list) gets the delete-test: the real ask in a fresh session with and without it, kept only if without is worse. the run prints dima a list «where you restrict me too much»: each line that failed the delete-test, beside what it blocked. a line with a written incident stays unless proven a no-op
   - **the trigger tag**: each section tagged `file-touch` (matters only when a kind of file is touched), `intention`, or `always`; a `file-touch` one is step 7's deferral candidate (a `paths:` rule loads on a read, `cat` or edit of a matching file, measured cc 2.1.296)
   - **the groom list** (dima, 2026-10-11: «create it before the sweep starts, after the research preps, and follow it as the progress tracker»): `scripts/groom-list.sh` writes `last/groom-list.md`, every memory file by layer with its bytes; steps 5–10 flip its lines, and no groom starts before it exists
   - done: the ranking in the run file and the groom list born
5. **root `CLAUDE.md` first**, through step 7's lenses. done: dima read the diff. (open)
6. **then the worst bleeders**, in step 4's order. done: the top of the ranking groomed. (open)
7. **then every leaf**, one per round through `x:step-by-step`, placement before prose. the lenses: (open)
   - **duplication** — the highest-value check: one board change once falsified twelve files. one home per claim, a pointer only where a reader would not find it
   - **merge** a split decision, never two decisions that share a topic
   - **placement** — the bucket test in `authoring-memory.md`: «who pays for this, and do they need it». does the line change a behaviour, or only describe a mechanic? a line that asks for an action names the exact call, or moves to `settings.json`, a hook, `permissions.deny`. a memory that is really a skill is named. cclio is the pm lead, everyone else a senior contributor: lean slightly global
   - **deferral** — `paths:` is the only lever that keeps a file out of context: frontmatter alone excludes nothing, Bash `cat`, `Read` and `Edit` fire it, a `Write` of a new matching file does not (measured, cc 2.1.296)
   - **a rename is a graph operation**: grep before and after (barrel, wikilinks, docs, symlinks), re-probe the barrel
   - open, dima's: the `guide-*` split — «basically the info in those files is what ccli code does when codifying. that was my intention when i asked ccli opus to create these at a skill lvl. but i was looking far ahead, with the idea of modularization — pick the right tool at the right time. the reality is, when you code, it's 90% typescript and/or react, and both are code. 🤔» his call: skills cost nothing at rest, observe, move as we go. and a generated barrel vs a hand-written one
   - done: every leaf through a round
8. **the order across layers**: root `CLAUDE.md` → `rules/` → all resident memory (cclio leaves; the pm surfaces are reviewed here, `.scratch/memory-sweep/issues/085-pm-review.md`) → project leaves (frame, `bytes`, `dvakatsiienko`, `inner-marker`, `reinforcement-learning`; cclio leaves read all first, keep / trim / move, judge filenames, then a filename sweep). a project leaf: `find ~/projects -name AGENTS.md -o -name CLAUDE.md`, the project examined before the file, a restated environment becomes a pointer, a tutorial goes; what a leaf owes is `authoring-memory-project.md`. `~/projects/AGENTS.md` is a deliberate stub ([DOT-195](https://linear.app/x-com/issue/DOT-195)). done: every layer through step 7. (template)
9. **skills — run `nurture-skills`** (effort ≈ 60 % mems / 40 % skills: mems are the mess, skills «+- ok»): each skill reviewed, groomed, trimmed and its load rebalanced, against resident memory; that recipe holds the steps. done: its log line for this sweep. (template)
10. **the global scrape and the gates** — one more pass over the whole: what did we miss, fix it. then: (open)
    - **the human gate**: pruning is never delegated; candidates go out as the groom card's digest (`authoring-memory.md` § the groom card)
    - **self-correction**: a flaw seen twice becomes a check, a script or a hook; a check that fires often is a root to fix (`pnpm reply-check:report`)
    - **the cw field**, only when a `<!-- sync: cw -->` section changed: `pnpm memory-sync:map` → `pnpm memory-sync:copy` → dima pastes it into cw → a cw thread runs `/x-cw:memory-update check`
    - **the retro and the seal**: a retro over the traced actions, one last refresh of this run, sealed until the next sweep
    - done: the gates passed, today's line in `log.md`, the refresh committed

## vectors

### research

- what changed in cc's memory, import, `paths:` and skill mechanics since the last run
- new agent-doc craft from primary sources: anthropic's blog and docs, matt's skills repo
- new memory-hygiene practice and tooling for agent fleets
- the context budget: dima's «what do we do wrong» outranks any token number

### analysis

- run #1's finding, re-checked: opus writes long by default; ~70 % of written text was not needed
- `docs/research/skill-authoring-best-practices.md`'s checklist against our files: an unchecked item is a finding
- which memories misfired or sat unused: `refresh-agent-ops`' skill-load measure; a leaf never load-bearing since the last sweep is a retirement candidate
- did a silent-failure class fire, and does `method-silent-failures` name its shape?
- placement drift: a leaf past one decision, a fact at the wrong altitude
- the failure-mode scrape, theo's method: `~/.claude/projects/`, `~/.claude/history.jsonl`, `~/.claude/shelf/flawlog/`; events not opinions, bucket then count, scripted with duckdb — never an agent sampling transcripts

### cut

- youtube channel parses (theo, matt) — dima, 2026-10-11: «it's 99% outdated»; a video he links is still transcribed on his ask

## artifacts

- `docs/knowledge/authoring-memory.md` — the memory authoring craft and the groom card; the distill folds cc mechanics and our rules in
- `docs/knowledge/authoring-memory-project.md` — what a project leaf owes; updated from step 8

## findings

beyond the shared shape:
- resident tokens before → after, on disk, per layer
- what moved, merged and died, each with its reason
- each mechanical check's precision, and any new check earned
- what the run proved wrong here, fixed here
