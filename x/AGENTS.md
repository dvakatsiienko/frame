# AGENTS.md: x

`x` — the agent-first cli, in go + charm (`go/`, its build and traps in `go/AGENTS.md`). `bin/x` is the
shim on the PATH: it runs the go binary of the nearest frame tree above the cwd, so a worktree runs its
own edits; anywhere else it runs the checkout the shim lives in. It rebuilds the binary first when a
source file is newer.

## a verb is one registry entry

- an entry in `go/registry.json` drives dispatch, `--help`, `x schema <verb>`, completion and the
  purpose lint — never a second list. a family is the first word of the name (`lane commit` → `lane`);
  the families sit in the same file, their order is their colour.
- the entry holds only what a human writes: name, purpose, args, the verb's own flags, its steps. the
  global flags, the exit codes and the usage line are derived (`go/registry.go`).
- its run binds by name in `impls` (`go/main.go`); a verb in one and not the other fails a test.
- `needsApply: true` for a verb that publishes or destroys: it splits into `Plan` and `Apply`; dispatch
  exits 4 with the exact confirm command until `--apply`, or asks a yes/no on a terminal. three skip it, each guarded by its own check: the `handoff` verbs, the `linear` writes (`linear archive` keeps `--apply`), `lane review`; the reasons, and the shape a new exception needs: `docs/adr/X-0003`.
- a verb that took over a script names it in `replaces:`; `replaces_test.go` stays red while that
  file exists or any tracked file outside history names it. `touches:` names what the verb reads or
  writes outside the repo; `x schema` prints both.
