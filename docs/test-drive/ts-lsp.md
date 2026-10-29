---
status: live
until: 2026-11-03
fits: coder:ts
---

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
- a frame script (`script/*.ts`, cwd `~/frame/_clio`) — the launcher's walk-up from a subdir
- cost: the server's memory on bytes (`ps -o rss` on the `tsc --lsp` pid) and its start time

## measure

`python3 docs/test-drive/ts-lsp/usage.py [since]` — LSP calls per session with the operation mix, beside
the grep calls in the same session. read it at every halt; a coder retro names one case where LSP
beat grep or lost to it.

## log

- 2026-09-30 · day 0 · headless session on bytes: `hover` on `AnthropicSVG` → `const AnthropicSVG: (props: TSvgProps) => JSX.Element`; `findReferences` → 2 sites, grep 3 (the third an `export *` re-export — LSP right) · the stock plugin failed at `initialize` (no `tsserver.js`)
- 2026-09-30 · vendored proxy · fresh headless session in a scratch TS 7 project: Write `const count: number = 'three'` → the next tool call carried `Type 'string' is not assignable to type 'number'. [2322]` · negative control with `TYPESCRIPT_NATIVE_LSP_DIAGNOSTICS=0` → NONE — the bridge is what delivers it
- 2026-09-30 · first real round, a fresh opus agent on the chords + speak drift check · 3 calls (usage.py agrees): `documentSymbol` on `sources.ts` paid (the list in one call, rg would too), `findReferences` on `scope` paid (5 refs proved no scoped row), `documentSymbol` on `StateBadge.tsx` half (the bug sat in a regex body) · reach: a markdown↔code and swift job, where LSP answers neither side · diagnostics bridge not exercised (read-only job, no edits)
- 2026-10-25 · FRM-411 coder: the `LSP` tool used once on a jotai 3 + @types/react lift; the edit hook's diagnostics did the job and no type error needed chasing — the coder's read: drop it for dependency bumps

## the reminder, moved here (2026-10-11, o139)

⏰ 🔬 ts-lsp test drive, two weeks to 2026-10-16 — the native TS 7 server through plugin `x` (`.lsp.json` → `bin/ts-lsp`); walk the stress list in `docs/test-drive/ts-lsp.md`, read `python3 docs/test-drive/ts-lsp/usage.py` at every halt (LSP calls beside grep calls per session), one line per round in its log. on 10-16: keep (and sharpen the `x:guide-code` «every use site» line) or drop the entry. dima 2026-09-30: «measure it under a weight for 2 weeks» — set 2026-09-30
- 2026-10-15 20:46 · usage count (siesta freebie, helper-lite over 1,285 transcripts since 10-01) · **0 LSP calls** since 10-01; all-time 6 (hover 2, findReferences 2, documentSymbol 2), the last 2026-09-30 · the diagnostics bridge's value is not in that count (it pushes errors without a call) — the verdict tomorrow weighs the bridge, not the tool
- 2026-10-15 20:50 · dima's steer (o99): the use-site rule moved from guide-code to guide-typescript, where a TS session loads it · the «only Go lately» reading checked: since 10-01 git touched 1,562 .ts/.tsx paths in frame (+40 bytes) against 207 .go — TS work was plenty, the tool still drew 0 calls; the next round asks why (the trigger sat in guide-code, which fires before the TS guide)
- 2026-10-16 14:17 · verdict round · **the bridge paid for real**: cclio's Write of a new `schedule/jobs/x-cc-otel/server.ts` came back with 9 diagnostics (no node types, implicit any) one call later — the tell that the dir sat in no tsconfig; `schedule/jobs/*/*.ts` joined frame's include, `--listFilesOnly` proved it (the fleet-hazards «green typecheck, unconfigured files» trap, caught by the bridge, not a planted error) · the `LSP` tool: still 0 calls; the guide-typescript placement is 1 day old and today's renames were strings, not identifiers · ask: adopt the bridge, extend the tool once to 10-30

## verdict

- 2026-10-16 · **the diagnostics bridge: adopted** (dima's tick, o6) — it caught a new dir outside frame's tsconfig on its first real write · **the `LSP` tool: extended once to 10-30** — 0 calls in 15 days; its trigger moved into guide-typescript on 10-15, and two weeks decide it; a second extension needs a new test card
