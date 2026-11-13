# x — words

the fleet cli's language: what an agent or dima calls, what x answers, and what it counts. definitions only — how a
thing is built lives in `AGENTS.md`, why it was chosen in `docs/adr/` (`X-nnnn`).

## the cli

- **verb** — one operation x runs, named `<family> <name>` (`lane commit`); the unit an agent calls. avoid: command, subcommand
- **family** — the verbs about one subject, named by their first word (`lane`, `handoff`); each owns a colour on the board
- **registry** — the one list of every verb and family; anything that names a verb reads it ([X-0002](docs/adr/X-0002-one-registry-one-resident-line.md))
- **door** — the one place the fleet goes to do a thing; a verb is x's kind of door
- **old door** — a script or file a verb took over; the verb names it under `replaces`, and it must be gone
- **raw door** — a family's traced passthrough to the tool underneath (`x linear api`), the fallback when no verb fits; what it carries ranks the next verbs. avoid: escape hatch
- **cover** — the x door that already does a head's job: a family's raw door, or the verb that replaced the script the command runs
- **touches** — what a verb reads or writes outside the repo (a store, the trash), named so a fixer sees where the door leads
- **admission rule** — the tests a verb passes before it joins x (`PRODUCT.md`): a fleet procedure, more than one surface calls it, it hides a hazard, a sequence or a location
- **resident line** — the one line every session holds about x: it exists, `x` lists families, `x schema <family>` the verbs. avoid: verb index
- **dev build** — an x binary built from `x/go` code that differs from `origin/main`: x being changed, not x in use ([X-0004](docs/adr/X-0004-local-trace-names-never-values.md)). avoid: dirty build

## what x answers

