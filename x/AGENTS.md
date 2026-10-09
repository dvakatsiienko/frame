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
  exits 4 with the exact confirm command until `--apply`, or asks a yes/no on a terminal.
  the one exception: the `handoff` verbs delete without it — the store is disposable by contract
  (ADR-0002), every removal goes to the macos trash, and the envelope names each file it took.
  the second: the `linear` writes (`body --set`, `set`, `link`, `comment`, `update`) go out in one call —
  the hottest door stays one call, and the stale check, the printed actor and linear's own history guard
  them; `linear archive` destroys from the board's view and keeps `--apply` (FRM-344, dima 2026-10-07)
  the third: `lane review` re-adds the review label without it — it acts only on a stale verdict under
  the cap, which are its own checks, and the coder's «final» runs it as one call (FRM-355)
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

- `go/keys.go` is the one place a token comes from; each secret is read where it lives: dima's linear key in 1password (`op read`, the `x-fleet` service account — never `op run`, it masks stdout), the cclio/coder oauth pairs and the github app keys in the macos keychain. minted app tokens cache in the keychain, written through `security -i` on stdin so no value reaches argv; dima's key is never cached (his word, 2026-10-07).
- tests: `X_KEYS` names a json fixture standing in for both stores (`keychain:<service>:<account>` or `op://…` → value); `X_LINEAR_URL` / `X_GITHUB_URL` point the mints, and the `linear` and `gh` reads, at a fake server. under `X_TEST` a missing `X_KEYS` is an error, so no test reads the real keychain.

## verify

the checks the FRM-340 verifier built by hand; a verifier or coder on `x` starts from these.
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
- **a never-fail path** (`x linear push` in a hook) runs against a dead-port `X_LINEAR_URL`.

## output

- agent mode (`CLAUDECODE` / `AI_AGENT` set, a pipe, or `--json`): one json envelope on stdout,
  `{ verb, x, ok, status, data | plan | error, next }`; `x` names the source dir that ran.
- tty: the T2 boards (`PRODUCT.md`'s look rule). tool output goes to stderr in both modes.
- `--board` draws the tty board in agent mode too (an agent showing dima a board); `--json` beside it wins.
- exits: 0 ok · 1 failed · 2 usage · 4 needs `--apply`.
- `fixtures/calls.json` is the contract; `go test` runs every call in it, tty ones on a pty.

## lane

- `home/.claude/plugin-x/bin/lane` is a shim kept for running coders: it adds `--apply`, because
  the old `lane` published without asking.
- `lane push` from a frame worktree pushes from the main checkout: the pre-push mirror gate reads
  `~` symlinks that point there, so a worktree push always failed. same sha, shared objects.
- `lane commit` refuses while git-crypt files hold ciphertext; `lane unlock` decrypts them. in a real
  frame tree `git-crypt unlock` decrypts by itself; in a fresh fixture it leaves the ciphertext (git
  sees the files as unchanged). so the locked set is read again after it, and each file still locked
  is removed and checked out, only while its raw bytes equal its index blob.
- `lane commit` formats the named paths with the repo's biome before staging — the commit hook only reports, so this is the one place a format writes
- `lane commit` on main runs the ci jobs for the touched paths after the hold, before the hooks: `go test ./...` per go module a path sits in, the repo's `pnpm typecheck` + `pnpm test` for a `.ts`/`.tsx`. a pr branch skips them — ci sees it before main does
- `lane push` tries again on a 5xx — curl's `returned error: 5xx` over https, github's `Internal Server Error` over ssh — up to 3 tries; a 4xx or a hook refusal fails on the first

`PRODUCT.md` (the want, what x is not) · `FTR.md` + `GLOSSARY.md` — read your section before changing what x does.
