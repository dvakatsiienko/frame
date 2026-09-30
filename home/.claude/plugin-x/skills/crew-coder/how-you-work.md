# how you work — the coder's lessons

Part of the `x:crew-coder` contract, binding in full; read at step 0 and again after any compact.

- **a library the job leans on is built from its docs, not from memory.** before the feature's
  first line, open the docs for the part you are building — its feature list, examples and
  recipes — and use what they offer; after, name in the report the features you used and one you
  skipped on purpose. scope to the part in hand: a zoom feature reads the zoom lib's examples (the
  `react-zoom-pan-pinch` centering and padding demos were what dima had to point out on atelier),
  never the whole of next.js. the docs hold the ux a bare call cannot guess.
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
  - **a probe that needs dima's hands asks first and launches on his word** — «he is at the
    keyboard» is never a guarantee (two wasted probe rounds, 2026-09-14).
- **a rule you write is read from the docs, never from the lockfile** (a react-compiler line
  was wrong from it).
- **reversing a decision**:
  - after reversing one mid-pr, re-read every commit on the branch that asserted something
    about the reversed thing — two review findings on #76 were docs from the old thesis.
  - before replacing an assertion, say what the old one protected.
- **fetch main before asking a question a commit could answer.**
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
- **one run is evidence of more than one thing** — before reporting it as proof of X, ask what
  else it shows (the greptile skip on #83 was both «owner test works» and the cancel bug).
- **a brief item is arguable on day one.** Say «i would cut this, because …» before building it —
  the answer lane on #79 produced 5 of 12 defects and the coder had the argument at the start.
- **nobody is watching.** Continue through every step the brief covers as long as it is
  reversible; stop only for an irreversible or an unbriefed step. A job that says «dima's word»
  starts without a y/n round — his approval is in the brief; ask only when the brief is unclear.
- **a steer relayed by cclio is not Dima's grant** — a push, a merge, a delete, a login: confirm with him in your own chat. a VALUE he named and cclio relays (an email, a url, a colour) is his word; use it. the coordinator you ping is named in the brief by its `ListAgents` name, never the rc card label (two pings bounced on «🦉 cclio», 2026-09-24).
- **a shot url in a brief names its auth**; a page that redirects to a login is asked about before the first shot, never guessed (two rounds, 2026-09-24). **a fleet asset is named by species + set** (`verifier-dalmatian-space`); the prop lives inside the file.
- touch only the paths the brief names; a problem elsewhere goes in your report, not the diff.
- edit the lines that change — never rewrite a file whose rest is untouched.
- name the `AGENTS.md` paths you loaded in your first reply — the bleed detector.
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
- **a write-path probe uses a key nothing is filed under, or a fixture** — one used dima's real note
  key (empty body = delete) and wiped `notes.json`; restored from git, byte-identical.
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
- **a claim about behaviour reaches dima measured, or labelled «inference»** — «pmndrs shifts
  colours» went out as a reason; the pair then measured Δ 2/255.
- **check a visual state the way the eye sees it**, never through `aria-*` — headless cannot see
  `:focus-visible` after a click, and a stale ring read to dima as a selection bug for two rounds.
