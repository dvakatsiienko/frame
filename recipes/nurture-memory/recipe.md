---
kind: nurture
owner: coordinator
artifacts: [home/.claude/plugin-x/skills/author-memory/references/memory.md, home/.claude/plugin-x/skills/author-memory/references/memory-project.md, home/.claude/plugin-x/skills/author-memory/references/skill.md]
script: none
groomed: 2026-10-16 (dima)
was: [nurture-skills]
---

# nurture-memory

grooms the fleet's memory and skills: root `CLAUDE.md`, `rules/`, `~/projects/AGENTS.md`, project `AGENTS.md`, clio memory, skills. 📌 a memory sweep is a run of this recipe, never a new plan.

## contents

- the want
- the run
- vectors
- artifacts
- findings

## the want

dima, 2026-08-27, the purpose:

> «i want the fleet memory system to be pristine. every bit of memory should live in its place vertically. the memory must not be a poem, nor bytecode. as slim as possible to do its job, natural for me to sometimes peek, trim, tweak. primarily maintained by the fleet. no useless, stale memories. i am the owner overall, the carrier of the ideas. skill-wise: same.»

**why the sweep is worth its cost** (2026-10-16):

> «memory sweep by itself is a very important operation because it is about creating a high-quality driver for you, which is your memory and skills, but it's also expensive to run. that's why it has to be in pristine shape.»

- it wants a lot of his attention, so it runs as efficiently as it can: the trace and the retro exist to catch its mistakes and sharpen this recipe
- memory may grow, but only with useful lines; a guard that stops growth asks for a regroom first, never forbids the add (10-16)

**this recipe is the sweep's script** (2026-10-11, after he printed the whole sweep plan a second time):

> «i printed the whole script again, which i shouldn't — we already did such a big sweep once. make sure the memory sweep script is clearly defined in a recipe so it is not buried. it serves as the global plan outline for each memory sweep and evolves with the live sweep: we refresh this recipe live as we gain new findings. that's why i asked you to log our memory sweep process as we go and trace it. after the sweep we do a retro on the actions we performed, refresh the script one more time at the very end, and seal it until the next memory sweep.»

- his outline (10-12): trace the sweep → the full sweep → review, hunt drifts, fix → a retro on the trace: findings, mistakes, how this recipe improves → done; the trace-and-evergreen idea is his from run #1 (2026-08)
- step 10 regrooms everything: a sweep moves a lot, so skipped files and the vertical rebalance are hunted at the end (10-16)

> «a final retro step of a memory sweep is not less important than the memory sweep itself because it settles the next memory sweep.» (10-16)


