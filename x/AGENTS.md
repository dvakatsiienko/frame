# AGENTS.md: x

`x` — the agent-first cli. TS on bun, run from source by `bin/x`, no build step. The shim runs the
`x/main.ts` of the nearest directory above the cwd, so a worktree runs its own edits; anywhere else
it runs the checkout the shim lives in.

## a verb is one registry entry

- an entry (`Verb` in `verb.ts`) drives dispatch, `--help`, `x schema <verb>` and the purpose lint —
  never a second list. a group is the first word of the name (`lane commit` → `lane`).
- `needsApply: true` for a verb that publishes or destroys, with a `plan(args)`: dispatch calls the
  plan and exits 4 with the exact confirm command until `--apply`; `run` never checks the flag.
  nothing else asks.
- a verb's own flags sit in its entry's `flags`, beside the global ones; `run` gets them parsed.
- a failure throws `Fail(message, next)`: `next` is the command that moves the caller forward.
- the purpose line is what an agent picks a verb by; `x.test.ts` runs `lintPurpose` over every verb.
- verbs use node apis only (`node:child_process`, `node:util`), never `Bun.*`, so vitest runs the
  same code under node.

## output

- agent mode (`CLAUDECODE` / `AI_AGENT` set, a pipe, or `--json`): one json envelope on stdout,
  `{ verb, x, ok, status, data | plan | error, next }`; `x` names the source dir that ran.
- tty: plain lines, dim/bold only. progress and hook output go to stderr in both modes.
- exits: 0 ok · 1 failed · 2 usage · 4 needs `--apply`.

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
