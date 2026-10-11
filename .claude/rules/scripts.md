---
paths:
  - "script/**"
  - "**/*.ts"
  - "**/*.tsx"
  - "biome.jsonc"
  - "tsconfig*.json"
  - "**/package.json"
  - "pnpm-workspace.yaml"
  - "lefthook.yaml"
  - "Brewfile"
---

# frame scripts, toolchain and hooks

- **`script/lib/manifest.ts`** decides (walks `home/`, derives the expected link set), `frame-link.ts`
  acts — status / apply / untrack, idempotent, refuses to clobber a real file. Never run the
  manifest directly.
- **`macos-setup.ts`** — `brew bundle` against the root `Brewfile`, the macOS defaults this repo
  owns, `duti` bindings, vim-plug. Packages live in the `Brewfile`, never in the script.
- **Scripts are `.ts`, run by node 24 directly** — no `tsx`, no build. `tsconfig.json` sets
  `erasableSyntaxOnly`, which bans any syntax needing real compilation. `pnpm typecheck` checks.
- **`biome.jsonc` stops descending at an excluded directory** — re-including anything under `!**/import` names every ancestor; and probe the real config, never a minimal repro, because `extends` supplies patterns a repro lacks.
- **`pnpm toolchain:sync`** writes `.node-version` (major), `packageManager` and `engines` in frame + bytes from the installed node and pnpm; renovate is told off those pins. run it after any `fnm install` or pnpm bump.
- Anything directly under `script/` is a runnable entrypoint with a matching `pnpm` script;
  `script/lib/` is library code, never invoked directly.
- Formatter and linter is **biome** (`pnpm check`). Git hooks run through **lefthook** — biome on
  staged files plus `pnpm typecheck` and `pnpm test` at commit, both on a temp copy of the index
  (`script/index-run.sh`), `frame-link` at push. Nothing in
  a hook writes to your files.
- **a frame script that spends money is tested from a copy with its spender stubbed** — a test never reaches the real paid api (FRM-352). guard: none

<!--
why here: moved out of frame AGENTS.md in the 2026-10-11 sweep; a frame rule loads on a read, `cat` or edit of a matching file, measured from a session started in cclio/ too (canary, sonnet, 2026-10-11).
-->
