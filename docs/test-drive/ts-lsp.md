# test drive — the TypeScript LSP (native TS 7 server)

on trial 2026-09-30 → 2026-10-14. dima: «set it on … watch it yourself, and measure how useful it
is … pull it into our stack and measure it under a weight for 2 weeks».

## what runs

- plugin `x` → `.lsp.json` → `lsp/typescript-native/` — the community proxy vendored at
  `e54ea9f` (read in full, `VENDORED.md`). it resolves the repo's own TypeScript and runs
  `tsc --lsp --stdio` (TS 7's native server) behind two features: the **diagnostics bridge**
  (pulls a file's errors after each edit and pushes them to claude code) and **document sync**
  (re-reads files changed by shell before every request). `TYPESCRIPT_NATIVE_LSP_DIAGNOSTICS=0` /
  `…_DOCUMENT_SYNC=0` switch either off. the official `typescript-lsp` plugin is disabled, not
  removed: it wraps `tsserver.js`, which TS 7 no longer ships.
- the model gets the deferred `LSP` tool: `hover`, `goToDefinition`, `findReferences`,
  `goToImplementation`, `documentSymbol`, `workspaceSymbol`, call hierarchy. no rename verb.
- the trigger: `x:guide-code` «every use site» — a TS rename or «who uses X» starts with
  `findReferences`.
- the bridge exists because TS 7 answers only pull and claude code listens only for push —
  microsoft/TypeScript#63921 (the gh watch (boot digest)), anthropics/claude-code#40282; it
  switches itself off once either lands. diagnostics arrive one tool call late, and only for files
  claude code edited.
- back to the official plugin (and the vendored copy deleted) when anthropics/claude-plugins-official#4492 lands — parallel
  the gh watch (daily).

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

`python3 docs/test-drive/ts-lsp/usage.py [since]` — LSP calls per session with the operation mix, beside
the grep calls in the same session. read it at every halt; a coder retro names one case where LSP
beat grep or lost to it.

## log

- 2026-09-30 · day 0 · headless session on bytes: `hover` on `AnthropicSVG` → `const AnthropicSVG: (props: TSvgProps) => JSX.Element`; `findReferences` → 2 sites, grep 3 (the third an `export *` re-export — LSP right) · the stock plugin failed at `initialize` (no `tsserver.js`)
- 2026-09-30 · vendored proxy · fresh headless session in a scratch TS 7 project: Write `const count: number = 'three'` → the next tool call carried `Type 'string' is not assignable to type 'number'. [2322]` · negative control with `TYPESCRIPT_NATIVE_LSP_DIAGNOSTICS=0` → NONE — the bridge is what delivers it
