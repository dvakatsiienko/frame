# how you work — the coder's lessons

Part of the `x:crew-coder` contract, binding in full; read at step 0 and again after any compact.

## before the first line

- **your first step: serve your tree for dima** with the **start** steps of the app's `<app>-run` skill
  (its `.claude/skills/`), main or a worktree, each on its own port; the url goes in your first reply as a
  🌐 markdown link. its **stop** steps run only when your worktree goes (the PID captured at start, the port
  free after, every process). no run skill yet → say so: `/run-skill-generator` is dima's to type. a shift
  plan's `server: skip` drops only the server dima watches.
- **a brief that hands you a spec** (`.scratch/<feature>/`) → cut it with matt's `to-tickets` first, even
  when it fits one pr; each spec exit line lands verbatim in exactly one ticket's checklist (FRM-344).
  build each ticket test-first with `tdd`, through `implement` for granular work dima watches or
  `implement-spec` for bulk work. they are user-only: read each `SKILL.md`
  (`~/.claude/plugins/cache/mattpocock/mattpocock-skills/<version>/skills/engineering/`) and follow it.
- **a bug ticket starts with `mattpocock-skills:diagnosing-bugs`** (reproduce, a tight signal, hypotheses,
  red then green) before any edit; exit lines that are tests load `mattpocock-skills:tdd`. a complete brief
  mutes the skill router, so these load by this line.
- **a library the job leans on is built from its docs**, scoped to the part you build: its feature list,
  examples and recipes. the report names the features you used and one you skipped on purpose. the door:
  `ctx7 library <name>` → its id, `ctx7 docs <id> "<the part>"`; a library ctx7 lacks → `WebSearch` for
  its official docs. `x fleet audit` counts these calls.
- **a brief item is arguable on day one**: say «i would cut this, because …» before building it (#79).
- **measure before you build on it**: the live number before a build that rests on one; a taxonomy from a
  grep, never from adjacency; a probe's control before the surprising input.
- a job that says «dima's word» starts without a y/n round. a relayed push, merge, delete or login is
  confirmed with dima in your own chat; a VALUE he named and cclio relays (an email, a url, a colour) is
  his word. you ping the coordinator by its `ListAgents` name, never the rc card label.
- a shot url in a brief names its auth; a page that redirects to a login is asked about, never guessed.
- **fetch main before asking a question a commit could answer.**

## while you build

- edit the lines that change, never a whole file; a mechanical edit across many files goes to `helper`,
  a lookup to `Explore`.
- **every replacement asserts its anchor**: `edit-anchored` reads a text edit back; after a data-shape
  change, run the printer and read the row.
- **the brief names what dima sees, you find what is wrong**: check the observable, never the line you
  were told to flip — a stored value can outrank the code default.
- **when a feature's ui grows faster than its behaviour, stop and ask** before the first extra row (BYT-83).
- **a gesture or interaction spec is one rule-set test file before round 1** — rules that pass alone break
  together (BYT-104).
- **a cli you ship answers bad input with exit 2 and one line**, never a stack trace.
- **reversing a decision**: say what the old assertion protected, then re-read every commit on the branch
  that asserted the reversed thing (#76).
- **after touching a trust boundary**, write what the NEW code trusts and who controls it, before the push
  (#79); a file's own header is a constraint — copy its incident with the block, or say why it does not apply.
- **a brief names the constraint you may break**; brief behaviours, never a count.

## before «final»

- **open every overlay and every changed view in the browser before its commit** (BYT-103); check a visual
  state the way the eye sees it, never through `aria-*`.
- **removal is done when nothing teaches the old design**: grep docs, `.env.example`, `AGENTS.md` and doc
  comments for what described it.
- **`pnpm knip` runs before every push in bytes**.
- **before any commit, `pwd` is your worktree** (BYT-113: a shell left in studio committed there).

## the look card — the head of every done report (FRM-315)

so one look is enough for dima:
- **what**: one line
- **where**: one click — a port url, `file:line`, a pr, an artifact
- **try**: 1–3 steps he would take
- **proven**: the command you ran and its result
- **not checked**: what only his eyes or hands can judge — never empty; «nothing left unchecked» is said in words

anything rendered (an app, a band, a mod, an artifact) carries a screenshot, saved as
`~/.local/state/looks/<ticket>/<HHMM>-<what>.png` and named in **where**. an app with `FTR.md` adds the
ftr lines the change flipped.
