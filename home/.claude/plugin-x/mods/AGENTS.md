# mods — cc function-hook plugins, one per folder, each its own plugin in the x marketplace

- a mod runs from source: `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` `env` names each mod folder (plus `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` for desktop-born sessions), so a save reloads it at the end of the turn, no bump, no `/reload-plugins`; the installed `<mod>@x` stays disabled. a new mod joins that list. proof: `claude -p --debug-file <f> ok` prints `hooks module <mod>@inline loaded` (2026-10-04); the env reaches only sessions started after the edit
- tests run through `claude plugin test`, never vitest: `pnpm mods:test`; cc's bundled `plugin-authoring` skill + its per-build types are the authoring docs
- the desktop refuses a `Client` module (10 s, csp) — draw desktop art with `Svg` + `isInteractive` (SMIL runs in its sandboxed frame); mods draw only on the host surface, never in a `--remote-control` view ([claude-code#99217](https://github.com/anthropics/claude-code/issues/99217))
- a mod initialises on `session.start`, never `classic.SessionStart` — a hot reload fires only the first, so a classic-only init reloads empty and draws nothing (stash 0.2.0, 2026-10-04)
- `stash/FTR.md` + `stash/CONTEXT.md` — read your section before changing what stash does
