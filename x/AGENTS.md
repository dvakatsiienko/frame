# AGENTS.md: x

`x` — the agent-first cli. TS on bun, run from source by `bin/x`, no build step. The shim runs the
`x/main.ts` of the nearest directory above the cwd, so a worktree runs its own edits; anywhere else
it runs the checkout the shim lives in.

## a verb is one registry entry

- an entry (`Verb` in `verb.ts`) drives dispatch, `--help`, `x schema <verb>` and the purpose lint —
  never a second list. a group is the first word of the name (`lane commit` → `lane`).
- `needsApply: true` for a verb that publishes or destroys: without `--apply` it returns its plan and
  exits 4 with the exact confirm command. nothing else asks.
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
- `lane commit` refuses while git-crypt files hold ciphertext; `lane unlock` decrypts them. the
  unlock alone leaves ciphertext in place — git sees the files as unchanged — so each one is
  removed and checked out again, only while its raw bytes equal its index blob.
