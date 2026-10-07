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
- a failure returns a `*Fail` with `Next`: the command that moves the caller forward.
- the purpose line is what an agent picks a verb by; a test runs `lintPurpose` over every verb.
- `hidden: true` keeps a verb out of the overview, completion and `x stats`' unused list; it still
  dispatches, and its purpose says why it exists (`trace record`, the zsh hook's door).

## trace

- the dispatcher writes one trace line per call at exit (`go/trace.go`); a verb only runs its
  steps through `Run.Step` and returns a `*Fail` — `Refused: true` when x's own check stopped it
  (the **error kind** in `GLOSSARY.md`).
- tests run with `X_TRACE=0` (`cleanEnv`), so no test writes to `~/.local/state/x`; a trace test
  sets `X_TRACE=1` and its own `X_STATE`. the forced panic lives behind the `xpanic` build tag,
  which only the test binary carries.

## verify

the checks the FRM-340 verifier built by hand; a verifier or coder on `x` starts from these.
- **a «no free text» exit line** is proven against hostile argv, never one example: an unknown `-word`, a bare `-`, words after `--`, free text in an id-named arg, a quoted multi-word arg as zsh `${(z)}` splits it, a flag value equal to a verb name.
- **the zsh hook** is proven in a real `zsh -i` on a pty (python `pty` + a temp `ZDOTDIR`) with another `precmd` registered first, so `$?` reaching the hook is checked — calling `_x_trace_preexec` by hand proves nothing about firing.
- **`x stats`** runs over a planted trace dir under a temp `X_STATE`, with a fake `trash` on `PATH` for the 90-day move.
- in a git-crypt worktree, go builds need `GOFLAGS=-buildvcs=false` until the test-hygiene ticket lands.

## output

- agent mode (`CLAUDECODE` / `AI_AGENT` set, a pipe, or `--json`): one json envelope on stdout,
  `{ verb, x, ok, status, data | plan | error, next }`; `x` names the source dir that ran.
- tty: the T2 boards (`PRODUCT.md`'s look rule). tool output goes to stderr in both modes.
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

`PRODUCT.md` (the want, what x is not) · `FTR.md` + `GLOSSARY.md` — read your section before changing what x does.