- a failure returns a `*Fail` with `Next`: the command that moves the caller forward.
- the purpose line is what an agent picks a verb by; a test runs `lintPurpose` over every verb.
- `hidden: true` keeps a verb out of the overview, completion and `x stats`' unused list; it still
  dispatches, and its purpose says why it exists (`trace record`, the zsh hook's door).

## trace

- the dispatcher writes one trace line per call at exit (`go/trace.go`); a verb only runs its
  steps through `Run.Step` and returns a `*Fail` — `Refused: true` when x's own check stopped it
  (the **error kind** in `GLOSSARY.md`).
- under `X_TEST` a trace is opt-in (`traceOff`), so no test in any language writes to `~/.local/state/x`;
  a trace test sets `X_TRACE=1` and its own `X_STATE`. a ts test that shells to `x` sets `X_TEST=1`
  on every call, the warm-up build included. the forced panic lives behind the `xpanic` build tag,
  which only the test binary carries.

## keys

- `go/keys.go` is the one place a token comes from; each secret is read where it lives: dima's linear key in 1password (`op read`, the `x-fleet` service account — never `op run`, it masks stdout), the clio/codie oauth pairs and the github app keys in the macos keychain. minted app tokens cache in the keychain, written through `security -i` on stdin so no value reaches argv; dima's key is never cached.
- tests: `X_KEYS` names a json fixture standing in for both stores (`keychain:<service>:<account>` or `op://…` → value); `X_LINEAR_URL` / `X_GITHUB_URL` point the mints, and the `linear` and `gh` reads, at a fake server. under `X_TEST` a missing `X_KEYS` is an error, so no test reads the real keychain.

## verify

the checks sixth sense or codie on `x` starts from.
- a fake of an external cli traces one assertion to its upstream source; a staged-path gate is probed with a `git mv` and a staged delete; an exit-line count is re-counted from `go test -json` passes (FRM-422)
- **a red test whose cause is not in the diff** is stepped through with delve before a print goes in: the headless recipe is `x:guide-go` § delve (no x verb: a one-line recipe fails the admission rule).
- **a «no free text» exit line** is proven against hostile argv, never one example: an unknown `-word`, a bare `-`, words after `--`, free text in an id-named arg, a quoted multi-word arg as zsh `${(z)}` splits it, a flag value equal to a verb name.
- **the zsh hook** is proven in a real `zsh -i` on a pty (python `pty` + a temp `ZDOTDIR`) with another `precmd` registered first, so `$?` reaching the hook is checked — calling `_x_trace_preexec` by hand proves nothing about firing.
- **`x stats`** runs over a planted trace dir under a temp `X_STATE`, with a fake `trash` on `PATH` for the 90-day move.
- a git-crypt worktree builds go with no extra env once `x lane unlock` (or `x lane seed <path>`) ran; a locked tree dies on the vcs stamp (exit 128), which `seed_test.go` reproduces.
- **a port** is proven against the old door run side by side before it dies: twin stores, one verb script through both.
- **every repro in a verdict ran on the verdict's head**, with a fresh temp store or `X_STATE` per probe.
- **a ts test that shells to `x`** resolves the shim beside itself, never `~/frame` (ci set up go after vitest once).
- **a `replaces:` claim** is proven by planting a caller of the old name and watching `replaces_test.go` go red.
- **a secret-shape check** plants every key form it claims: base64 pem, `OPENSSH`, `ghp_`.
- **an actor rule** (tty vs agent) runs in a python pty with and without `CLAUDECODE`.
- **a never-fail path** (a verb a hook runs) runs against a dead-port `X_LINEAR_URL`.
- **a test's adequacy** (base's source, head's tests) restores the old source in a verify tree with `git archive <base> <paths> | tar -x`, since the guard refuses `git checkout <sha> -- <path>` over a tree.

## output

- agent mode (`CLAUDECODE` / `AI_AGENT` set, a pipe, or `--json`): one json envelope on stdout,
  `{ verb, x, ok, status, data | plan | error, next }`; `x` names the source dir that ran.
- tty: the T2 boards (`PRODUCT.md`'s look rule). tool output goes to stderr in both modes.
- `--board` draws the tty board in agent mode too (an agent showing dima a board); `--json` beside it wins.
- exits: 0 ok · 1 failed · 2 usage · 4 needs `--apply`.
- `fixtures/calls.json` is the contract; `go test` runs every call in it, tty ones on a pty.

## lane

- `lane push` from a frame worktree pushes from the main checkout: the pre-push mirror gate reads
  `~` symlinks that point there, so a worktree push always failed. same sha, shared objects.
- `lane commit` refuses while git-crypt files hold ciphertext; `lane unlock` decrypts them. in a real
  frame tree `git-crypt unlock` decrypts by itself; in a fresh fixture it leaves the ciphertext (git
  sees the files as unchanged). so the locked set is read again after it, and each file still locked
  is removed and checked out, only while its raw bytes equal its index blob.
- `lane commit` runs `_clio/script/quote-diff.py HEAD` over staged memory, skill and rules markdown; a gone «» quote refuses unless the message holds `quotes: shown`. the script is clio's, x only calls it
- `lane commit` formats the named paths with the repo's biome before staging — the commit hook only reports, so this is the one place a format writes
- `lane commit` waits out a peer's `index.lock` before its `add` and its `commit`, up to `lockWait` (30 s), and once more on a lock race right after; a lock past the wait fails and stays — the verb never deletes one (`FTR.md`). `X_LOCK_WAIT` shortens the wait under `X_TEST` only
- `lane commit` on main runs the ci jobs for the touched paths after the hold, before the hooks: `go test ./...` per go module a path sits in, the repo's `pnpm typecheck` + `pnpm test` for a `.ts`/`.tsx` unless the installed lefthook pre-commit already runs it (`preCommitRuns`). a pr branch skips them — ci sees it before main does
- `lane merge-auto` calls github as dima's `gh` login (`asDima` in `gh.go`), since the codie app has no `contents: write` and branch protection needs admin; it reads the brake and the patch-ids from the clone it runs in, after a fetch. a stacked pr merges through `PUT /pulls/<n>/merge-async` (the add-on's `stackMerge`), every layer under it gated first
- `lane rebase-main` pushes from the push home `lane push` uses, with `--force-with-lease=refs/heads/<branch>:<read sha>`; its tests land a rival push through a real `post-rewrite` hook, the gap between the rebase and the push
- a test fixture that pushes to a fake `github.com` origin sets `pushInsteadOf` beside `insteadOf`: dima's global gitconfig rewrites https pushes to ssh, and that outranks `insteadOf`
- **two pr modes**: plain prs in core; stacked prs in the add-on (`go/stacks*`, on trial, easy to delete) behind `//go:build !nostacks`, reaching core only via `laneAddOn` (`lane.go`); `go/nostacks-pass.sh` reruns lane tests built out; deleting it is those files and that pass
- `lane push` tries again on a 5xx — curl's `returned error: 5xx` over https, github's `Internal Server Error` over ssh — up to 3 tries; a 4xx or a hook refusal fails on the first

<!-- moved from frame AGENTS.md in the 2026-10-11 sweep -->
- **the by-hand worktree unlock**: a git-crypt repo keeps its key in the main `.git`, never under `.git/worktrees/<n>/`, so a fresh worktree holds ciphertext and **even a pathspec `git add` dies on the clean filter** (the index refresh runs it over every locked file). `EnterWorktree` trees are unlocked by `shelf/hooks/worktree-seed.sh`, and `x lane seed <path>` runs that same hook on a hand-made tree (unlock, mod types and tsconfigs, install); doing it by hand, a `git worktree add` takes `-c filter.git-crypt.smudge=cat -c filter.git-crypt.required=false`, then, inside the tree, `x lane unlock` — the unlock with both filters off (it runs `git status`, which dies on the clean filter), plus the remove + checkout per still-locked file from the `lane commit` line above. a tree still locked: `git -c filter.git-crypt.clean=cat -c filter.git-crypt.required=false add|commit` is safe only after `git hash-object --no-filters <locked file>` equals its `git ls-files -s` blob — same ciphertext, nothing plaintext can be staged

`PRODUCT.md` (the want, what x is not) · `FTR.md` + `GLOSSARY.md` — read your section before changing what x does.
