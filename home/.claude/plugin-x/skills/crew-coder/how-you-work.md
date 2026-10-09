# how you work — the coder's lessons

Part of the `x:crew-coder` contract, binding in full; read at step 0 and again after any compact.

- **a brief that hands you a spec** (`.scratch/<feature>/`) → always cut it with matt's `to-tickets`
  first, even when it fits one pr: the tickets are the plan everyone can read and the part that
  survives a compaction. the cut copies each spec exit line, verbatim, into exactly one ticket's
  checklist — a line no ticket owns is ambiguous until a verifier finds it (FRM-344, round 7). build each ticket test-first with `tdd`, through `implement` when dima
  watches granular work or `implement-spec` for bulk work under the hood; one pr unless the tickets
  say otherwise (dima, 2026-10-07: «let's try always to-tickets»). they are user-only: read each `SKILL.md`
  (`~/.claude/plugins/cache/mattpocock/mattpocock-skills/<version>/skills/engineering/`) and follow it;
  a prompt runs one slash command, everything after it is that command's args.

- **a library the job leans on is built from its docs, not from memory.** before the feature's
  first line, open the docs for the part you are building — its feature list, examples and
  recipes — and use what they offer; after, name in the report the features you used and one you
  skipped on purpose. scope to the part in hand: a zoom feature reads the zoom lib's examples (the
  `react-zoom-pan-pinch` centering and padding demos were what dima had to point out on atelier),
  never the whole of next.js. the docs hold the ux a bare call cannot guess.
  the door: `ctx7 library <name>` → its id, then `ctx7 docs <id> "<the part you build>"` (~3 s, ~3k chars;
  brew, on a test drive to 10-07). a library ctx7 does not carry → the `WebSearch` tool for its official
  docs. `x fleet audit` counts these calls per session — a feature built with none is visible.
- **the brief names the constraint you may break** («ship only what a test exercises today»,
  «touch the shared biome config if lint needs it»); brief behaviours, never a count — «one
  test: renders, a variant, a click» produced a conjunctive test where five were right.
- **measure before you build on it**:
  - measure the live number before a build that rests on one (the 10-day grant reframed a
    whole step, 2026-09-11).
  - a manifest survey unions `dependencies` + `devDependencies` before counting (a one-field
    read hid three tools twice).
  - a taxonomy comes from a grep, never from adjacency.
  - a probe runs its control first, then the surprising input.
  - **a cli you ship answers bad input with exit 2 and one line** — a missing arg, an unreadable file, a wrong shape;
    never a stack trace (six such defects reached review on the `design:*` scripts, 2026-09-29).
- **a rule you write is read from the docs, never from the lockfile** (a react-compiler line
  was wrong from it).
- **reversing a decision**:
  - after reversing one mid-pr, re-read every commit on the branch that asserted something
    about the reversed thing — two review findings on #76 were docs from the old thesis.
  - before replacing an assertion, say what the old one protected.
- **fetch main before asking a question a commit could answer.**
- **language rules live in the `guide-*` skills, never in this contract** — until `x:guide-go`
  exists, a go change runs `gofmt`, `go vet` and `staticcheck` on its paths.
- **a bug ticket starts with `mattpocock-skills:diagnosing-bugs`** — its loop (reproduce, a tight
  signal, hypotheses, the fix proven red then green) before any edit; a ticket whose exit lines are
  tests loads `mattpocock-skills:tdd` (red → green → refactor, one behaviour per test). a complete
  brief mutes the skill router, so these load by this line, never by trigger words.
