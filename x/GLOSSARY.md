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
- **gate** — the commit-msg check `x lane gate`: a contract change carries its glossary or adr, a growing skill was groomed, app code carries its ftr line
- **contract** — the files a context's glossary defines, listed under the context in `GLOSSARY-MAP.md`; x's is its registry
- **groom** — reading a crew- or guide- skill whole and cutting before a commit that grows it
- **held files** — the unstaged and untracked work outside a commit's paths, set aside while the hooks run and put back byte for byte. avoid: stash
- **review round** — one successful ci review run on a pr in bytes, started by the review label; two per pr, a third only past dima's approval
- **sixth sense clean** — the pr head sixth sense said clean on, one per pr in `~/.claude/shelf/pr-verified.json`; it carries to a new head whose whole branch change keeps its patch-id (a rebase, a plain merge of main). a «clean» in a comment is never one
- **risky path** — a changed path that can turn the checks themselves green (workflows, settings, memory files, secrets, deploy), listed in `x/go/risky.json`; `lane merge-auto` merges it and names it on its `risky:` line
- **self-edit** — a pr changing the guards, the review workflows, the risky list or merge-auto itself; `lane merge-auto` waits on it for dima's word, unless its chunk's sign pre-approved it; his word reaches merge-auto as `--dima-ok <pr>`, which x-mod-guard lets through only when his last typed prompt names the pr
- **pre-approved sign** — a chunk ticket's `## signed` block holding `merge: pre-approved` while its **sign state** reads match; it lets a self-edit of that chunk merge without dima's word, never past the brake
- **sign state** — a signed ticket's body read against the last `· body <hash>` of the `## signed` block that closes it: **match** when the hash fits the raw body or the body as signed (linear's link rewrite of an id to its own issue url folded back, trailing blanks trimmed to one blank line), **drifted** when neither fits, **no hash** with no block or no `· body` line; `linear list --label signed` and merge-auto read the same one
- **lease** — the remote sha `lane rebase-main` read before its rebase; its force-push lands only while the branch still sits there, so a teammate's push since is kept. avoid: force
- **verify tree** — a detached worktree of a pr's head or a main sha under `.claude/worktrees/`, seeded like `EnterWorktree`'s; sixth sense's bench, made by `lane verify-tree`
- **gone quote** — a «» quote of dima's in a memory, skill or rules file that HEAD holds and the commit drops or rewords; `lane commit` refuses it until the message says `quotes: shown`
- **stack** — prs that each open onto the branch of the one below, merged together in one async call up to the pr named; linked on github through the gh-stack extension by the **stacks add-on**, x's one removable part (`//go:build !nostacks`)
- **layer** — one pr's branch in a stack: the root `codie/<ticket>-<slug>`, then `-2`, `-3` on top
- **brake** — every pr waiting for dima's word for 7 days after a merge-auto merge is reverted, read from git and github each run; a stack's squash, which carries no trailer, is known by its pr's `merged-by-x` label on github; a stack merge that landed another head than the gated one, or named no head at all, sets it too, through its pr's `merge-brake` label, until dima's typed word releases it; the one stored state is the mac's own record of a brake github refused to label
- **judged commit** — the pr head the last review round read; a verdict is **stale** when the pr head moved past it
- **comment feed** — one of the three places a pr's comments land: the conversation, reviews, and lines in the diff; the ci reviewer posts to a different one per round

## briefs

- **brief** — the markdown codie is summoned with
- **stamp** — the file a passing `x brief check` leaves, keyed by the brief's content, so a spawn guard can ask «was this brief checked». only a brief has a stamp
- **preflight** — the read of a ticket before a lane summons anyone: exit lines sixth sense can grade, every x verb and flag they name real, every command they name resolvable here (never run), nothing main already holds, no redesign in an unattended lane
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
- **probe** — a `claude -p` session run from a dir no repo owns, so our setup cannot answer for it: `bare` (no setup at all) or `session` (named, resumable)
- **knowledge shelf** — `docs/knowledge/`, the fleet's reference files. avoid: bare «shelf» — `~/.claude/shelf/` is a different dir
- **verified date** — the day a knowledge file was last checked against the world; a file with none is **unverified**. avoid: stamp
