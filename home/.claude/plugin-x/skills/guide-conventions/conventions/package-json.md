# package.json — one shape, every manifest

Root fields sit most-touched first, the `scripts` block reads top to bottom as the engineering
loop, keys are named by family, and versions are exact. Same shape in every package.json Dima owns; an agent printing or editing one
sorts and names it into this.

## the root — most-touched first, least-touched last

1. **identity** — `name`, `version`, `author`, `description`, `private`, `type`, and the other descriptive fields
2. `scripts`
3. `dependencies`
4. `devDependencies`
5. `peerDependencies`
6. **tech** — `engines`, `devEngines`, `packageManager`, `pnpm`, `browserslist`, the rest that rarely changes — the newer, more modern field first, the older after (bytes' `package-json-shape` gate enforces this order)

A manifest reads naturally: what you open it for sits on top, what you set once sits at the
bottom. Printed randomly, `scripts` lands under `devEngines` and the reader scrolls for the
thing they came for — Dima re-sorts those by hand.

## the scripts — sections, in this sequence

1. **dev** — `dev`, `dev:*` — starts servers of every kind; the loop begins here
2. **build** — `build`, `build:*`, `preview` — the produce step of dev activity
3. **prod infra + helpers** — data-store and deploy shortcuts: `db:studio` (short is fine:
   `db:so`), `db:migrate`, `db:seed`, domain clis like `trophies`
4. **intermediary** — scripts with no clear home; keep this zone small
5. **repo service** — `lint`, `typecheck`, `test`, `check`, `format` — last

Within a section the bare name leads (`build`), then its `:` variants (`build:api`, `build:web`).

✅ the reference shape, bytes `apps/trophy-sys/package.json` (commit `e88969bc`):

```json
"dev": …, "dev:api": …, "dev:web": …,
"build": …, "build:api": …, "build:web": …, "preview": …,
"trophies": …,
"lint": …, "typecheck": …
```

🚫 alphabetical. It reads `build` before `dev` and scatters `lint` between domain scripts —
Dima re-sorted trophy-sys by hand after an alphabetical print.

A prisma project carries at least a studio shortcut in section 3; a manifest without one is
incomplete, not minimal.

## the names — `<family>:<name>`, the family is the entity

`:` separates a family from its member. Two shapes, both legal:

- **bare + variants** — a loop or repo-service verb stands alone and takes modifiers:
  `test`, `test:watch` · `build`, `build:api`.
- **family only** — a script that serves one entity wears it as the prefix, and the family needs
  no bare root: `github:agent-token` · `frame:link` · `sline:build` ·
  `mcp:build`.
- **`skill:`** is the family for a script whose only caller is a skill, tail = the skill plus the
  artifact it produces: `skill:cclio-mode-snapshot`, `skill:memory-sync-mirror`.

The file is the key with `:` → `-`, no table to maintain: `github:agent-token` ⇔ `script/github-agent-token.ts`,
`skill:evergreen-apps` ⇔ `script/skill-evergreen-apps.ts`. Library modules under `script/lib/` are
named for what they are, not for a key.

🚫 `cw-memory-render`, `cclio-mode-cw-snapshot` — the surface or the action in the name instead
of the entity; the family already says where it runs, and the tail names the artifact, never the
verb (`mirror`, `snapshot`, `store` — not `render`, `compile`, `sync`).

## the placement — tools at the workspace root

In a monorepo a tool-shaped devDependency (types, a compiler, a bundler and its plugins, a test
runner, css tooling, codegen) goes into the **root** manifest, once, one version; an app's
manifest lists only what its own code imports at runtime. `pnpm run` puts the root
`node_modules/.bin` on every package's PATH, node's module walk from `apps/x` reaches the root
`node_modules`, and a filtered install (`pnpm i -F 'app...'`) still installs the root devDeps
(measured on bytes, 2026-09-11). One renovate PR per bump instead of one per app. A tool that
loads plugins from its own package location (eslint-style) gets a `public-hoist-pattern[]` line
in `.npmrc`, never a copy into the app.

## the versions — exact, and looked up

Every dependency is an exact pin, never `^`/`~` — when hand-authoring a manifest too
(`~/.npmrc save-prefix=` only covers `pnpm add`). Pick and keep every package at the highest
stable version available; check `npm view <pkg> version` before writing ANY version, never one
recalled from training data — that reflex produces dinosaurs (`^5.9` when TS 7 is stable).
