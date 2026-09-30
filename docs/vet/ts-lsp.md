# vet — the TypeScript LSP (native TS 7 server)

on trial 2026-09-30 → 2026-10-14. dima: «set it on … watch it yourself, and measure how useful it
is … pull it into our stack and measure it under a weight for 2 weeks».

## what runs

- plugin `x` → `.lsp.json` → `bin/ts-lsp`: walks up from the project to the repo's own
  `node_modules/.bin/tsc` and runs `tsc --lsp --stdio` (TS 7's native server), so the LSP and
  the typecheck gate are one TypeScript. the official `typescript-lsp` plugin is disabled, not
  removed: it wraps `tsserver.js`, which TS 7 no longer ships.
- the model gets the deferred `LSP` tool: `hover`, `goToDefinition`, `findReferences`,
  `goToImplementation`, `documentSymbol`, `workspaceSymbol`, call hierarchy. no rename verb.
- the trigger: `x:guide-code` «every use site» — a TS rename or «who uses X» starts with
  `findReferences`.
- known gaps: no diagnostics after an edit (TS 7 answers only pull, claude code listens only for
  push — microsoft/TypeScript#63921, anthropics/claude-code#40282); a file changed by shell after
  claude code opened it goes stale for the server (anthropics/claude-code#76870).
- back to the official plugin when anthropics/claude-plugins-official#4492 lands — parallel
  monitor `6cf348bc` (daily).

## stress list — one real ask each

- `findReferences` before a rename in bytes — sites found vs grep hits, misses and false hits
- `hover` instead of reading a file for one type — chars in context saved
- `goToDefinition` across packages (a `@bytes/*` import) — does it land in source or in `dist/*.d.ts`
- `workspaceSymbol` to find where a name is defined in an unfamiliar app
- incoming calls on a hook or util before changing its signature
- a worktree session (`.claude/worktrees/*`) — does the server resolve the tree's own files
- a frame script (`script/*.ts`, cwd `~/frame/cclio`) — the launcher's walk-up from a subdir
- cost: the server's memory on bytes (`ps -o rss` on the `tsc --lsp` pid) and its start time

## measure

`python3 docs/vet/ts-lsp/usage.py [since]` — LSP calls per session with the operation mix, beside
the grep calls in the same session. read it at every halt; a coder retro names one case where LSP
beat grep or lost to it.

## log

- 2026-09-30 · day 0 · headless session on bytes: `hover` on `AnthropicSVG` → `const AnthropicSVG: (props: TSvgProps) => JSX.Element`; `findReferences` → 2 sites, grep 3 (the third an `export *` re-export — LSP right) · the stock plugin failed at `initialize` (no `tsserver.js`)
