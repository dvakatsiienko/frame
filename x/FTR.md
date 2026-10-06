# x — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## x — the overview

- 🧭 `x` on the PATH runs the go binary of the nearest frame tree
  - given a cwd inside a frame tree (main or a worktree), or anywhere else
  - when `x` runs
  - then that tree's `x/go/bin/x` runs, or the checkout the shim lives in when no tree is above the cwd
  - given a go source file newer than the binary, then the shim rebuilds it first, and a failed build runs the last binary with one stderr line
  - decision: go + charm, picked on the FRM-284 look probe (2026-10-06); the TS arm and its bun shim retire
- 🧭 bare `x` draws the T2 overview
  - given dima runs bare `x` in a terminal at 80 and at 120 cols
  - when it renders
  - then it matches the T2 dense-family overview ([spread v6](https://claude.ai/artifact/6FSNX9owdhioGuJyeyGZJu)) at both widths: one framed table, a colour per family, the takes column folded under 100 cols
  - decision: the look is picked by the a/b/c in FRM-284 — TS + gum, TS + ink, go + full charm
- 🧭 every verb speaks one envelope
  - given any verb run with `--json` or into a pipe
  - when it ends
  - then stdout holds one envelope `{verb, ok, status, data}` and the exit code matches `ok`
- 🧭 a wrong verb names the right ones
  - given an unknown verb or flag
  - when it fails
  - then the error lists the valid verbs or flags of that family
- ⬜ `x schema` prints a verb's schema — the same entry that dispatches it
- 🧭 zsh completes every verb, flag and value
  - given `source <(x completion zsh)` in zsh
  - when dima presses Tab after `x`, a family, a verb or a flag
  - then zsh offers the families, the verbs, the flags, and each value from where it lives: pending slugs, shelf names, probe names, models, audiences, `.md` briefs, `.json` settings, dirs for `--repo`
  - decision: the completers are keyed by the registry's arg and flag names, so a new verb that reuses a name completes with no edit
- 🧭 `x schema` at two detail levels
  - given a verb or a family name
  - when `x schema` runs with the short level
  - then it prints names and one-line purposes only; the full level prints the whole schema

## the resident index

- 🧭 a session boots knowing every verb
  - makes: the verb index (name + purpose) in the session's context, printed by a SessionStart hook
  - given a fresh cc session
  - when it boots
  - then its context holds the index, and no `x` call was needed to learn it
- 🧭 a new verb reaches the index by itself
  - given a new verb lands in the registry
  - when the next session boots
  - then the index shows it, with no hand edit anywhere

## lane — git

- ⬜ `x lane commit` commits only the named paths and prints the new sha
- ✅ `x lane commit` refuses a mod that fails `claude plugin validate`
  - given a named path sits under `home/.claude/plugin-x/mods/<mod>/`
  - when `claude plugin validate` on that mod's dir fails
  - then the commit is refused with the validator's output, nothing is staged, and HEAD does not move
  - given the validate passes, then the commit goes through as before
  - decision: in the commit verb, not a lefthook job — a mod round chained `validate && commit` by hand and still committed past a red (FRM-307's first commit, 2026-10-05)
- 🧭 `x lane commit --hold-unstaged` keeps other work out of the hooks
  - given unstaged edits and untracked files outside the named paths
  - when `x lane commit --hold-unstaged <msg-file> -- <paths>` runs
  - then the hooks see only the index version of the tree, the commit lands, and every held file is back byte for byte — also when a hook refuses
  - decision: the files move into the git dir, never the shared stash stack another session could pop
- ⬜ `x lane push` pushes HEAD's sha and reads the remote back
- ⬜ `x lane pr-open` opens a pr as the coder app
- ⬜ `x lane merge-main` merges origin/main, stops on a conflict with the file list
- ⬜ `x lane unlock` decrypts a worktree's git-crypt files

## handoffs

- 🧭 `x handoffs` lists, peeks and ingests CSTs from the shared store
  - given a pending handoff in the store
  - when `x handoffs list` runs
  - then it lists the same handoffs `x-cw`'s tools see — one store, two doors
- 🧭 `x handoffs list` paints in under 20 ms
  - given the live store
  - when dima runs `x handoffs list` in a terminal
  - then the board is drawn in under 20 ms (median of 40), node never starts
  - decision: go reads the store itself; the node bridge cost 60 of 72 ms. both readers test `script/lib/handoff-names.json` (ADR 0002, amended)
- 🧭 a CST's run id reads its value
  - given a META line `**run marker** — run id: **cc·x**`
  - when `x handoffs list` shows it
  - then the run id column says `cc·x`
- 🧭 a cloud thread reaches handoffs through the mac
  - given a cloud project thread
  - when it runs `~/.local/bin/x handoffs list` through the remote-devices Desktop Commander
  - then it gets the same envelope as on the mac

## brief

- 🧭 `x brief check` refuses a brief that names what is not there
  - makes: a stamp `~/.local/state/x/briefs/<sha256>.json` on a pass
  - given a brief whose backticks name a path, a `pnpm` script or an `x` verb the repo lacks, or a ticket id linear cannot find
  - when `x brief check <brief> --repo <path>` runs
  - then it fails and names each one with its line; a thing the brief asks to build passes when `(new)` follows it
- 🧭 `x brief check` lints the exit lines
  - given a rate with no n, an exit line with no surface, an exit line into `cclio/`, a relayed approval with no time, or jev with no budget
  - when it runs
  - then each finding names its line and the rule

## probe

- 🧭 `x probe bare` asks claude with none of our setup
  - given a prompt
  - when `x probe bare '<prompt>'` runs
  - then `claude -p --safe-mode --strict-mcp-config --no-session-persistence` answers from a temp dir, haiku by default, and the board shows the answer as markdown with its cost
- 🧭 `x probe session` keeps a named probe across calls
  - makes: `~/.local/state/x/probes/<name>/` with the session id
  - given a name and a settings json
  - when it runs twice with the same name
  - then the second call resumes the first session

## knowledge

- 🧭 `x knowledge list` shows the shelf with its stamps
  - given `docs/knowledge/`
  - when it runs
  - then each file shows its title and its verified date, and a file with none says unstamped
- 🧭 `x knowledge read` prints one file and logs the read
  - makes: a line in `~/.local/state/x/knowledge-reads.jsonl`
  - given a word of a file name
  - when it runs
  - then the file renders as markdown; a word matching several files lists them
