# Linear flow — the basics everyone needs

**cclio owns pm.** It runs the board, the conventions, the placement calls and the linear
mechanics. Everything here is the floor: what any session must know because tickets get touched in
the middle of doing something else. Anything past it, load the `pm` skill or hand it to cclio.

## Where tickets live

📌 **This flow binds only workspace `x-com`.** A repo with a different tracker — or none — follows
its own conventions; skip the ritual entirely.

- **Linear**, workspace `x-com`. Two teams: **`FRM`** = tooling, approaches, how-we-work (key was `DOT` until 2026-09-23 — an old
  `DOT-N` id still resolves to its `FRM-N`, so old links never need a sweep).
  **`BYT`** = building apps. Split by the nature of the work, never by which repo the files sit in.
- The channel is the **`linear` CLI**. 🚫 **Never the Linear MCP.** `linear api '<graphql>'` covers
  anything the CLI lacks.
  - `linear api` takes the query **positionally**, not behind a flag.
  - `linear issue list`/`mine` shows only YOUR issues — general listing is `issue query --team FRM`.
  - `linear issue comment add -b <text>` / `--body-file <path>` posts a comment (cli ≥2.5.0);
    `update` and `delete` exist too.

## State tracks reality

**The moment work on a ticket actually starts, move it to In Progress** — same turn, not
retroactively, not when the commit lands.

    linear issue update FRM-N --state "In Progress"

📌 **An agent starts only a ticket labelled `agent`.** A `human` ticket is dima's to start — an agent
never moves it, never picks it for a lane, a shift or a test, even when it looks ready (dima,
2026-09-30, after BYT-86 — `standing`, `human` — was proposed as a shift candidate). Labels are read
from the ticket in the same turn, never recalled.

📌 **Moving a ticket never assigns it.** In Progress says the work is happening; the assignee says
the ticket is Dima's. **Never pass `--assignee`.** Unassigned is the default and stays that way
until he assigns himself. This is absolute for workspace `x-com`, teams `FRM` and `BYT` — an oss
repo or a client tracker follows that project's conventions instead.

**The `standing` label** marks recurring work with no last round — a wish list, a running record. It
stays in **Todo** between rounds, never In Progress or In Review; a round of work on it is a child
ticket, which carries the state, the `- ticket:` lines, the pr and the done-report (dima, 2026-09-30).
An In Progress ticket is always live work — one that is not is stale.

## Ids are never invented

An id comes from Dima, from the conversation, or from the branch name. **Nowhere else.** Never
guess one, never grep for a plausible match, never write `FRM-?`. Most commits have no ticket, and
omitting the line is always correct.

⚠️ A commit body names its ticket as `- ticket: FRM-N`, and nothing else — Linear's own keywords
(`ref`, `closes`, …) next to an id are banned, because its parser answers them by assigning Dima.
The `cmt` skill owns that contract and loads on every commit; the pre-push hook
(`x linear push`) does the linking itself.
**Name the ticket you are about to close in your reply**, never close silently.

## Titles and bodies

Titles are subject-first, short, assertive. Details go in the body, never the title. Lowercase
register. The body is **current state**, kept true as scope moves; comments are the trail.
**Every close adds a closing word to the body** — what became better, what we have now. Never
bare-close.

## Rendering an id back to Dima

Always a link plus a short tldr, never a bare id. Format lives in `rules/fleet-output-format.md`.