- **`pnpm knip` runs before every push in bytes** — an unused export turned ci red once (2026-09-28).
- **when a figure changes, grep the formula (`* 100`), not the field** — the journal rounded while the library floored the same percent (#114).
- **trust and constraints**:
  - after touching a trust boundary, write what the NEW code trusts and who controls it,
    before the push — three of twelve defects on #79 were holes opened while closing another
    (a pr can move its own `base.sha`; an empty `$app` matched everything).
  - a file's own header is a constraint: copy the incident with the block, or say why it does
    not apply — a `needs:` edge made the required gate skippable in a repo whose sibling
    workflow opens with that exact trap.
- **a type fix names the new type, not the symptom** («annotate as X» was wrong when the field
  became `unknown` and needed a narrow).
- **a brief item is arguable on day one.** Say «i would cut this, because …» before building it —
  the answer lane on #79 produced 5 of 12 defects and the coder had the argument at the start.
- a job that says «dima's word» starts without a y/n round — his approval is in the brief; ask only when the brief is unclear.
- a relayed push, merge, delete or login is confirmed with dima in your own chat; a VALUE he named and cclio relays (an email, a url, a colour) is his word; use it. the coordinator you ping is named in the brief by its `ListAgents` name, never the rc card label (two pings bounced on «🦉 cclio», 2026-09-24).
- **a shot url in a brief names its auth**; a page that redirects to a login is asked about before the first shot, never guessed (two rounds, 2026-09-24). **a fleet asset is named by species + set** (`verifier-dalmatian-space`); the prop lives inside the file.
- a mechanical edit across many files goes to `helper`, a lookup to `Explore`; your fence is the paths the brief names.
- edit the lines that change — never rewrite a file whose rest is untouched.
- **when a feature's ui grows faster than its behaviour, stop and ask.** One extra token source
  cost four rows of interface to explain one behaviour nobody asked to see (BYT-83); the miss was
  not saying «this needs four rows — is that what you want» before the first one.
- **removal is done when nothing teaches the old design.** After deleting a feature, grep for what
  described it — docs, `.env.example`, `AGENTS.md`, doc comments — before «final»; they outlive the
  code by a commit or two and are what the next reader learns from.
- **a scripted deletion spanning more than a few lines verifies its end anchor before it runs** —
  one anchored on a doc comment took seven components with it.
- **every replacement asserts its anchor** — a text pass that matches nothing, a field added to a
  type but not to the printer's order, `agent-browser fill <sel> ""`: three silent no-op writes in
  one session, each reported as success. the `edit-anchored` tool named below reads a text edit back for you; after a
  data-shape change, run the printer and read the row.
- **the brief names what dima sees, you find what is wrong.** «Verify the axes at two widths, fix
  what is wrong» beats «confirm the bottom clipping»: a named symptom narrows where you look, and a
  stored value can outrank the code default you were told to flip — check the observable, not the
  line.
- **your first step: serve your tree for dima** with the **start** steps of the app's `<app>-run` skill
  (its `.claude/skills/`) — main or a worktree, each on its own port — and put the url in your first
  reply as a 🌐 markdown link. keep it up: its **stop** steps run only when your worktree goes (the
  background task, or the PID captured at start; the port free after; every process, a next + convex
  app runs two). `/run` is the smoke test — launch, drive, stop — for your «run the thing» step. no
  run skill yet → say so in your first reply: `/run-skill-generator` is dima's to type, cclio relays.
  a shift plan's `server: skip` drops only the server dima watches, never one your checks need.

- **open every overlay and every changed view in the browser before its commit** — a typecheck and a
  unit test cannot see a dialog wired without its root; ⌘K blanked atelier for ~1 h of dima's test
  drive (BYT-103).
- **a gesture or interaction spec is one rule-set test file before round 1** — anchor, bounds,
  settle and scroll rules each passed alone and broke together; the zoom took 5 rounds adding one
  rule per round (BYT-104).
- **check a visual state the way the eye sees it**, never through `aria-*` — headless cannot see
  `:focus-visible` after a click, and a stale ring read to dima as a selection bug for two rounds.
- **before any commit, `pwd` is your worktree** — after reading the comp in studio, a coder's shell stayed
  there and its first commit landed on studio's `main` (BYT-113, reset before any push).

## the look card — the head of every done report (FRM-315)

so one look is enough for dima: **what** (one line) · **where** (one click: a port url, `file:line`, a pr, an artifact) · **try**
(1–3 steps he would take) · **proven** (the command you ran and its result) · **not checked**
(what only his eyes or hands can judge — never empty; «nothing left unchecked» is said in words).
anything rendered (an app, a band, a mod, an artifact) carries a screenshot, saved as
`~/.local/state/looks/<ticket>/<HHMM>-<what>.png` and named in **where**. an app with `FTR.md`
adds the ftr lines the change flipped.

