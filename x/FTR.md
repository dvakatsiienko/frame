# x — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## x — the overview

- ✅ `x` on the PATH runs the go binary of the nearest frame tree
  - given a cwd inside a frame tree (main or a worktree), or anywhere else
  - when `x` runs
  - then that tree's `x/go/bin/x` runs, or the checkout the shim lives in when no tree is above the cwd
  - given a go source file newer than the binary, then the shim rebuilds it first, and a failed build prints the compiler output to stderr, says so, and runs the last binary
  - decision: go + charm, picked on the FRM-284 look probe (2026-10-06); the TS arm and its bun shim retire
- ✅ bare `x` lists the families on one screen
  - given dima runs bare `x` in a terminal at 80 and at 120 cols
  - when it renders
  - then one framed row per family shows a dot and its name in the family colour, its purpose and its verb names, and the whole board fits a 30-row terminal; under 100 cols the verb names fold under the purpose
  - decision: a dot, not a filled chip — filled chips on consecutive rows touched and read as one block; a blank row between families cost 11 rows (dima, 2026-10-09)
  - given an agent or a pipe, then the envelope holds each family with its purpose and verb names only, and `next` names `x schema <family>`
  - decision: families first, verbs one call deeper, as `PRODUCT.md` planned — the full list scrolled (dima, 2026-10-09)
  - decision: the look is picked by the a/b/c in FRM-284 — TS + gum, TS + ink, go + full charm
