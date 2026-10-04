# mods — cc function-hook plugins, one per folder, each its own plugin in the x marketplace

- an edit reaches a session only after a version bump in its `.claude-plugin/plugin.json`, then `claude plugin marketplace update x` + `claude plugin update <mod>@x`, then `/reload-plugins` — an installed mod runs from a cached copy, only plugin `x` itself is re-read from its folder (breather, 2026-10-04)
- tests run through `claude plugin test`, never vitest: `pnpm mods:test`; cc's bundled `plugin-authoring` skill + its per-build types are the authoring docs
- the desktop refuses a `Client` module (10 s, csp) — draw desktop art with `Svg` + `isInteractive` (SMIL runs in its sandboxed frame); mods draw only on the host surface, never in a `--remote-control` view ([claude-code#99217](https://github.com/anthropics/claude-code/issues/99217))
