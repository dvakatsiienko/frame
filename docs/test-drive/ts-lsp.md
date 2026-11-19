---
status: live
until: 2026-11-22
fits: codie:ts
---

# test drive — the TypeScript LSP (native TS 7 server)

**test card:** we believe the `LSP` tool answers «who uses X» and «what type is this» with fewer misses and less context than grep and a file read · we test it by every TS rename and use-site question in a coder's work · we measure `usage.py` calls beside grep calls, per session and per subagent, and one retro case per lane where it won or lost · we're right if it is reached on its own, at least weekly, and a retro names a win
**kill rule:** 0 calls over a month of TS work: its trigger comes out; the diagnostics bridge, adopted, stays

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
  microsoft/TypeScript#63921, anthropics/claude-code#40282, both on x-changedetector; it
  switches itself off once either lands. diagnostics arrive one tool call late, and only for files
  claude code edited.
- back to the official plugin (and the vendored copy deleted) when anthropics/claude-plugins-official#4492 lands, on x-changedetector too.

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
the grep calls in the same session. read it at every halt; a codie retro names one case where LSP
beat grep or lost to it.

## log

- 2026-09-30 · day 0 · headless session on bytes: `hover` on `AnthropicSVG` → `const AnthropicSVG: (props: TSvgProps) => JSX.Element`; `findReferences` → 2 sites, grep 3 (the third an `export *` re-export — LSP right) · the stock plugin failed at `initialize` (no `tsserver.js`)
- 2026-09-30 · vendored proxy · fresh headless session in a scratch TS 7 project: Write `const count: number = 'three'` → the next tool call carried `Type 'string' is not assignable to type 'number'. [2322]` · negative control with `TYPESCRIPT_NATIVE_LSP_DIAGNOSTICS=0` → NONE — the bridge is what delivers it
- 2026-09-30 · first real round, a fresh opus agent on the chords + speak drift check · 3 calls (usage.py agrees): `documentSymbol` on `sources.ts` paid (the list in one call, rg would too), `findReferences` on `scope` paid (5 refs proved no scoped row), `documentSymbol` on `StateBadge.tsx` half (the bug sat in a regex body) · reach: a markdown↔code and swift job, where LSP answers neither side · diagnostics bridge not exercised (read-only job, no edits)
- 2026-10-25 · FRM-411 coder: the `LSP` tool used once on a jotai 3 + @types/react lift; the edit hook's diagnostics did the job and no type error needed chasing — the coder's read: drop it for dependency bumps
- 2026-11-06 · frm-517 codie · not used, a new module had no callers to chase
- 2026-11-06 · frm-514 codie · not used, no shared symbol to rename in a test file; said so rather than counted
- 2026-11-12 · wing 1, a real ask for FRM-579 (every reader of x-mod-stash's `isWing`): `findReferences` 5 sites in 1 call, `rg -n '\bisWing\b'` the same 5 · tie on a single-file symbol; the touch also printed 5 false TS5097 errors (`.ts` import extensions) because the server misses the mod's own tsconfig, so its diagnostics on mod files are noise
- 2026-11-12 · wing 1, the extension's count at its end date · 3 `LSP` tool calls in 1,360 transcripts touched since 11-04 (grep `"name":"LSP","input"` over `~/.claude/projects`) · the verdict is due today, his call
- 2026-11-12 · dima's steer, the third extension, to 11-19: «push the reminder +7 days, still no time to revisit this ts-lsp» (o41)
- 2026-11-19 · FRM-656 mods codie, the move of the round count out of `register.tsx` · not used for the move itself: 3 functions with one caller each, `grep -n` named every site; a miss of the brief's trial, said so
- 2026-11-19 · FRM-656 mods codie · `findReferences` on `roundTaken` (`rounds.ts`): 10 sites in 3 files, `rg -n roundTaken` the same 10 · tie; the first call at the line above the name answered «no references», so the position must sit on the name · useful: n (grep was as fast) · the touch printed false TS5097 and «cannot find module» errors on scratch copies, the same noise as 11-12
- 2026-11-19 · FRM-659 herdr codie, the probe on a herdr mod's `.js` · `findReferences` on x-herdr-chat `main.js`'s `file`, `pid`, `reader` fields → 15, 10, 9 sites through the mod's jsconfig.json; `grep 'this\.file\b'` the same 14 plus the declaration · tie on hits, LSP gave exact columns and no `this.files` risk; context saved: none on a one-file symbol · useful: y, it answers on JSDoc-typed JS
- 2026-11-19 · FRM-659 herdr codie · `goToDefinition` on `savePress` in x-herdr-deck `main.js` → `orbit.js:340` in 1 call, where `grep 'function savePress'` found nothing (it is a `const` arrow) · LSP won · useful: y
- 2026-11-19 · FRM-659 herdr codie, the dead-code proof · `findReferences` on `contrast.js` and `lists.js` exports → only their own file; `grep -rn` also found each one's `.test.ts` importer, which the LSP misses because the mod's jsconfig includes only `*.js` · LSP's «0 callers» is right for the shipped code, wrong as a delete proof; grep stays the check beside it · useful: half
- 2026-11-19 · FRM-659 herdr codie, the verdict · 7 LSP calls (6 `findReferences`, 1 `goToDefinition`) beside ~40 greps over a 4,381-line split · **wire it** for herdr mods: on JSDoc `.js` through the mod's jsconfig it answered exactly every time, and it won once outright (a `const` arrow grep missed) · its blind spot there is the `.test.ts` files no jsconfig includes, so a «no callers» before a delete keeps a grep beside it; the line belongs in the herdr mods AGENTS.md loop
- 2026-11-19 · FRM-656 mods sixth sense · findReferences on roundLine and capLine (parse.ts), a new positional param before untold → 7 and 5 sites, every register.tsx caller in the new order; 1 call each · LSP won on a positional-param question · useful: y
- 2026-11-19 · FRM-662 mods codie, the register.tsx design map (6 fork readers over 11,517 lines) · 28 `findReferences` calls on the live repo file · LSP won on common words: `orbit` 22 refs vs 163 grep hits, `registry` 20 vs 48, `field` 16 vs 38, `isAutoWind` 4 vs 8 (grep counted a `view.isAutoWind` property); it named each `keepShelf` caller's enclosing function, told a same-named test helper `herdrRows` apart, proved the dead exports `glideOp` and `mergeLanes`; 10 ties · on the live repo file the mod's tsconfig loads, so no false TS5097 there (the noise is only on scratch copies) · useful: y, the map's one-owner-per-state lines rest on its exact sites
- 2026-11-19 · FRM-659 herdr sixth sense · `hover` on `on_item_click` in x-herdr-chat `message-list.js`: in the verify worktree `any` plus «cannot find module 'herdr' / 'gpui-kit'», since the mod's jsconfig `paths` climbs 6 dirs to `~/.config/herdr-app` and a tree under `.claude/worktrees/<name>/` sits 3 deeper; the same hover in the main checkout returned the full doc · LSP blind in every worktree on a herdr mod, grep over herdr's `.d.ts` answered · useful: y in main, n in a tree
- 2026-11-19 · FRM-659 herdr sixth sense, round 2 · the same `hover` in the verify tree at 4aebc0c9, after the jsconfig `paths` went absolute (ff43e6e1): herdr's full `on_item_click` doc · the tree blind spot is closed; the trial's one sixth-sense finding turned into a fix · useful: y
- 2026-11-19 · FRM-664 herdr codie, removing x-herdr-agents' `dnd()` · `findReferences` on `dnd` → 3 sites (its definition, the agent row, the space header) and on `this.drag` → 8, all inside `dnd`/`endDrag`; `grep -n` the same · tie, but it proved no caller outside the block before the delete
- 2026-11-19 · clio's side, the mid-day count (14:33 → 17:20, the `LSP` tool vs grep: the Grep tool plus `rg`/`grep` in Bash, a rough count from each session's transcript) · herdr codie 10 vs 366, mods codie 21 vs 226, mods sixth sense 2 vs 34, herdr sixth sense 3 vs 78, stray 0 vs 118, clio 0 vs 87 · the codies reach for it on a symbol question and grep for the rest; clio's own reads are spec premises, which go to wisphunter cards, so clio's 0 is its tool calls only · against 4 Nov's 0 LSP / 20,115 grep, today is the first day it is reached for at all
- 2026-11-19 · stray batch 6 (FRM-660, FRM-572, FRM-631) · the one TypeScript touch, x-mod-guard's `git branch -D` door string in `floor.ts`, asked no reference question; the Go side's `findReferences` on `onMain` and `mergedLaneBranchNote` answered «No LSP server available for file type: .go», so every Go caller came from `grep -n` · useful: n/a (no ts ask); a Go server is the gap

