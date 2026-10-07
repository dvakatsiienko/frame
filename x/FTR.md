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
- ✅ bare `x` draws the T2 overview
  - given dima runs bare `x` in a terminal at 80 and at 120 cols
  - when it renders
  - then it matches the T2 dense-family overview ([spread v6](https://claude.ai/artifact/6FSNX9owdhioGuJyeyGZJu)) at both widths: one framed table, a colour per family, the takes column folded under 100 cols
  - decision: the look is picked by the a/b/c in FRM-284 — TS + gum, TS + ink, go + full charm
- ✅ every verb speaks one envelope
  - given any verb run with `--json` or into a pipe
  - when it ends
  - then stdout holds one envelope `{verb, ok, status, data}` and the exit code matches `ok`
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
- ✅ a bare family prints its help
  - given any family, a hidden one (`trace`) included
  - when `x <family>` runs with no verb
  - then it prints that family's verbs, the same as `x <family> --help`; a hidden family still stays out of the overview and completion
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
- ⬜ `x lane merge-main` merges origin/main, stops on a conflict with the file list
- ✅ `x lane unlock` decrypts a worktree's git-crypt files

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

## stats — telemetry

- ✅ every `x` call leaves one trace line
  - makes: a json line in `~/.local/state/x/traces/<local day>.jsonl`
  - given any verb, run by anyone
  - when it exits — ok, usage, refused, external or a panic
  - then the day's file holds one line: the verb, flag names, ids, caller, duration, step times, exit, error kind, x version — never a flag value or free text
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
- ✅ dima's `pnpm <script>` calls are traced too
  - given the zsh hook `home/.config/zsh-custom/x-trace.zsh`
  - when dima types `pnpm <script>` at his prompt
  - then `x trace record` writes the same line shape in the background, with the script's exit and time; an `x` call is not recorded twice
  - then the name is `pnpm <script>` only for a script the nearest `package.json` defines, else plain `pnpm` — a flag's value or free text never becomes a name
  - not traced: a line that does not start with `pnpm` — an env prefix (`FOO=1 pnpm dev`) or a compound (`cd app; pnpm dev`)
  - decision: the hook skips `x` — the dispatcher already traces it as `dima` (cclio, 2026-10-07)
  - decision: only lines that start with `pnpm`; the gap above is known and kept narrow (cclio, 2026-10-07)
