# test drive — the spec pipeline: to-spec → to-tickets → implement-spec

window: from 2026-10-06, verdict after three runs. the skills: `mattpocock-skills:to-spec`, `to-tickets`, `implement-spec` (v1.3.1), all user-only.
the want (dima, 2026-10-06): linear is heavy and global; a lane or a shift wants a local, granular plan made right before execution — «have Linear tickets as global, unstructured tickets, but have them structured via to spec right before execution». implement-spec: «worth a test drive for one-off tickets that are bigger than freebie but not a full scale ticket that wants decisions».

## the shape on trial

- linear keeps the ticket (the global shelf); `to-spec` writes the spec and `to-tickets` the task graph into a **local-markdown tracker** (`.scratch/<feature>/`, matt's built-in option), not into linear
- `implement-spec` runs the graph: implementer subagents in worktrees (each loads `tdd`), a merger subagent onto one integration branch, `code-review` at the end
- it runs inside one `--bg` session (watchable) whose prompt starts with the skill — subagents die with that session, so it is the watch surface
- the linear ticket closes with the integration branch as its record

## open before run 1

- `setup-matt-pocock-skills` once per repo: tracker = local markdown, domain docs = GLOSSARY.md / GLOSSARY-MAP.md, docs/adr
- `.scratch/` gitignored or kept? (a spec is the lane's plan, dies with the lane)

## run 2 — the shape on trial (dima, 2026-10-07)

plan wide → pre-grill (`grill-with-docs`) into the linear body → shape lanes → `to-spec` (cclio, a snapshot of the body plus code seams) → `to-tickets` (the coder, right after spawn) → dispatch in batches; `implement` for granular work dima watches, `implement-spec` for bulk. pre-grill only the next milestone's lanes. first case: the cli plan ([FRM-284](https://linear.app/x-com/issue/FRM-284)), to-spec'd live with dima. open question it answers: can the linear body hold the spec itself, killing `.scratch/spec`?
numbers: dima's minutes per batch at dispatch · coder rounds · `#dima-caught` after dispatch · stale decisions caught at `to-spec` · «did to-spec need anything outside the body?»

## log

one line per run: date · ticket · tickets in the graph · subagents · minutes · tokens · code-review findings · dima's verdict
- 2026-10-06 · run 1 · FRM-324 + FRM-325 + FRM-329 (the mods round) · 8 tickets cut + 2 added mid-run (09 the guard half of FRM-311, 10 the 🔥 re-read for FRM-335) · 12 subagents (10 implementers, opus; 2 reviewers; 1 review-fix implementer) run from cclio's session, not a `--bg` runner · ~3 h wall (01 at 15:07, review fixes in at 19:54), two chains in parallel (guard 02→03→09, stash 04→…→08→10) · per ticket 4–22 min, 36–186 tool calls, 196–337k tokens, of which ~137k is the fresh agent's base (35k read warm, ~102k written cold) · every merge a fast-forward done by cclio, no merger subagent · code-review: standards 3 hard + smells, spec 3 partial / 3 scope / 4 possibly wrong → all fixed in one implementer, 334 mods tests + 398 frame tests green · dima's verdict: pending his look at the live board after the merge
  - broke: every Agent `isolation: "worktree"` tree started at an old commit (a3a6862b), never `mods-round` — the brief's «check the base» line caught it each time; worktree isolation refused ~8–12 git-shaped calls per implementer; reports landed in cclio's thread (~3k each)
  - dima's take (2026-10-06): «implement-spec looks very good of under the hood work, some bulk work, especially if can be made via sonnet 5.5»; a plain `--bg` coder for granular UI he watches. promoted after his 5 tries: cclio runs it without him typing it first
- 2026-10-07 · run 2 · the next cli lane under FRM-14 · grill-with-docs over 5 rounds (overview, then telemetry, handoff, linear in depth), then to-spec read by hand · 4 specs in `.scratch/` (x-telemetry 19 stories, x-handoff 18, x-linear 26, x-stats-board 14); ccrow split telemetry from the board before dima read them, so the foundation ships alone · to-tickets not run yet (the coder runs it) · dima's verdict on where a spec lives: «too early to decide. i'd continue test driving in this mode» — specs stay in `.scratch`, linear keeps the ticket
- 2026-10-10 · PK-11, the archive read · 2 real specs (mods-round → FRM-324/325/329, x-telemetry → FRM-340); x-handoff and x-linear hold issues and retros only; x-stats-board was never built and went back to `.scratch` · the `x:pm` relation held: the body keeps the want, dima's mid-run «also:» asks landed in the bodies (his words, the right home), the spec kept the how, and 3 of 4 closing words carry the outcome · one miss: FRM-329 closed bare, no closing word · verdict: keep — specs stay local in `.scratch`, archived at land; linear keeps want + closing word; beads revisits the «one home for every spec» idea at the pocket verdict
