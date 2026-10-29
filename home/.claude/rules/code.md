---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
  - "**/*.cts"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
  - "**/*.go"
  - "**/*.py"
  - "**/*.sh"
  - "**/*.zsh"
  - "**/*.bash"
  - "**/*.swift"
  - "**/*.lua"
  - "**/*.sql"
  - "**/*.graphql"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.html"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.rs"
  - "**/package.json"
  - "**/tsconfig*.json"
  - "**/go.mod"
---

# coding preferences — loaded when code is touched

## general

- **cutting complexity is the work, not a step in it.**
- dead code your change orphans, or in a file you touch, goes; elsewhere it is named in the report
- never spin up a local dev server (e.g. `next dev`) after finishing a task — I do this myself if needed
- **package.json** — exact pins, `npm view` before any version, script order and `family:name` keys: the whole shape is `x:guide-conventions` → `conventions/package-json.md`, read before printing or editing any manifest

## typescript

- `any` is the enemy. inferred types are our friend. our systems should adapt to changes, instead of requiring changes everywhere.
- use `tsc` to catch type errors where the project's TypeScript is healthy (script name varies); skip it for projects with broken TS — their AGENTS.md will say so.
- if your TS code looks like a Python dev wrote it, it is bad TS code.
- avoid one-line functions that are just casting wrappers.

## tests
- tests are good! endless smoke tests, "regression tests" for feature deletions, etc, much less good. tests should be focused, not slop.
- **what earns a test** (vitest's own practice guide): test the contract, never the internals — if a refactor keeps the output and the test breaks, it tested implementation. one behaviour per test, no «and» in a name. mock only what is slow, flaky or side-effecty, never the thing under test. a mechanical migration writes, per mapping, what the failure will print (`assert.ok` → `toBeTruthy` prints nothing useful). **a test is proven by making it fail**: for a test reading a rendered value, delete its input (the stylesheet, the attribute, the variant) and watch it go red.
- **vitest is the runner** in every ts repo (`vitest run`, `tree` reporter locally); a component test runs in browser mode, not jsdom. `node:test` is not used.
- ❌ **tautological tests are disallowed** — testing a constant to have a specific value is not testing - it is creating tech debt upfront.

<!-- failure: five «green» tests shipped hollow in one day because only the pass was ever checked -->

## on a web page

- avoid continuously repainting CSS animations (pulse, shimmer, blur, spinners); they peg the GPU on high-refresh displays. a terminal band cannot load the gpu, so it never needs a frame-rate test.

<!--
why here: moved out of root CLAUDE.md in the 2026-10-11 sweep; a paths: rule loads on a Read, a Bash `cat` or an Edit of a matching file (measured 24/24, opus + sonnet, `recipes/nurture-memory/scripts/paths-probe.sh`; the code rule itself: `code-rule-probe.sh` beside it), so codie gets it on its first code touch and a non-coding session never pays for it.
coverage: the globs list every code extension with files in frame and bytes (git ls-files count, 2026-10-11); a new language adds its glob here.
-->
