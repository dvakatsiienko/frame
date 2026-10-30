# crew-lead — briefing a member, watching its work, the pr

## the brief

- **the role contract opens it** — a fresh `--bg` summon's prompt starts `/x:crew-codie …` (or `/x:crew-sixth-sense …`), and the slash expands; a running session gets it by a `SendMessage` saying «load the `x:crew-codie` skill», since a slash in a message never expands (`author-memory/references/skill.md` § placeholders). clio adds only the job (the lane's spec path, `clio:shape-lane-dispatch` § 2), the ticket, its own registry name, and any skill the work drifts into.
- **every other skill rides plain words that name it** — only the prompt's first slash expands, so the brief repeats the role in plain words as if the slash never expanded («use the crew-codie skill») and names the rest the same way: «use the guide-go skill to …», never «follow our go rules». a complete brief mutes the skill router, so an unnamed skill is an unloaded one. each summoned member's first reply lists the skills it loaded; one line per summon, named vs loaded, goes to `docs/test-drive/skill-named-load.md`.
- **on a sixth sense yes, codie's brief names its sixth sense** `🌗 🔎 sixth sense: <scope> | #<pr>` (`| main` on a quick lane), the number added once the pr exists; codie with no sixth sense named hands its pr straight to dima.
- 🚧 **a `not yours: …` line** — what another member owns, written as a fence («crossing it is a stop and a question»), so codie never duplicates or crosses it; the exit lines are the termination half.
- 🧭 **context pointers, never restatement** (dima's yes, 2026-10-07: «both are very useful ideas»): a brief or a `SendMessage` names the spec (`.scratch/<feature>/`), the pocket item, the commit or the research doc, and adds only what none of them holds. a restated ticket drifts from its source the moment either changes.
- **a brief whose proof needs dima's hands says so at the top** and asks up front.
- **a research brief asks for a structured summary, never a file dump** — paths with line ranges, who owns what, footguns, «what is NOT in the area». a plan or stack pick runs `advise-project-approach`, an architecture question names `neuroarxiv` as a lane (`habit-research-lanes`). a research brief carries `decided against: …` lines for what dima already rejected, and a research pick is checked against the spec's rules and his past verdicts before it enters a ticket or a reply.
- **a helga brief** (`x:crew-helga`) names only paths `git status` shows clean and no session holds, gives each anchor as one physical line that matches exactly once, and is read back from helga's receipt before any fix; `node ~/frame/_clio/script/helga-brief-check.ts <brief>` checks it before the brief goes out.
- **a long-run fork's brief says «wait in the foreground until the run ends»** — a fork that arms a background watcher returns at once and its run dies unreported.
- **a brief touching an `x` view carries «`x knowledge read charm` before the first view edit»** — the same line sits in `x/go/AGENTS.md`, and 0 of 8 x codies read it from there alone.
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
- **a brief names the review by its job**: matt's `code-review` grades against the house rules and the spec, the built-in `/code-review` hunts bugs and joins it for a big change (`x:crew-codie` § the list, step 2; dima, 2026-10-30).
- **a verify-kit brief for an app that moves in-page says «cold open and in-page move»**.
- **a latency-bound tool measures each stage before the stack is chosen**.
- **a capability is chosen after grepping its word across the whole types file**.
- **a move is proven by executing every moved entrypoint**, never by a grep for the moved names.
- **a script that narrows a shared file to HEAD reads HEAD at write time**, never before the work.
- **an `AGENTS.md` imperative about WHEN acts at read time** («start `ray develop` first» means now).

## watching the work

- message the member whenever; it pings on the events `x:crew-dna` names. `git diff` in its cwd beats any message. doneness is a written marker (the final commit and the report), never transcript archaeology. subscribe, never poll. budget three round trips; more means the brief was wrong.
- **every «please test» carries the exact port link, and a screenshot's url is read before its report is relayed**.
- **a steer to a running member is a message**; the brief file is frozen at summon, an edit to it reaches nobody. to a lane codie, every steer, ask or wisp also lands under its lane plan's `## not greenlit` the same turn, and the message names that line; a one-chunk lane has no lane plan, so the steer lands in the spec's section instead.
- **a relay to a member names the source it was read from**; a claim about a repo's behaviour opens that repo's `AGENTS.md` first.
- **a message stating a result goes after the command's output**, never in the same batch.
- **a timeout is not proof of failure** — `ListAgents` before a re-summon; a blind retry double-runs the work.

## the pr

- **a pr clio opens for codie is opened as the codie app** — codie opens its own with `x lane pr-open`; when clio opens one: `GH_TOKEN=$(node ~/frame/script/github-agent-token.ts) gh pr create …` renders as `x-codie-cc[bot]`, a plain `gh` makes it dima's.
- **a watch lives until its pr merges or closes, never until its codie stops** — `📡 pr-watch` (`~/frame/_clio/.claude/hooks/pr-watch.sh`, armed by `clio:boot`) wakes clio when a pr first appears («opened — summon its sixth sense»), on a new commit, and once per head when green, so sixth sense is summoned off it within a minute and a summon arms no watch of its own. a cloud report lands on a `cloud/<slug>` branch the same hook sees.
- **one codie with two prs in sequence gets one sixth sense that takes them in turn**.
- **before a merge, `review:clean` is green on the head**: the one ci round at «final», or past it clio's `gh pr review --approve` on sixth sense's clean; never a hand relabel.
- **sixth sense's cap stop goes to clio**, who drives the side lane fully, decides the merge and tells dima the stop as info (dima, o60); dima is never added as reviewer (2026-10-22: he does not read prs).
- **a ci reviewer's «clean» in under a minute on a big diff is a shallow pass**; sixth sense's verdict decides, the ci reviewer is a second pair of eyes.