- ✅ `x --all` draws every verb in one table
  - given dima runs `x --all`
  - when it renders
  - then it draws the T2 dense-family table ([spread v6](https://claude.ai/artifact/6FSNX9owdhioGuJyeyGZJu)): every verb with its purpose, a colour per family, the takes column folded under 100 cols; `--json` lists every verb with its purpose
- ✅ every verb speaks one envelope
  - given any verb run with `--json` or into a pipe
  - when it ends
  - then stdout holds one envelope `{verb, ok, status, data}` and the exit code matches `ok`
- ✅ `--board` draws the human board where json is the default
  - given an agent env (`CLAUDECODE` set) or a pipe
  - when a verb runs with `--board`, `x fleet flow --board` among them
  - then stdout holds the board, not json; `--json` beside it still wins
- ✅ a wrong verb names the right ones
  - given an unknown verb or flag
  - when it fails
  - then the error lists the valid verbs or flags of that family
- ✅ `x schema` prints a verb's schema — the same entry that dispatches it
- ✅ a board taller than the terminal opens in a pager
  - given `x knowledge read`, `x handoff peek`, `x handoff ingest` or `x schema` drawing more rows than the terminal holds
  - when dima runs it in a terminal
  - then the board scrolls in a pager with its frame fixed, the footer shows the scroll and the keys, and q leaves; a pipe or a board that fits prints as before
- ✅ zsh completes every verb, flag and value
  - given `source <(x completion zsh)` in zsh
  - when dima presses Tab after `x`, a family, a verb or a flag
  - then zsh offers the families, the verbs, the flags, and each value from where it lives: pending slugs, shelf names, probe names, models, audiences, `.md` briefs, `.json` settings, dirs for `--repo`
  - decision: the completers are keyed by the registry's arg and flag names, so a new verb that reuses a name completes with no edit
- ✅ a bare family prints its verbs
  - given any family, a hidden one (`trace`) included
  - when `x <family>` runs with no verb
  - then it draws that family's rows of the `x --all` table, titled with its chip and purpose; `x <family> --help` still draws the family help (usage, flags, exit codes, an example); a hidden family still stays out of the overview and completion
- ✅ a ported verb's old door stays dead
  - given a registry entry whose `replaces:` names a file or a script name
  - when `go test` runs
  - then `replaces_test.go` is red while that file exists or any tracked file outside history names its basename; `x schema <verb>` prints `replaces`, `touches` and the source dir
- ✅ `x schema` at two detail levels
  - given a verb or a family name
  - when `x schema` runs with the short level
  - then it prints names and one-line purposes only; the full level prints the whole schema

## the resident line

- 🧭 a session knows x exists, and finds a verb on demand
  - makes: one resident line, «`x` is the fleet cli; `x` lists families, `x schema <family>` the verbs» — never a per-verb index (dima, 2026-10-07: a per-verb index weighs ~1.5k tokens at 60 verbs, an mcp by another name)
  - given a fresh cc session
  - when it needs a fleet procedure
  - then one `x` call lists the families, and no verb list sat in its context before
- 🧭 a call to a replaced script points at its verb
  - given a verb's registry entry names the script it `replaces:`
  - when a Bash call runs that script
  - then `x-mod-guard` answers with the verb to use

## lane — git

- ✅ `x lane commit` commits only the named paths and prints the new sha
- ✅ `x lane commit` refuses a mod that fails `claude plugin validate`
  - given a named path sits under `home/.claude/plugin-x/mods/<mod>/`
  - when `claude plugin validate` on that mod's dir fails
  - then the commit is refused with the validator's output, nothing is staged, and HEAD does not move
  - given the validate passes, then the commit goes through as before
  - decision: in the commit verb, not a lefthook job — a mod round chained `validate && commit` by hand and still committed past a red (FRM-307's first commit, 2026-10-05)
- ✅ `x lane commit --hold-unstaged` keeps other work out of the hooks
  - given unstaged edits and untracked files outside the named paths
  - when `x lane commit --hold-unstaged <msg-file> -- <paths>` runs
  - then the hooks see only the index version of the tree, the commit lands, and every held file is back byte for byte — also when a hook refuses
  - decision: the files move into the git dir, never the shared stash stack another session could pop
- ✅ `x lane push` pushes HEAD's sha and reads the remote back
- ⬜ `x lane pr-open` opens a pr as the coder app
- ✅ `x lane review <pr>` keeps the ci review on the pr head
  - given a pr whose last review round judged an older commit, under the 2-round cap
  - when `x lane review <pr>` runs
  - then it re-adds `🤖 review:requested` as the coder app and names the judged commit
  - given the last round judged the head, a round still running on the branch, or a repo with no `review.yml`, then it prints ok and touches no label
  - given dima approved the head, or `review:clean` is green on it, then it prints ok («cleared») and touches no label, past the cap too
  - given 2 rounds already ran and neither holds, then it requests nothing, exits 1 and names dima's approval of the pr as the way past
  - given the label came off and the add failed, then the failure says the pr now holds no review label
  - decision: no `--apply` — the verb's own checks (staleness, the cap) are the guard, and the coder's «final» ping runs it as one call (FRM-355)
- ✅ `x lane pr-body <pr> <file>` writes a pr body by number and reads it back
  - given no pr number, or a file where the number goes
  - when `x lane pr-body` runs
  - then it refuses with exit 2 and calls nothing
  - given a number and a file, when it runs with `--apply`, then the body is written as the coder app and the read-back matches the file, or it fails naming the difference
- ⬜ `x lane merge-main` merges origin/main, stops on a conflict with the file list
- ✅ a merge-main that git refuses without conflicts names git's reason
  - given an untracked file where origin/main adds one
  - when `x lane merge-main` runs
  - then the envelope error carries git's own `error:` line
- ✅ `x lane unlock` decrypts a worktree's git-crypt files
  - given a hand-made worktree whose git-crypt files hold ciphertext, where `go build` dies on the vcs stamp
  - when `x lane unlock` runs inside it
  - then the files read as plaintext and `go build` passes with no extra env
- ✅ `x lane seed <path>` seeds a hand-made worktree the way EnterWorktree does
  - given a tree made by `git worktree add`
  - when `x lane seed <path>` runs
  - then its git-crypt files are plaintext, `go build` passes, each mod's ignored `tsconfig.json` is copied from the main checkout, and the hook shims still point at the main checkout
  - given the main checkout itself
  - then it is refused as a usage error
- ✅ `x lane decamp <path> --apply` removes a worktree and points the hook shims home
  - given the shared lefthook shims point at a linked worktree
  - when `x lane decamp <path> --apply` runs
  - then the tree is gone and the shims point at the main checkout
  - decision: dima's `decamp` alias stays `git worktree remove` until he says otherwise (cclio, 2026-10-08)

## go — x's own checks

- ✅ `x go gate [dir]` runs gofmt, vet, staticcheck, go fix and the tests in one call
  - given a go module with a gofmt finding
  - when `x go gate <dir>` runs
  - then it prints `GATE red: gofmt` and exits non-zero
  - decision: piped into head, tail or grep it is refused by x-mod-guard, whose fix is reading the GATE line — no process controls a pipeline's exit (cclio, 2026-10-08)

## handoff — the CST store

- ✅ `x handoff` lists, peeks and ingests CSTs from the shared store
  - given a pending handoff in the store
  - when `x handoff list` runs
  - then it lists the same handoffs `x-cw`'s tools see — they shell out to it, one store, one door
- ✅ an ingest names its reader
  - given a pending CST
  - when `x handoff ingest` runs without `--for`, a slug or not
  - then it is exit 2, the file stays, and `next` names the `--for` form; with `--for`, a slug forces another agent's file, a bare pull never takes one
- ✅ `x handoff write` saves a CST
  - makes: `~/.claude/shelf/handoffs/<for>--<lane>--<topic>--by-<author>--<utc-ts>[-shared].md`, mode 600
  - given a CST on stdin and `--slug`
  - when `x handoff write --audience <a> --slug <s> --lane <l> --author <who>` runs
  - then one file lands under that name; an empty stdin or no slug is exit 2 and writes nothing
- ✅ `x handoff write --replaces` folds a thread into one file
  - given a pending handoff of the same thread
  - when `write --replaces <slug>` runs
  - then the sibling is gone, the new file stands alone and inherits its `-shared`; a slug matching nothing is exit 2 and writes nothing
- ✅ `x handoff delete` removes one CST or all of them
  - given pending handoffs, shared ones among them
  - when `x handoff delete <slug>` or `x handoff delete --all` runs
  - then that one file, or every file, goes to the macos trash; a bare `delete` is exit 2 and touches nothing
  - decision: no `--apply` — the store is disposable by contract (ADR-0002), and the envelope names what went
- ✅ every handoff caller goes through `x handoff`
  - given the two plugin-x handoff skills, `CST-SPEC.md`, the `x-cw` handoff tools and the x-ray raycast command
  - when they list, peek, ingest, write or delete
  - then each one calls `x handoff … --json`; the node store script is gone
  - decision: the raycast command is renamed `handoff` with the rest — it carries no hotkey, so nothing was orphaned (dima's screenshot, via cclio, 2026-10-07)
- ✅ `x handoff list` paints in under 20 ms
  - given the live store
  - when dima runs `x handoff list` in a terminal
  - then the board is drawn in under 20 ms (median of 40), node never starts
  - decision: go reads the store itself; the node bridge cost 60 of 72 ms. `store_test.go` reads every name in `script/lib/handoff-names.json` (ADR 0002, amended)
- ✅ a CST's run id reads its value
  - given a META line in any shape out there — `run id: x`, `run id: **x**`, `**run marker** — run id: **cc·x**`, `**run marker** — \`x\``
  - when `x handoff list` shows it
  - then the run id column says the id; «none» or prose after the label reads as no run id
- 🧭 a cloud thread reaches handoffs through the mac
  - given a cloud project thread
  - when it runs `~/.local/bin/x handoff list` through the remote-devices Desktop Commander
  - then it gets the same envelope as on the mac

## brief

- ✅ `x brief check` refuses a brief that names what is not there
  - makes: a stamp `~/.local/state/x/briefs/<sha256>.json` on a pass
  - given a brief whose backticks name a path, a `pnpm` script or an `x` verb the repo lacks, or a ticket id linear cannot find
  - when `x brief check <brief> --repo <path>` runs
  - then it fails and names each one with its line; a thing the brief asks to build passes when `(new)` follows it
- ✅ `x brief check` lints the exit lines
  - given a rate with no n, an exit line with no surface, an exit line into `cclio/`, a relayed approval with no time, or jev with no budget
  - when it runs
  - then each finding names its line and the rule
- ✅ `x brief preflight <ticket>` reads a ticket against main before a lane
  - given a ticket with an exit line without a number, an exit line with no surface and no «post-merge», a simplify / redesign / rework outside quotes, an `x` verb origin/main already has, or a path a main commit for this ticket already changed
  - when `x brief preflight <ticket>` runs
  - then it fails naming each one with its line, and lists every main commit whose body carries `ticket: <id>`
  - given a clean ticket, then it prints ok
  - decision: a path counts as shipped only through a commit for this ticket, never by existing — most exit lines edit files main has (cclio, 2026-10-09)

## probe

- ✅ `x probe bare` asks claude with none of our setup
  - given a prompt
  - when `x probe bare '<prompt>'` runs
  - then `claude -p --safe-mode --strict-mcp-config --no-session-persistence` answers from a temp dir, haiku by default, and the board shows the answer as markdown with its cost
- ✅ `x probe session` keeps a named probe across calls
  - makes: `~/.local/state/x/probes/<name>/` with the session id
  - given a name and a settings json
  - when it runs twice with the same name
  - then the second call resumes the first session

## knowledge

- ✅ `x knowledge list` shows the shelf with its stamps
  - given `docs/knowledge/`
  - when it runs
  - then each file shows its title and its verified date, and a file with none says unstamped
- ✅ `x knowledge read` prints one file and logs the read
  - makes: a line in `~/.local/state/x/knowledge-reads.jsonl`
  - given a word of a file name
  - when it runs
  - then the file renders as markdown; a word matching several files lists them

## as — identity

- ✅ `x as <member> -- <command>` runs one command as a fleet member
  - given a member (`cclio`, `coder`, `dima`) and a `linear` or `gh` command after `--`
  - when it runs
  - then the command runs with that member's token in its own env only (`LINEAR_API_KEY`, `GH_TOKEN`); its output and exit code are the call's, with no envelope
  - then the trace line names the actor; no token reaches x's stdout, stderr or the trace
  - given an unknown member, a tool x holds no token for, or no command, then exit 2 and one line
  - decision: a top-level verb, not under `linear` — identity crosses families (linear, gh), the same reading as `schema` and `stats` (FRM-344)
- ✅ an app token is minted once and reused until it nears expiry
  - makes: a keychain item `x-token-<tool>-<app>` holding `<expiry>:<token>`
  - given no cached token, or one with under 24 h (linear) or 10 min (gh) left
  - when `x as` runs
  - then a fresh token is minted from the member's oauth pair or app key and cached; else the cached one is used

## linear — tickets

- ✅ `x linear read <ids…>` reads tickets in one request
  - given one or more `FRM-N`/`BYT-N` ids
  - when it runs
  - then one graphql request carries them all, and each ticket prints its title, state, body, labels, project, milestone, estimate, priority, parent and children, in the order asked
  - given `--comments`, then the comments print oldest first with their authors; given `--relations`, then both sides print, the inverse one flipped («blocked by»)
  - given a list that hit its page size, then the ticket lists it under `capped`, and the card marks it
  - given an id linear cannot find, then exit 1 naming that id; a malformed id exits 2 before any request
  - given a terminal, then each ticket is a card: the state in colour, label chips, the body as markdown; a spinner runs while linear answers
- ✅ `x linear read --attachments <dir>` saves a ticket's files
  - makes: each linear upload the ticket attaches or links in its body, saved once under `<dir>`, named by the link label or the attachment title (the url's last segment when neither has one)
  - given a ticket with uploads
  - when it runs
  - then x downloads them with the actor's auth, so no key passes through the caller's shell; the envelope lists each file and its size
  - then an attachment that links elsewhere (a pr, a page) is skipped, and a name never walks out of `<dir>`
- ✅ `x linear list` finds tickets by name, in one request
  - given `--team`, `--state`, `--label` (comma-separated, all must match), `--project`, `--milestone` — names, never ids
  - when it runs
  - then linear filters by those names in the same request, and each row prints id, state, title, labels, project, priority, estimate
  - given no `--state`, then closed tickets stay out; given `--search <term>`, then linear's full-text search runs, closed tickets included
  - given a page that hit 50, then the list says `capped` with its count
  - given an empty list and a name linear does not know (a typo'd state, label, project, milestone or team), then exit 2 naming it
  - decision: no default team — a bare list covers both teams (dima, 2026-10-07)
- ✅ `x linear body` pulls a description to a file and writes it back safely
  - makes: the body in `~/.local/state/x/linear/bodies/<id>.md` (or `--to <file>`), and the pull's `updatedAt` in `~/.local/state/x/linear/pulls.json`
  - given a ticket
  - when `x linear body <id>` runs, then its description lands in the file, byte for byte
  - when `x linear body <id> --set <file>` runs after a pull and the ticket is unchanged, then the file becomes the description, and the envelope names the actor
  - given the ticket changed since the pull (a peer's edit, dima's words), then nothing is written: exit 1, and `next` pulls theirs beside yours and diffs the two
  - given no pull of that ticket, then nothing is written and `next` is the pull
- ✅ `x linear set` updates a ticket by names, in one write
  - given `--state`, `--priority`, `--estimate`, `--parent FRM-N`, `--project`, `--milestone`, `--delegate coder|cclio`, `--add-label`, `--remove-label` — names, never ids
  - when it runs
  - then one lookup resolves every name and one `issueUpdate` lands them all; the envelope prints the actor and each change as `field: old → new`
  - given `--add-label` or `--remove-label`, then only those labels move — the write carries the delta (`addedLabelIds`, `removedLabelIds`), so a label another writer adds in between survives
  - decision: deltas over the spec's full set, for that race (dima, 2026-10-07)
  - given a name the ticket's team or the workspace lacks, then exit 1 listing the valid names, and nothing is written; given no field at all, exit 2
- ✅ `x linear link <id> blocks|related|duplicate <targets…>` relates tickets in one request
  - given a ticket, a kind and one or more targets, all by `FRM-N`
  - when it runs, then one request creates a relation per target, and the envelope names the actor
  - given another kind, then exit 2 naming the three
- ✅ `x linear comment <id> --body-file <f>` posts a comment
  - given a markdown file with backticks, `$VAR` and quotes
  - when it runs, then the comment holds the file byte for byte, and the envelope prints the actor and the comment's url
- ✅ `x linear update <project|initiative> --body-file <f> --health <h>` posts a status update
  - given a name that finds exactly one project or initiative, and `--health onTrack|atRisk|offTrack`
  - when it runs, then the update lands on that one with its health; a name that finds none or several writes nothing
- ✅ `x linear api '<graphql>'` is the raw door when no verb fits
  - given any graphql, and `--vars '<json object>'`
  - when it runs, then it goes out as the acting member, and linear's reply prints as it came — exit 1 when it holds errors
  - given an `FRM-N` where linear wants a uuid (`id:`, `issueId:`, `relatedIssueId:`, `parentId:`, or an `…Id` variable), then x swaps in the uuid; `issue(id: "FRM-N")` and text inside a string stay as written
  - then the trace keeps the query's shape (`mutation issueArchive`) and the ticket ids in it, never its text or a variable's value
  - decision: ticket ids written in the query stay in the trace — traces keep entity ids (dima, 2026-10-07)
  - decision: `--vars <json>` over the spec's `--var k=v` — one flag carries typed values (numbers, input objects) (dima, 2026-10-07)
- ✅ `x stats` ranks what the raw doors carried
  - given traces of raw-door calls
  - when `x stats` runs, then each family lists its five most-carried shapes with counts — a shape seen three times is a verb candidate
- ✅ `x schema linear` names the raw door and the identity behind every verb
- ✅ `x linear push` is the pre-push hook: it links pushed commits and undoes linear's auto-assign
  - makes: a line per write in `<repo>/.git/linear-push.log` (the common git dir, shared by worktrees)
  - given a push from a repo under `github.com/dvakatsiienko` whose commits carry `- ticket: FRM-N`
  - when lefthook's pre-push runs `x linear push {1} {2}`, then the hook half exits 0 at once, and a detached run half waits for the push to land, then attaches each commit to its ticket
  - given a commit written with linear's own keyword (`ref FRM-2`), then the assignee and state the integration wrote after the push are undone; a closing keyword keeps its state move, a completed state is never reopened, anything stamped before the push is dima's and stays
  - given another owner or host, then it stands down and says why; given a push that never lands, then nothing is written; given linear down, the push still succeeds
  - decision: links and reverts go out as the cclio app — the old script wrote as dima (dima, 2026-10-07)
- ✅ `x linear archive [--days 14]` retires closed tickets
  - given closed tickets (completed or canceled) untouched for `--days`
  - when it runs, then it prints the plan and exits 4; with `--apply`, one request archives them all and a capped page says «run again»
- ✅ every `x linear` call acts as someone, and says who
  - given an agent (`CLAUDECODE` or `AI_AGENT`), a hook, a launchd job or cw — anything without a terminal — then it acts as the cclio app; given dima's own terminal, as dima; `--as coder|cclio|dima` overrides
  - given linear rejects a cached app token (401), then x mints it again and retries once
  - decision: dima's own key is read from 1password on every call and never copied into the keychain — only minted app tokens are cached; the read costs ~0.72 s (3 runs, 2026-10-07) (dima, 2026-10-07)

## fleet — the fleet measuring itself

- ✅ `x fleet flow` prints the fleet-flow done test
  - given the flawlog, the session transcripts, x-mod-guard's store and `gh`
  - when `x fleet flow --days 14` runs
  - then it prints the `#dima-caught` and `#brief` flawlog lines against their baselines, **bare runs**, crew-skill loads (brief-led or a **false fire**), today's guard refusals and escapes by rule, the pr open → merge median of frame and bytes (renovate left out), and Reads per `docs/knowledge` file
  - decision: a straight port of the flow script, number for number on the same day; the script died with it (FRM-347)
- ✅ `x fleet audit` checks each coder read its lessons first
  - given the session transcripts of the last `--days` (default 1)
  - when `x fleet audit` runs
  - then each session opened with `/x:crew-coder` gets a line: whether it read `crew-coder/how-you-work.md` before its first edit, a ✅ or 🚫 per compaction for the re-read, and its library-docs lookups (ctx7, the context7 mcp, web)
- ✅ `x fleet ops` prices the agents' work
  - given the session transcripts of the last `--days` (default 7) of at least `--min-kb` (default 200)
  - when `x fleet ops` runs
  - then it prints tokens and wall time per ticket (coder + verifier, each step once), cclio's code edits per session, and the cost of a cclio boot (full and mini), each with its median
- ✅ a bad `--days` or `--min-kb` exits 2 with the command that works

## stats — telemetry

- ✅ every `x` call leaves one trace line
  - makes: a json line in `~/.local/state/x/traces/<local day>.jsonl`
  - given any verb, run by anyone
  - when it exits — ok, usage, refused, external or a panic
  - then the day's file holds one line: the verb, flag names, ids, caller, duration, step times, exit, error kind, x version, and `x.dev` for a dev build (never on an `x trace record` line: a pnpm script dima types in a worktree is real use) — never a flag value or free text
  - given `X_TRACE=0`, then nothing is written; given a trace dir that cannot be written, then the call ends as it would untraced
  - decision: the dispatcher writes it at exit, so a new verb is traced with no telemetry code (spec, 2026-10-07)
- ✅ the trace names its caller
  - given `CLAUDECODE=1`, `SSH_CONNECTION`, a git or cc hook env, a Cowork Desktop Commander, or a plain tty
  - when x runs
  - then the caller reads `cc`, `ssh`, `hook`, `cw` or `dima`; anything else reads `other`
- ✅ `x stats` reads the traces
  - given a trace dir
  - when `x stats --json --days 30` runs
  - then it prints calls per family and verb, the caller split, p50/p95 per verb, failures by kind, and the verbs with no calls
  - given a day file older than 90 days, then it moves to the macos trash
  - given a terminal, then a plain summary board prints until the `x-stats-board` spec lands
- ✅ `x stats` names the span the traces really cover
  - given traces only for 10-07 and 10-08
  - when `x stats --days 30` runs
  - then `days` reads 2, `first` and `last` name 10-07 and 10-08 — never the window asked for
- ✅ `x stats` leaves dev builds out
  - given trace lines written by a dev build — an x the shim built from `x/go` code that differs from its merge base with `origin/main` (an edit, an untracked file, an unpushed commit), stamped `x.dev`
  - when `x stats` runs, then they are left out of every count, the span included, and `dev` says how many there were
  - when `x stats --dev` runs, then they are counted too
  - decision: dev means x/go differs from its merge base with origin/main, in a worktree or the main checkout — never the `-dirty` version, which main's x carries whenever the frame tree holds any uncommitted file and which hid 73 % of real calls; never «built in a worktree», which would hide a coder's real `x lane` calls; never origin/main itself, which would mark a checkout merely behind main; lines from before the stamp count as real (dima, 2026-10-08)
- ✅ `x stats --outside` ranks what cc runs by hand
  - given cc session transcripts under `~/.claude/projects/`, subagents included
  - when `x stats --outside --days 7` runs
  - then it ranks the top 25 Bash command heads of that window with counts, each call once however many transcripts copy it; `x` calls are left out and counted apart as `x_calls`
  - then a head skips a leading `cd <dir> &&`, a subshell `(`, variable setup (`J=…;`, `S=$(…);`, `export S=…;`, `FOO=1 cmd`) and the wrappers `timeout <n>` and `env …`, so `cd` and `S=` never top the list and the wrapped command ranks; `for` stays its own head; `git`, `claude`, `gh` and `pnpm` count two words (`git log`, `pnpm <script>`); the `lane` shim counts as an `x` call
  - given `--outside --dev`, then it exits 2: cc transcripts hold no dev builds
  - then it prints its own elapsed time — no speed bar; slow over 7 days becomes a ✨ wisp
  - decision: cc transcripts only — dima's own typing is already traced by `x-trace.zsh`; grouping heads into operations is a later round (dima, 2026-10-08)
- ✅ dima's `pnpm <script>` calls are traced too
  - given the zsh hook `home/.config/zsh-custom/x-trace.zsh`
  - when dima types `pnpm <script>` at his prompt
  - then `x trace record` writes the same line shape in the background, with the script's exit and time; an `x` call is not recorded twice
  - then the name is `pnpm <script>` only for a script the nearest `package.json` defines, else plain `pnpm` — a flag's value or free text never becomes a name
  - not traced: a line that does not start with `pnpm` — an env prefix (`FOO=1 pnpm dev`) or a compound (`cd app; pnpm dev`)
  - decision: the hook skips `x` — the dispatcher already traces it as `dima` (cclio, 2026-10-07)
  - decision: only lines that start with `pnpm`; the gap above is known and kept narrow (cclio, 2026-10-07)
