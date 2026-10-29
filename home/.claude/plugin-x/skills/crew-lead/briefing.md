# crew-lead — briefing a member, watching its work, the pr

## the brief

- **the role contract opens it** — a fresh `--bg` spawn's prompt starts `/x:crew-coder …` (or `/x:crew-verifier …`), and the slash expands; a running session gets it by a `SendMessage` saying «load the `x:crew-coder` skill», since a slash in a message never expands (`author-memory/references/skill.md` § placeholders). cclio adds only the job (the lane's spec path, `cclio:shape-lane-dispatch` § 2), the ticket, its own registry name, and any skill the work drifts into.
- **every other skill rides plain words that name it** — only the prompt's first slash expands, so the brief repeats the role in plain words as if the slash never expanded («use the crew-coder skill») and names the rest the same way: «use the guide-go skill to …», never «follow our go rules». a complete brief mutes the skill router, so an unnamed skill is an unloaded one. each spawn's first reply lists the skills it loaded; one line per spawn, named vs loaded, goes to `docs/test-drive/skill-named-load.md`.
- **on a verifier yes, the coder's brief names its verifier** `🌗 🔎 <T> verify: #<pr>` (`verify: main` on a quick lane), the number added once the pr exists; a coder with no verifier named hands its pr straight to dima.
- 🚧 **a `not yours: …` line** — what another member owns, written as a fence («crossing it is a stop and a question»), so a coder never duplicates or crosses it; the exit lines are the termination half.
- 🧭 **context pointers, never restatement** (dima's yes, 2026-10-07: «both are very useful ideas»): a brief or a `SendMessage` names the spec (`.scratch/<feature>/`), the pocket item, the commit or the research doc, and adds only what none of them holds. a restated ticket drifts from its source the moment either changes.
- **a brief whose proof needs dima's hands says so at the top** and asks up front.
- **a research brief asks for a structured summary, never a file dump** — paths with line ranges, who owns what, footguns, «what is NOT in the area». a plan or stack pick runs `advise-project-approach`, an architecture question names `neuroarxiv` as a lane (`habit-research-lanes`). a research brief carries `decided against: …` lines for what dima already rejected, and a research pick is checked against the spec's rules and his past verdicts before it enters a ticket or a reply.
- **a composer brief** (`x:crew-composer`) names only paths `git status` shows clean and no session holds, gives each anchor as one physical line that matches exactly once, and is read back from composer's receipt before any fix; `node ~/frame/_clio/script/composer-brief-check.ts <brief>` checks it before the brief goes out.
- **a long-run fork's brief says «wait in the foreground until the run ends»** — a fork that arms a background watcher returns at once and its run dies unreported.
- **a brief touching an `x` view carries «`x knowledge read charm` before the first view edit»** — the same line sits in `x/go/AGENTS.md`, and 0 of 8 x coders read it from there alone.
- **a blind run gets a cwd outside the repo and «do not read ~/frame»** — a «blind» advisor once read the built code through its cwd.
- **a job across several apps or repos** carries «before taking any action, explore broadly with tool calls».
- **a member whose final answer goes missing** gets «finish your tool calls first, write the final answer last».

## before it is sent — every word checked

- **every verb, flag, function and file a brief names** gets `--help` or one grep first; a grep done-criterion is run once before it enters a brief («old name absent» never empties when the new name contains the old).
- **a brief that points at files fetches main first** — two briefs once named files that lived only on an open pr.
- **a brief that adds a field names its value set or default and every writer of the field**, not only the readers.
- **a guess says «guess» and carries the one log query that would test it**; a brief carries the symptom and the evidence, and «check the timeline first» on a bug.
- **a research fact carries «?» until it is measured**.
- **a taste reference dima names goes into the ticket as a link the same day**; a visual spec names the artifact to match, never the recipe.
- **a ui-shaped ask gets its data measured before anything is drawn**.
- **a comparison brief names the question and the cheapest artifact that answers it** — one showcase screen per arm, never three full builds. a tui brief asks for vhs pngs (freeze cannot replay ink or bubbletea) and says «the shots are the test for redraws»; parallel arms share one shooter and one registry, said up front.
- **a no-pr lane still runs a local code review before its report**.
- **a verify-kit brief for an app that moves in-page says «cold open and in-page move»**.
- **a latency-bound tool measures each stage before the stack is chosen**.
- **a capability is chosen after grepping its word across the whole types file**.
- **a move is proven by executing every moved entrypoint**, never by a grep for the moved names.
- **a script that narrows a shared file to HEAD reads HEAD at write time**, never before the work.
- **an `AGENTS.md` imperative about WHEN acts at read time** («start `ray develop` first» means now).

## watching the work

- message the member whenever; it pings on the events `x:crew-dna` names. `git diff` in its cwd beats any message. doneness is a written marker (the final commit and the report), never transcript archaeology. subscribe, never poll. budget three round trips; more means the brief was wrong.
- **every «please test» carries the exact port link, and a screenshot's url is read before its report is relayed**.
- **a steer to a running member is a message**; the brief file is frozen at spawn, an edit to it reaches nobody. to a lane coder, every steer, ask or wisp also lands under its lane plan's `## not greenlit` the same turn, and the message names that line; a one-chunk lane has no lane plan, so the steer lands in the spec's section instead.
- **a relay to a member names the source it was read from**; a claim about a repo's behaviour opens that repo's `AGENTS.md` first.
- **a message stating a result goes after the command's output**, never in the same batch.
- **a timeout is not proof of failure** — `ListAgents` before a respawn; a blind retry double-runs the work.

## the pr

- **a pr cclio opens for a coder is opened as the coder app** — a coder opens its own with `x lane pr-open`; when cclio opens one: `GH_TOKEN=$(node ~/frame/script/github-agent-token.ts) gh pr create …` renders as `x-coder[bot]`, a plain `gh` makes it dima's.
- **a watch lives until its pr merges or closes, never until its coder stops** — `📡 pr-watch` (`~/frame/_clio/.claude/hooks/pr-watch.sh`, armed by `cclio:boot`) wakes cclio when a pr first appears («opened — spawn its verifier»), on a new commit, and once per head when green, so the verifier spawns off it within a minute and a spawn arms no watch of its own. a cloud report lands on a `cloud/<slug>` branch the same hook sees.
- **one coder with two prs in sequence gets one verifier that takes them in turn**.
- **before a merge, `review:clean` is green on the head**: the one ci round at «final», or past it cclio's `gh pr review --approve` on the verifier's clean; never a hand relabel.
- **a verifier's cap stop goes to cclio**, who drives the side lane fully, decides the merge and tells dima the stop as info (dima, o60); dima is never added as reviewer (2026-10-22: he does not read prs).
- **a ci reviewer's «clean» in under a minute on a big diff is a shallow pass**; the verifier's verdict decides, the ci reviewer is a second pair of eyes.
