---
paths:
  - "**/biome.json"
  - "**/biome.jsonc"
  - "**/biome-config-polished/**"
---

# biome config — the shared preset first

frame and bytes both extend `biome-config-polished` (npm; source in `~/projects/bytes/packages/biome-config-polished/config.jsonc`). before a change to a repo's `biome.jsonc`, ask: would the other repo want it too? (dima, 2026-10-28: «instead of overriding, first consider whether a change is better done to the root linter config»)

- shared (a rule, a formatter switch, a class of files every repo excludes) → edit the preset, never a repo override
- repo-only (its own paths, its own vendored dirs, an override for a folder only it has) → the repo's `biome.jsonc`
- a preset change ships in four steps:
  1. bump `version` in the preset's `package.json`; commit in bytes (bytes reads it as `workspace:*`, live)
  2. prove it in frame before the publish: frame's `biome check --max-diagnostics=500 .` against the local preset adds no error
  3. publish: `cd ~/projects/bytes/packages/biome-config-polished && ~/frame/script/op-run.sh npm publish --userconfig <npmrc>`, the npmrc holding `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` (`npm-golden` in 1Password, expires 2027-01-26)
  4. frame: bump `biome-config-polished` in `package.json`, `pnpm install`, drop the lines the preset now carries
- a rename or a removed rule is checked against the biome version both repos pin (`pnpm exec biome --version`), never `npx biome`, which can resolve another version
