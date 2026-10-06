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