**delete-first** (his brief for run #2, 2026-10-07 in `_hq/memory-sweep.md`; what it means, 2026-10-12):

> «i don't ask you to delete everything. the system should work, and our habits should stay. what i don't want in a memory is fluff or unnecessary info: it holds only the instructions i asked for, or instructions that help the fleet operate. nothing else — no duplicates, no unnecessary explanations. delete first is only about this.»

- the tactic: delete first, see how it affects you, add back gradually, never aggressively; it covers memories, skills and recipes alike (10-07)
- why memory bloats: the fleet mostly adds (retro and flawlog folds) and nothing reduces it, so the halt trims what it folds into (10-12)
- a memory file is written for the agent, in the agent's format; dima operates the agent, so he is responsible for its memory — he peeks into it and edits it, and it stays readable to him (run #1, 10-16)

**the weight**, re-asked every run (answered in `author-memory/references/memory.md`):

> «what's the current best-practice target for the ctx size an llm needs to perform well? previously it was ~120k tok — the number after which performance starts to drop. what's the number now? which number to hunt? your current boot ctx is 115k, and after the first boot it becomes ~200k. a 120k target is not realistic. **what do we do wrong?**» (run #1)

- is everything preloaded truly useful? (10-07: boot 117k, memory files 81.2k; run #2 ended near 60k)
- how to teach agents to write and keep skills and memory, and who writes them better; `writing-for-agents` covers both

**his standing calls**
- between sweeps: the halt's redundancy hunt (`clio:halt` 3a, 10-07), the size budget and `memory-lint` at commit, and a weekly memory pass on Wednesdays after evergreen (10-16) — so the sweep stays an audit, never a rescue
- what the cuts never touch (10-11): output format, emoji, the main flow frameworks
- `writing-for-agents` fires first rather than proxying the research; no skillsmith ([DOT-132](https://linear.app/x-com/issue/DOT-132)); the enforceable ruleset is [DOT-127](https://linear.app/x-com/issue/DOT-127)
- no hook forces skill loads (08-25)
- cloud chat: cc is the source of truth, cloud chat a derived view, kept by hand, short and pretty (10-02)
- a check that fires often is a root to fix, never a turn to repeat (10-02)

**skills** (2026-10-11, the old `nurture-skills`, merged here 10-13): every skill reviewed, groomed, trimmed, its load rebalanced, shaped by our skills knowledge:

> «i want all skills to be lean and clear, while not conflicting with resident memory.»

- the groom opens with the prune: stray test-drive leftovers, dated ones, ones he doesn't like, ones never proven; the marketplace and project-scoped skills too — only what proved useful stays (10-14)
- a skill nobody fires that costs context is a prune candidate before any hillclimb (10-06)
- `x:author-memory` stays one skill with references `memory.md`, `memory-project.md`, `skill.md` (10-13)

## the run

- **research first, every run** (dima, 2026-10-16: runs are months apart and the docs move daily, so a run opens on fresh research and never skips it): step 2 lands before any write
- **scope**: the groom list holds every memory file; a file unchanged since the last seal (`git tag memory-sweep-<n>`, set at step 10's end) gets the lenses the research changed, a file churned since then gets all of them — churn is where the rot is
- **trace as you go**, the same turn: every action is one line in the run file (`docs/test-drive/memory-sweep.md`) through `scripts/memory-trace-append.sh "<what>"`, which stamps the clock and refuses a typed stamp or a repeat; a step with no line did not run, and run state never lives in chat. a flaw class, a mistake or a tip adds one line to that file's `## findings`, which step 10's retro reads first. `last/groom-list.md` (born at step 4) holds one line per file, flipped the turn its step lands
<!-- run #2: 4 composed clocks and a doubled line before the script -->
- **re-entry, at every start and resume** (a boot, a checkpoint, a compaction), before any groom:
  1. the standard boot: `clio:boot`, every member woken, «checkpointed» said
  2. read WHOLE, never skimmed: this recipe · `mattpocock-skills:writing-for-agents` · `x:author-memory` and its three references — they are the lens every file is groomed through, and skipping them is the reflex to beat: without them a groom checks pointers and cuts nothing
  3. the state: `last/groom-list.md` and the last lines of the run file
<!-- 10-11: 27 files passed «read whole, unchanged» with the guides out of context and 50 had to be reopened; ~16k tokens of reading is cheap next to that — dima's verdict: «it very precisely describes the reason to read these guides before a memory sweep» -->
- **the goal is the smallest form that does its job**, by § the want's delete-first: a groom that checks staleness and pointers but cuts nothing has not run; size is measured on every file; boot memory in `/context` (he types it) is read at the start and the end as a direction, never a target
- **the cadence**:
  - steps 5–8 batch by size: ≥5 KB alone · 2–5 KB in pairs · <2 KB about six to a round; one proposal per round, each file with bytes before → after and its lens verdicts; he ticks the round once in orbit, a note on one file holds back only that file
  - step 9 batches the same way; step 10 is a scope pass, one draft wave, then the review chunk by chunk
  - **🌤️ siesta with `wishkeeper` 🐬** after 2 big rounds or 5 smaller ones; it reads what was applied
  - a fix is never its own report turn (`habit-dima-comms`)
  - **a checkpoint comes on context** (`clio:checkpoint`'s 600–700k trigger) or his word, at a clean seam, never mid-round: after step 4 · after `rules/` · after the clio leaves · before step 9; each CST's META first-act 1 is this recipe's re-entry
<!-- run #2: «pretty chaotic and destructive» (dima), useful detours; ~45 rounds over ~10 days; 84 files in steps 5–8 took ~30 rounds; step 10's four waves took 126 min, ~46 of them waiting -->
- **the order is his**: an agent improves it, never replaces it; a wrong step is fixed here the same session
- **the coordinator executes**, booted in `~/frame/_clio`, every leaf resident; it spawns only for bulk reads, research and drafts: a helper drafts strict rows (file · a find that matches once · its replace), clio reads the file whole and says yes or no per row, a script applies each row by exact match or refuses it. a sweep spans as many sessions as it needs; the trace carries it
<!-- run #2: a drafter's own Edit merged 12 bullets (dima's yes on strict rows, 2026-10-16) -->
- **his working rules**: a «chunk» is one groomed file, an `oN` is an orbit ask (his tick is his answer); no auto-commit; his per-item ticks plus the removed-lines list count as his read, an untouched item waits for his read of its diff (o95) · objections welcome · a per-item report, expanded on his ask: `file: what it is · issue · fix`. what clio edits alone and what goes to him per line is `habit-memory-edits` § the line
- **in every step**: conflicts and duplicates hunted first, then fluff and over-explanation · deletion candidates go to him with evidence, never an essential fact or a live habit · reword shorter and natural · each file reads top to bottom · a rethought file gets two drafts, he picks
- **each round's gates, no commit**, on the working tree of every repo the round touched: frame `pnpm typecheck && pnpm test`, bytes `pnpm apps:essentials` + `pnpm typecheck`; `groom-list-check.sh`; `quote-diff.py <the sweep's start commit>` over every groomed file. a red means the round is not applied, and the reply names each gate with its exit code. «applied» is said only after `scripts/applied-check.sh <round>.tsv` exits 0 (one row per ticked line: the text that must be gone, the text that must be present)
<!-- crow 2026-10-12: five over-wide claims in a day, each caught hours later; lefthook and index-run.sh read the index, so unstaged groom edits pass unseen; run #2: a HEAD-only quote diff let 12 of his quotes go across rounds; rounds A and B reported a line that never landed -->
- **the quote gate before every commit of a groomed file**: `python3 _clio/script/quote-diff.py HEAD <files>`; each «…» quote of his that left is restored or shown to him beside its new form, never judged away in silence
- **his `<!-- clio: … -->` notes**: each step greps for them first, resolves each in place or answers it in the thread, then removes the note
- **a fold keeps what was said**: a future-dated block is written in full and marked deferred, never summarised away
- 🚫 **no llm-judge audit**: what code can verify is code (step 4), pruning is human (step 10); the numbers are in `author-memory/references/memory.md` § upkeep

1. **groom this recipe** — `clio:shape-recipe` step 0: every want line true, every vector serving one, skills included. done: dima's word, `groomed:` stamped. (open)
2. **research** — no write before it lands. first the snapshot diff, the cheapest: re-download anthropic's two pages as `.md`, `diff` against `docs/research/skill-authoring-best-practices/`, read only the delta, replace the snapshots. then the vectors, all lanes at once (`clio:shape-recipe`) + a `neuroarxiv` lane every run (dima, 2026-10-21), its paper reads one `helper-lite` per paper. done: every lane landed or failed out loud. (template)
3. **the knowledge distill** — into `x:author-memory` and every knowledge doc that steers memory and skill edits (`author-memory/references/skill.md` takes the skill mechanics and the evals prior art), concise without dropping a useful line. one layer per file: craft is `writing-for-agents`, these hold cc mechanics and our rules. every claim tagged [measured] / [read] / [inferred] with a version; one behind the running cc is re-probed or cut. stories go to a research doc with `dies-when`. a size budget in each file's frontmatter. done: every doc touched or «unchanged», bytes before and after logged. (open)
4. **the vertical audit — which memories bleed the most**: the rank is `resident × never-used`, tokens at 2.89 chars/token, measured on disk (`/context` shows the boot snapshot). (template)
   - **the mechanical pass**, code only: a closed `FRM-N` / `BYT-N` within 2 lines of open-state words (`tracks it`, `trial`, `awaiting`, `pending`; run #1: 12 flagged, 11 real) · a dead `@import` · barrel omissions both ways · a named rule, skill or doc that is gone · a named flag missing from `--help` · research past `dies-when`. today `memory-lint` runs at commit (budgets, merged bullets); the rest of this pass runs here, by script, until each check joins it (PK-169). a naive path regex flagged 94 with ~2 real, so it stays out
   - **inventory and map** (his order, run #1): every memory file across repos → cc's default «go upd memory» asked twice, diff-based (right places? poems?) → the connection graph drawn from one script's numbers (sizes, pointers, inbound links, dead `rules/` pointers, the voice and format wiring) → the groom list, no edit before it. the connector pass (pointers, precedence, placement) stays apart from content pruning; an isolated leaf is where dima looks first
   - **the cruft pass**: a prompt audit (`/doctor prompt-audit`, terminal, dima types it; or the `claude-api` skill's per file), reused when it predates no big memory change, rerun at step 10 for the before/after. each prescriptive line (CAPS, «ALWAYS», a case list) gets the delete-test: the real ask in a fresh session with and without it, kept only if without is worse; the lines that failed print to dima as «where you restrict me too much», each beside what it blocked
   - **the trigger tag**: each section tagged `file-touch` (matters only when a kind of file is touched), `intention`, or `always`; a `file-touch` one is step 7's deferral candidate (a `paths:` rule loads on a read, `cat` or edit of a matching file, measured cc 2.1.296)
   - **the groom list** (dima, 2026-10-11: «create it before the sweep starts, after the research preps, and follow it as the progress tracker»): `recipes/nurture-memory/scripts/groom-list.sh` writes `last/groom-list.md`, every memory file by layer with its bytes; steps 5–10 flip its lines, and no file groom starts before it exists (steps 1 and 3 groom the recipes and the knowledge docs before it, by design). a new sweep regenerates it here; re-entry reads it only to resume. coverage is proven by diffing its paths against `find ~/.claude ~/frame ~/projects` for `AGENTS.md`, `CLAUDE.md`, `memory/*.md`, `rules/*.md` (worktrees and node_modules out): any extra path joins the list. it is born with its skills section, and a rename or move flips its line the same turn (run #2: 147 skill rows escaped because the skills section came on day 10)
   - done: the ranking in the run file and the groom list born
5. **root `CLAUDE.md` first** (`home/.claude/CLAUDE.md`), through step 7's lenses. done: dima read the diff. (open)
6. **then every layer in step 8's order; inside a layer, the worst bleeder first** (step 4's ranking). done: step 8's done. (open)
7. **then every leaf**, one per round through `x:step-by-step`, placement before prose; every file gets EVERY lens below, a verdict for each, its bytes before → after measured on disk. (open)
   - **the redundant kinds** — a line goes, moves or shrinks when it is:
     - **a dupe** — the same claim in another file or layer, the verdict naming the grep that found the other home (10-15: three «dupe» cuts were the only copy): one home keeps it, the copies go, a pointer only where a reader would not find it. duplication multiplies decay: one board change once falsified twelve files
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
   - **placement** — the bucket test in `author-memory/references/memory.md`: «who pays for this, and do they need it». a line that asks for an action names the exact call, or moves to `settings.json`, a hook, `permissions.deny`. a memory that is really a skill is named. clio is the pm lead, everyone else a senior contributor: lean slightly global
   - **deferral** — `paths:` is the only lever that keeps a file out of context: frontmatter alone excludes nothing, Bash `cat`, `Read` and `Edit` fire it, a `Write` of a new matching file does not (measured, cc 2.1.296)
   - **a rename is a graph operation**: grep the whole repo before and after (barrel, wikilinks, docs, code, symlinks), re-probe the barrel; done is the root naming rule's `grep -rn '<old name>'` printing nothing outside dated history
   - open, his call (10-06): the `guide-*` split — most code is typescript or react, yet skills cost nothing at rest, so observe and move as we go; and a generated barrel vs a hand-written one
   - done: every file's groom-list line reads `- ✅ <path> — <before> → <after> B · lenses: dupe · superseded · enforced · unused · no-op · altitude · trim · merge · placement · deferral · protected — <what moved>`, each lens with its verdict; «unchanged» is a verdict only with the evidence for every lens; `recipes/nurture-memory/scripts/groom-list-check.sh` exits 0
8. **the order across layers**: root `CLAUDE.md` → `rules/` → all resident memory (clio leaves; the pm surfaces are reviewed here, `.scratch/memory-sweep/issues/085-pm-review.md`) → project leaves (frame, `bytes`, `dvakatsiienko`, `inner-marker`, `reinforcement-learning`; clio leaves read all first, keep / trim / move, judge filenames, then a filename sweep). a project leaf: `find ~/projects -name AGENTS.md -o -name CLAUDE.md`, the project examined before the file, a restated environment becomes a pointer, a tutorial goes; what a leaf owes is `author-memory/references/memory-project.md`. `~/projects/AGENTS.md` is a deliberate stub ([DOT-195](https://linear.app/x-com/issue/DOT-195)). done: every layer through step 7. (template)
   - **the structure rethink** (dima, 2026-10-21, PK-175): after the fleet layer and before step 9's skills, the clio leaves are judged whole from another angle — balanced by moment (every turn or on a trigger), modularized (one decision per leaf, a split or merge where off), mapped twice (a dataviz page shows the weight, a FigJam board the overall picture). the lens (inference: unmeasured, from skills missing on intention triggers): a line leaves resident memory only when a hook can see its trigger; an intention (choosing a tool, naming a thing, writing a report) stays resident, an event (a url, a command, a file read) moves behind its hook. done: every leaf judged, each move on dima's word. (open)
9. **skills** (effort ≈ 60 % mems / 40 % skills: mems are the mess, skills «+- ok»): each skill reviewed, groomed, trimmed and its load rebalanced, against resident memory. the rulebook is `author-memory/references/skill.md` and `writing-for-agents` (its `SKILL-MECHANICS.md` for frontmatter and invocation); a skill line that restates or contradicts resident memory or a sibling keeps one home. (open)
   1. **the skills research** — a small run of its own, before the groom: the `skills:` vectors, all lanes at once (`clio:shape-recipe`), distilled into `author-memory/references/skill.md`, bytes before and after. done: every lane landed or failed out loud, the doc touched or «unchanged»
   2. **the census and the install hunt** — `clio:system-checkup` runs both as its `install-census` check, more often than this recipe runs (dima, 2026-10-19); here, read its ranked list, `_clio/checkup/install-census.md`, or run `checkup install-census` when that file is older than 14 days. done: the ranked list in the run file
   3. **the prune**: every skill, plugin and mod the census shows unproven goes before any other work on it — a stray test-drive leftover, a dated one, one dima never liked, one that never earned its place; each a keep or drop pick for dima. done: every unproven entry verdicted
   4. **the conflict hunt** — every surviving skill against resident memory (root `CLAUDE.md`, `rules/`, clio leaves) and its siblings: a duplicated or contradicting line gets one home. done: every hit verdicted
   5. **the groom**, the order in the pocket's skills-groom item (crew-codie and crew-sixth-sense first, then the most used and the most bleeding), step 7's size batching:
      - a completion criterion that can be checked, or why none
      - keep, trim, merge or drop
      - the description leads with WHEN; a pair gets symmetric descriptions
      - steps tagged by freedom, a fragile one becomes a script
      - contents past 100 lines; tables become bullets
      - a heavy human-only skill gets `disable-model-invocation: true`
      - entity-first names carry a scope (`x:*`, `clio:*`)
      - the info load rebalanced: what every branch needs stays inline, the rest behind a pointer
      - **the cold test**: a fresh session runs one real ask per changed skill; an unopened file or a skipped step sends it back
      - done: every skill verdicted, each changed one past the cold test
   5. **the fire loop** — only for a skill with a miss (a flawlog «skill not loaded» line, a router near-miss 0.30–0.70), and only on dima's word (`rules/fleet-tooling.md`: evals spend the weekly usage): his real prompts as `plugin-x/evals/<skill>-*` cases, train and held-out test; a baseline `claude plugin eval`; change one thing, keep it only if train rises and test holds; a round cap first; each round logged in `docs/test-drive/`. done: every missed skill looped, capped or parked
   - done: steps 1–5 done, each traced in the run file
10. **the review, the gates, the retro** — after the full sweep, one pass (dima, 2026-10-12; reshaped 2026-10-16). (open)
    - **it regrooms everything**: regrowth after a groom is expected, never a failure (§ the want); step 10 finds it and grooms it
    - **every finding is also a retro row**: it is fixed, and tagged `escaped from <step>` — the step that should have caught it (re-entry, 3, 4, 5–8, 9.x, a siesta, «none could»). rows land in `last/step10-findings.tsv`: `lens · file · what · fix · escaped-from · cost (dima turns)`; the retro reads escapes per step, never impressions
    - **10.0 scope**, before any card (run #2: the scope for waves 2–4 surfaced only mid-step): `groom-list-check.sh --final`, the size drift and `quote-diff.py <the start commit>` print the whole scope; then one draft wave covers it — a `Workflow` on dima's word, one `agent()` per ~10k of real work with `agentType: 'helper'` so the prefix cache is shared (run #2's ~12 cards fit one wave) — and the review runs chunk by chunk as drafts land; one fix wave only for what the review or wishkeeper finds
    - **10.1–10.3 run at once**, three `helper` cards writing rows, clio judging; wishkeeper reads the folded batch as the step's siesta:
      - **10.1 drift**: every backticked path and `x:`/`clio:` name in memory, rules and skills resolves (`test -e`); names of cut, moved or renamed things still pointed at; closed tickets in open-state words; dima's quotes lost across the whole sweep (`quote-diff.py <the sweep's start commit>` over every groomed file — run #2: `40a58e9c`, 2026-10-07); trial dates copied outside their test-drive file
      - **10.2 coverage — depth, never presence** (dima, 2026-10-16: «sharpen step 10 to hunt misses like this, so none of the memory sweep recipe runs will miss anything»): `groom-list-check.sh --final` exits 0, which proves three misses gone:
        - **a partial pass read as a groom** — a skill whose only verdict is a dupes pass, a prune keep or side work; a skill line needs a whole-groom round
        - **a file changed after its groom** — its size on disk off its recorded after by more than 2 %: the lines added since the groom (`git log --since=<groom date> -p -- <file>`) get the lenses, the line its new bytes
        - **a file no line names** — born, moved or renamed during the sweep; each groomed or verdicted
        - the skills' verdicts live in the groom list's skills section, so one file holds every verdict
      - **10.3 vertical rebucket**: a cross-file duplicate scan (a sentence of ≥12 words in 2+ resident or skill files); resident lines only one surface needs (clio-only in `rules/`, coder-only in root); skill lines restating resident memory — keep, move down, or cut
    - **the human gate**: pruning is never delegated; candidates go out as a digest:
      - ≤5 clusters per halt, related lines together; each line: the text quoted, why it goes (the kind above), the evidence (a grep, a ticket state, the guard's name, a load count), where the reason survives
      - dima answers per line: **yes** / **keep** / **later** — no «approve all», silence changes nothing
      - what goes to him and what clio does alone is `habit-memory-edits` § the line; the step-10 regroom rounds' cuts pass this gate too (run #2 cut 65 lines, 26 of his, unanswered)
      - the items print in the thread, readable alone; the rest stays in the round's file, linked
      - yes → deleted in one batch; the old text stays recoverable in git
      - keep → the proposal goes to `retire-log.md` in this folder (created by the first keep) with his reason, and never resurfaces unchanged; only new evidence re-proposes it, showing what changed
      - later → it rides the next digest
      - the agent drafts; existence and deletion are his (an llm grading its own memory cannot tell good from bad)
    - **self-correction**: a flaw seen twice becomes a check, a script or a hook; a check that fires often is a root to fix (`pnpm reply-check:report`)
    - **the cloud chat field**, only when a `<!-- sync: cloud-chat -->` section changed: `pnpm memory-sync:map` → `pnpm memory-sync:copy` → dima pastes it into cloud chat → a cloud chat thread runs `/x-cloud-chat:memory-update check`
    - **the numbers, after every edit of step 10** (dima, 2026-10-16: step 10 still edits, grooms and deletes, so the count waits for it): resident bytes per layer now vs the sweep start, from the groom list's before → after plus a fresh `wc -c` over every resident file; the skills listing bytes; dima types `/context` once (run #1's 10-07 reading: memory 81.2k, boot 117k); per-session token use over the sweep's days (`x fleet ops --days <n>`)
    - **the retro on the trace**: inputs in order — `last/step10-findings.tsv` (escapes per step), the trace's `## findings`, the trace itself (rounds, siestas, wishkeeper findings per siesta and how many were high, unchecked folds, pauses), the flawlog's `#dima-caught` lines over the sweep's days, the numbers. one `retro` card reads trace + flawlog + tsv (the trace is the record, never the transcripts); clio adds the numbers. it answers four questions, printed as a research read:
      - what were the interesting findings
      - what were the mistakes
      - **how well was the run locked** — did the trace, the groom list and each CST carry the state through every pause, side lane and compaction, and if anything slipped, the mechanism (a check, a gate, a recipe line) that locks it next time
      - how does this recipe change so the next run goes better
      - **how does the fan-out get cheaper** — measure the waits (wave starts and ends from the transcript) and the slips against run #2's shape (10.0 scope, one draft wave, strict rows a script applies); a fix wave stays where it caught what one wave missed, and speed never buys quality
      - **how did we talk during the run** (dima, 2026-10-16): his prompts and clio's replies over the run — re-asks, text that never reached him, unglossed ids, asks answered twice, replies skimmed past — each pattern with its count and the fix that removes it (`recipes/refresh-fleet-operator-comms/scripts/` extracts both)
        - **the approval balance**: his approvals passed bare vs steered or caught, by edit kind; the line between alone and asked moves in `habit-memory-edits` § the line, never trading quality for speed
      - **how does upkeep between sweeps get smoother** (dima, 2026-10-16: «there are a lot of stray stuff everywhere»): each stray class in the trace's `## findings` gets a home — `memory-lint`, the Wednesday pass, a guard — so the next sweep finds less sediment
    - then a grill round with dima on the recipe changes (the whole frontier at once), the recipe refreshed, sealed until the next sweep
    - done: the gates passed (typecheck, test, `groom-list-check.sh --final` 0, `quote-diff` vs the start commit, `pnpm test-drive:check`), today's line in `log.md`, the refresh committed, the seal tagged `git tag memory-sweep-<n>` on that commit

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
- `author-memory/references/skill.md`'s best practices against our files: a practice we miss is a finding
- which memories misfired or sat unused: `refresh-fleet-ops`' skill-load measure; a leaf never load-bearing since the last sweep is a retirement candidate
- did a silent-failure class fire, and does `method-silent-failures` name its shape?
- placement drift: a leaf past one decision, a fact at the wrong altitude
- the failure-mode scrape, theo's method: `~/.claude/projects/`, `~/.claude/history.jsonl`, `~/.claude/shelf/flawlog/`; events not opinions, bucket then count, scripted with duckdb — never an agent sampling transcripts
- skills: which fire, and the flawlog's skill misses since the last run, `#dima-caught` first
- skills: resident cost and size per skill; the ones that cost context and never fire
- skills: conflicts with resident memory, where a skill restates or contradicts it
- skills: `x:crew-codie` and the other crew skills against the 5k-token re-inject cap

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
