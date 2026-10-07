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
- ⬜ a bare family prints its help
  - given any family, a hidden one (`trace`) included
  - when `x <family>` runs with no verb
  - then it prints that family's verbs, the same as `x <family> --help`; a hidden family still stays out of the overview and completion
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
  - then it lists the same handoffs `x-cw`'s tools see — one store, two doors
- ⬜ `x handoff write` saves a CST
  - makes: `~/.claude/shelf/handoffs/<for>--<lane>--<topic>--by-<author>--<utc-ts>[-shared].md`, mode 600
  - given a CST on stdin and `--slug`
  - when `x handoff write --audience <a> --slug <s> --lane <l> --author <who>` runs
  - then one file lands under that name; an empty stdin or no slug is exit 2 and writes nothing
- ⬜ `x handoff write --replaces` folds a thread into one file
  - given a pending handoff of the same thread
  - when `write --replaces <slug>` runs
  - then the sibling is gone, the new file stands alone and inherits its `-shared`; a slug matching nothing is exit 2 and writes nothing
- ⬜ `x handoff delete` removes one CST or all of them
  - given pending handoffs, shared ones among them
  - when `x handoff delete <slug>` or `x handoff delete --all` runs
  - then that one file, or every file, goes to the macos trash; a bare `delete` is exit 2 and touches nothing
  - decision: no `--apply` — the store is disposable by contract (ADR-0002), and the envelope names what went
- ⬜ every handoff caller goes through `x handoff`
  - given the two plugin-x handoff skills, `CST-SPEC.md`, the `x-cw` handoff tools and the x-ray raycast command
  - when they list, peek, ingest, write or delete
  - then each one calls `x handoff … --json`; the node store script is gone
  - decision: the raycast command keeps its name `handoffs`, its icon and its hotkey — dima's binding (cclio, 2026-10-07)
- ✅ `x handoff list` paints in under 20 ms
  - given the live store
  - when dima runs `x handoff list` in a terminal
  - then the board is drawn in under 20 ms (median of 40), node never starts
  - decision: go reads the store itself; the node bridge cost 60 of 72 ms. both readers test `script/lib/handoff-names.json` (ADR 0002, amended)
- ✅ a CST's run id reads its value
  - given a META line `**run marker** — run id: **cc·x**`
  - when `x handoff list` shows it
  - then the run id column says `cc·x`
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