## the reminder, moved here (2026-10-11, o139)

⏰ 🔬 ts-lsp test drive, two weeks to 2026-10-16 — the native TS 7 server through plugin `x` (`.lsp.json` → `bin/ts-lsp`); walk the stress list in `docs/test-drive/ts-lsp.md`, read `python3 docs/test-drive/ts-lsp/usage.py` at every halt (LSP calls beside grep calls per session), one line per round in its log. on 10-16: keep (and sharpen the `x:guide-code` «every use site» line) or drop the entry. dima 2026-09-30: «measure it under a weight for 2 weeks» — set 2026-09-30
- 2026-10-15 20:46 · usage count (siesta freebie, helper-lite over 1,285 transcripts since 10-01) · **0 LSP calls** since 10-01; all-time 6 (hover 2, findReferences 2, documentSymbol 2), the last 2026-09-30 · the diagnostics bridge's value is not in that count (it pushes errors without a call) — the verdict tomorrow weighs the bridge, not the tool
- 2026-10-15 20:50 · dima's steer (o99): the use-site rule moved from guide-code to guide-typescript, where a TS session loads it · the «only Go lately» reading checked: since 10-01 git touched 1,562 .ts/.tsx paths in frame (+40 bytes) against 207 .go — TS work was plenty, the tool still drew 0 calls; the next round asks why (the trigger sat in guide-code, which fires before the TS guide)
- 2026-10-16 14:17 · verdict round · **the bridge paid for real**: cclio's Write of a new `schedule/jobs/x-cc-otel/server.ts` came back with 9 diagnostics (no node types, implicit any) one call later — the tell that the dir sat in no tsconfig; `schedule/jobs/*/*.ts` joined frame's include, `--listFilesOnly` proved it (the fleet-hazards «green typecheck, unconfigured files» trap, caught by the bridge, not a planted error) · the `LSP` tool: still 0 calls; the guide-typescript placement is 1 day old and today's renames were strings, not identifiers · ask: adopt the bridge, extend the tool once to 10-30

- 2026-11-04 · the second reading of the `LSP` tool · `usage.py 2026-10-16`: 119 main sessions, **0 LSP calls**, 20,115 grep calls · it counts main threads only, so 916 subagent transcripts were read too: `tool_use` named LSP in 0 (161 mention it only in a tool schema), `wisphunter` and `scout` included, which both carry the tool · the guide-typescript placement had 19 days and changed nothing
- 2026-11-04 · dima's false-negative check: since 10-16 git touched 1,487 ts paths (824 of them mods) against 233 go, so the 0 calls sat on plenty of TS; the bridge's diagnostics reached 80 transcripts in 14 days
- 2026-11-04 · dima's steer, the second extension, to 11-11 under the test card above: keep both, the marketplace plugin and our patch («Keep the test drive and move it 1 week further»), since he reads recent TS activity as too low to judge and more is coming soon

## verdict

- 2026-10-16 · **the diagnostics bridge: adopted** (dima's tick, o6) — it caught a new dir outside frame's tsconfig on its first real write · **the `LSP` tool: extended once to 10-30** — 0 calls in 15 days; its trigger moved into guide-typescript on 10-15, and two weeks decide it; a second extension needs a new test card
