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

- **`script/lib/manifest.ts`** decides the link set, `frame-link.ts` acts on it and refuses to clobber a real file; never run the manifest directly. `pnpm frame:link apply` never prunes a dangling old symlink after a rename.
- **`macos-setup.ts`** runs `brew bundle` against the root `Brewfile`, the macOS defaults this repo owns, `duti` bindings, vim-plug. Packages live in the `Brewfile`, never in the script.
- **scripts are `.ts`, run by node 24 directly** — no `tsx`, no build; `erasableSyntaxOnly` bans syntax that needs compiling.
- **`biome.jsonc` stops descending at an excluded directory** — re-including anything under `!**/import` names every ancestor; probe the real config, never a minimal repro, because `extends` supplies patterns a repro lacks.
- **`pnpm toolchain:sync`** after any `fnm install` or pnpm bump: it writes `.node-version` (major), `packageManager` and `engines` in frame + bytes; renovate is told off those pins.
- a file directly under `script/` is a runnable entrypoint with a matching `pnpm` script; `script/lib/` is library code.
- **the commit hook writes nothing**: biome checks the staged files, typecheck and test run on a private copy holding only the commit (`script/index-run.sh`), `frame-link` runs at push.
- **a frame script that spends money is tested from a copy with its spender stubbed** — a test never reaches the real paid api (FRM-352). guard: none

<!--
why here: moved out of frame AGENTS.md in the 2026-10-11 sweep; a frame rule loads on a read, `cat` or edit of a matching file, measured from a session started in _clio/ too (canary, sonnet, 2026-10-11).
-->