- **envelope** — the json a verb prints for a machine: the verb, whether it went ok, its data, plan or error, and the next command. avoid: response, payload
- **human view** — how x talks on a tty: boards, spinners, forms; a pipe, an agent env or `--json` gets the envelope instead
- **board** — one framed view a verb draws in the human view; `--board` draws it for an agent too. avoid: screen, tui
- **plan** — what a verb that publishes or destroys would do, printed before it acts; it acts only on `--apply` ([X-0003](docs/adr/X-0003-apply-gate-and-its-exceptions.md)). avoid: dry run, preview
- **next** — the command that moves the caller forward; every failure carries one
- **error kind** — why a traced call failed: `usage`, `refused` (x's own check stopped it before acting), `external` (a tool it ran failed) or `bug`

## who acts

- **caller** — who ran a verb, one value per trace: `dima`, `cc`, `cloud-chat`, `hook`, `ssh` or `other`
- **actor** — the fleet member a call acts as on an outside service (`clio`, `codie`, `dima`); `x as` picks it. the caller runs the verb, the actor signs the write. avoid: user, identity
- **owner label** — the linear label naming which clio holds a ticket, `clio-main` or `clio-wing-<N>`, read from the caller's thread record and set by its claim (In Progress, a delegate, a body write); a handover swaps it. avoid: seat label, clio label
- **order** — a team's manual order of tickets in linear: one sort-order number a ticket, ascending from the top; `x linear set --after|--before` moves one ticket in it. avoid: rank, position
- **pull** — one session's read of a ticket body to a file through `x linear body`: its record holds the file, the `updatedAt` and the size a later `--set` is checked against; a peer's pull of the same ticket is another pull. avoid: fetch, checkout

## the trace and what it counts

- **trace** — the one line x writes when a call exits: verb, flag names, caller, time, exit and error kind, never a value ([X-0004](docs/adr/X-0004-local-trace-names-never-values.md)). avoid: log, event
- **span** — the days from the first counted trace to the last, both included; never the window asked for
- **shape** — what a raw-door query asks for, without a word of its text: the operation kind and its top-level fields (`mutation issueArchive`)
- **head** — what a Bash command runs, past a leading `cd`, variable setup and wrappers: the tool's name, plus its verb for the tools that have one (`git commit`, `pnpm test`), or an interpreter with its script. not git's HEAD: a pr's newest commit is its **pr head**. avoid: command name
- **raw head** — a head no x door covers and no shell basic, run 5 times or more: a verb candidate
- **bare run** — a `claude … --safe-mode` call in a Bash command: a cc session our setup cannot touch
- **false fire** — a crew skill (`x:crew-codie`, `x:crew-sixth-sense`) loaded with no earlier message naming it; its opposite is **brief-led**
- **codie turn** — one assistant message in codie's transcript, summed over every codie session of a ticket. 📌 `fleet-vibe` calls this unit a step; the name stays because clio's pm skill writes the size lines in it
- **size** — a ticket's estimate as the fleet says it: XS, S or M, for linear's 1, 2, 3. XS and S each have a **size line** in codie turns (XS under 80, S under 400); M has none
- **size miss** — a closed ticket whose codie turns reached its size line

## lanes and reviews

- **lane** (the family) — the git door for one session's branch: commit, push, pr, merge main, unlock, seed, decamp, gate. 📌 not the fleet's lane, a working day with dima present (`fleet-vibe`)
- **gate** — the commit-msg check `x lane gate`: a contract change carries its glossary or adr, a growing skill was groomed, app code carries its ftr line; `--held` is its other mode, the purpose lint over a local layer's own registry files
- **gate turn** — the one machine-wide slot a commit or push hook runs in, first come, through `script/gate-queue.sh`; x takes it itself, a wrapper never holds it. avoid: queue lock
- **long turn** — the second machine-wide slot, for a long round (a suite by hand, mutants, a typecheck), through `script/gate-queue.sh --long`; a commit never waits behind it
- **gate runner** — `x gate run`: one command in the long turn, its whole log kept in a file, its exit code kept. 📌 not the **gate**, which is the commit-msg check
- **test-cpu-budget** — a suite's line in user + sys cpu-seconds, one row in `script/test-cpu-budget.tsv`; only a whole run counts, and it reds at the go doors by hand, never in ci, at a commit, or on a git other than `git-slim`, which the line is set on
- **contract** — the files a context's glossary defines, listed under the context in `GLOSSARY-MAP.md`; x's is its registry
- **groom** — reading a crew- or guide- skill whole and cutting before a commit that grows it
- **held files** — the unstaged and untracked work outside a commit's paths, set aside while the hooks run and put back byte for byte. avoid: stash
- **review thread** — one inline review comment and its replies on a pr, open until a reader resolves it; github's graphql names it `PRRT_…`, the id `gh pr-review-comments-list` prints and `gh pr-review-comments-reply` answers. avoid: review comment, for the thread
- **review round** — one successful ci review run on a pr in bytes, started by the review label; two per pr, a third only past dima's approval
- **🚀 line** — the dispatch's line on a ticket: its lane, its codie's session, on a quick lane `main:<base>`, and `sixth sense <sid>` when one was named; `x lane landed` reads the range and whether to wait for a verdict from the last one; a re-dispatch naming a new lane, session or sixth sense writes its own; a line a ↩️ leads below it takes it back, a ↩️ inside a sentence does not
- **wired line** — `x lane landed`'s line for a ticket whose `## ⚖️ worth it` carries a `new verb: <name>` line: «wired: unmeasured yet» until its milestone's last open ticket closes, then 🔴 at 0 calls in 30 days
- **sixth sense clean** — the pr head sixth sense said clean on, one per pr in `~/.claude/shelf/pr-verified.json`; a sibling `<repo>#<n>:by` key marks a solo stamp, another verifier's read (`clio`), which the gate takes alike and its detail names; it carries to a new head whose whole branch change keeps its patch-id (a rebase, a plain merge of main). a «clean» in a comment is never one
- **risky path** — a changed path that can turn the checks themselves green (workflows, settings, memory files, secrets, deploy), listed in `x/go/risky.json`; `lane merge-auto` merges it and names it on its `risky:` line
- **review tier** — what a pr's changed paths ask of its merge, read from `x/go/risky.json` as the union over every path: **light** (research and test-drive markdown, media files under `assets/` and `brand/`, an allow-list of extensions) drops the sixth sense, **memory** (memory, rule and skill markdown, the docs they cite) asks clio's **wishkeeper read**, **risky** asks the **security pass**, **normal** is everything else; the ci round holds on every tier. avoid: level, depth
- **self-edit** — a pr changing the guards, the review workflows, the risky list or merge-auto itself; `lane merge-auto` waits on it for dima's word, unless its chunk's sign pre-approved it; his word reaches merge-auto as `--dima-ok <pr>`, which x-mod-guard lets through only when his last typed prompt names the pr
- **operator-override** — the one switch only dima flips, by a whole typed prompt, in one store per mac, by scope; a lock asks it for its scope, and while `prs` is on `lane merge-auto` lands every pr, his hold and the brake still stopping it. avoid: pre-approval mode, auto-merge mode
- **pre-approved sign** — a chunk ticket's `## signed` block holding `merge: pre-approved` while its **sign state** reads match; it lets a self-edit of that chunk merge without dima's word, never past the brake
- **sign state** — a signed ticket's body read against the last `· body <hash>` of the `## signed` block that closes it: **match** when the hash fits the raw body or the body as signed (linear's link rewrite of an id to its own issue url folded back, trailing blanks trimmed to one blank line), **drifted** when neither fits, **no hash** with no block or no `· body` line; `linear list --label signed` and merge-auto read the same one
- **lease** — the remote sha `lane rebase-main` read before its rebase; its force-push lands only while the branch still sits there, so a teammate's push since is kept; `--onto` also records the head it rewrites, so a rerun after a conflict knows that sha for its own. avoid: force
- **verify tree** — a detached worktree of a pr's head or a main sha under `.claude/worktrees/`, seeded like `EnterWorktree`'s; sixth sense's bench, made by `lane verify-tree`
- **swap** — a `lane verify-tree --revert` run's named paths holding their merge-base content for the command
- **claim** — a file in a verify tree's git dir, naming the run that holds the tree from its first step and, during a swap, the swapped files; a live holder refuses the next run, a dead one's swap is restored from it
- **red** — a test that failed on an assertion on base's source and passed on head; a proof it reads the change. for `verify red`, a mutant whose run failed on an assertion or threw from the mutated code after the clean run passed
- **mutant** — the file with one pair's anchor swapped for its replacement, which `verify red` runs the test on off the real tree: a go overlay, a copy of the repo, or a mod's overlay
- **pair** — one anchor, found exactly once in the file, and its replacement; a pairs file holds many, each run alone
- **clean run** — `verify red`'s run on the file as it is, through the same harness as each mutant; it must pass and run a test, or nothing is mutated
- **red on head** — a test that fails on head, so base's source is not what fails it; a new test exits the run non-zero, an old one has a row and no vote
- **still green** — a test that passed on the source it should have failed on; it does not read the change
- **broken** — nothing proved: a compile or load error, 0 tests, a timeout, a new test's throw on base, or a pr adding no test x can read; for `verify red`, a mutant that fails its build, load or type check
- **unread** — what a pr adds that x cannot read as a proof: a computed, placeholder or table title, a name another test holds, a test that skips on head, an added line no named test holds; named, no vote
- **failed** (a proof's word) — an opaque command failed and its output names no test, or it exited 0 while naming a failure, so x has no verdict
- **gone quote** — a «» quote of dima's in a memory, skill or rules file that HEAD holds and the commit drops or rewords; `lane commit` refuses it until the message says `quotes: shown`
- **stack** — prs that each open onto the branch of the one below, merged together in one async call up to the pr named; linked on github through the gh-stack extension by the **stacks add-on**, x's one removable part (`//go:build !nostacks`)
- **layer** — one pr's branch in a stack: the root `codie/<ticket>-<slug>`, then `-2`, `-3` on top
- **brake** — every pr waiting for dima's word for 7 days after a merge-auto merge is reverted, read from git and github each run; a stack's squash, which carries no trailer, is known by its pr's `merged-by-x` label on github; a stack merge that landed another head than the gated one, or named no head at all, sets it too, through its pr's `merge-brake` label, until dima's typed word releases it; the one stored state is the mac's own record of a brake github refused to label
- **held mark** — dima's hold on a pr, one entry in this mac's record per repo, written by `lane merge-auto --hold`; no merge door lands it or a top above it without his word; an unreadable record reads as held
- **judged commit** — the pr head the last review round read; a verdict is **stale** when the pr head moved past it
- **comment feed** — one of the three places a pr's comments land: the conversation, reviews, and lines in the diff; the ci reviewer posts to a different one per round

## briefs

- **brief** — the markdown codie is summoned with
- **stamp** — the file a passing `x brief check` leaves, keyed by the brief's content, so a spawn guard can ask «was this brief checked». only a brief has a stamp
- **preflight** — the read of a ticket before a lane summons anyone: exit lines sixth sense can grade, every x verb and flag they name real, every command they name resolvable here (never run), nothing main already holds, no redesign in an unattended lane
- **dispatch marks** — the four writes a summoned lane leaves on each signed chunk, through `lane dispatch`: the `signed` label off, In Progress, the codie delegate, a `🚀 dispatched <date> — <lane>, codie <session>` line closing its sign block; the 🚀 line is what a re-run reads, since the label is gone after the first
- **after-merge list** — `lane landed`'s chores for a merged lane, each ✅ or 🔴 with its fix: the merge, the spec archived under `.scratch/_archive/<feature>/`, the closing slice, the review-rounds line, the lane's trees, the W-lines for the close; behind x's apply gate, `--apply` archives the spec
- **summon check** — `brief summon`'s read of the exact summon command before it runs: the argv order, the role skill line, the `wish:` line, the stamp, the fitting trials, the trust key, the spare age, a bytes app's essentials, sixth sense's arguments; it prints the argv with a minted `--session-id`, writes that id's thread record, and never launches. the judgment steps (reuse or summon, the model) stay the coordinator's
- **command span** — a backticked span whose first word is a command head (`x`, `pnpm`, `node`, `go`, `git`, `gh`, `rg`, `jq`) or a script path; preflight resolves it. every other span is a **value** (`match`, `## signed`, `spec:`) and is never resolved

## handoffs

- **CST** — one handoff file: the transcript that carries a thread to its successor. avoid: handoff file
- **handoff store** — the shared dir every surface reads and writes CSTs in ([ADR-0002](../docs/adr/0002-handoff-shared-file-store.md)). avoid: inbox, queue
- **audience** — the reader a CST is addressed to, or `any`; a CST addressed to another reader is left alone
- **pending** — a CST still in the handoff store, not yet ingested
- **shared** — a CST that survives an ingest so every reader gets it; an explicit delete still takes it

## mods, plugins, probes, knowledge

- **scratch copy** — a live mod file pulled out for a bg session to edit; a push writes it back
- **overlay** — a throwaway copy of a mod with its scratch copies laid over it; x tests the overlay, never the live mod
- **plugin cache** — where claude code installs a released plugin; a bump is proven when claude reports the new version there, never by a dir alone
- **probe** — a `claude -p` session run from a dir no repo owns, so our setup cannot answer for it: `bare`, no setup at all
- **knowledge shelf** — `docs/knowledge/`, the fleet's reference files. avoid: bare «shelf» — `~/.claude/shelf/` is a different dir
- **verified date** — the day a knowledge file was last checked against the world; a file with none is **unverified**. avoid: stamp
- **scope** — the word a lane's threads carry as their area (`cli`, `mods`, `herdr`, `strays`, …), one line of `x/go/scopes.json` with an optional emoji that replaces the role's mark and an optional unit that replaces the ticket; given as `--area`, never read from a ticket's linear project. avoid: area word, project word
- **thread** — one claude code session, keyed by its session id; its **thread record** is the role, lane, scope and ticket x wrote at its summon or dispatch, its **role** an id from `x/go/roles.json` (`coordinator`, `wing`, `adviser`, `copyist`, the lane roles) that also holds each role's pretty name, and its optional **title**, the name `x thread rename` gave it on dima's word; the **thread store** (`~/.claude/shelf/threads.json`) joins the live registry to those records. a reader asks by session id and never parses a name. avoid: seat
