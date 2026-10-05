# mods — cc function-hook plugins, one per folder, each its own plugin in the x marketplace

- a mod runs from source: `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` `env` names each mod folder (plus `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` for desktop-born sessions), so a save reloads it at the end of the turn, no bump, no `/reload-plugins`; the installed `<mod>@x` stays disabled. a new mod joins that list. proof: `claude -p --debug-file <f> ok` prints `hooks module <mod>@inline loaded` (2026-10-04); the env reaches only sessions started after the edit
- tests run through `claude plugin test`, never vitest: `pnpm mods:test`; cc's bundled `plugin-authoring` skill + its per-build types are the authoring docs
- a mod test is proven red with `red-proof --cmd <file> <anchor> <replacement> -- claude plugin test home/.claude/plugin-x/mods/<mod>` (plugin bin; `--pairs` for many lines), never a hand swap
- the desktop refuses a `Client` module (10 s, csp) — draw desktop art with `Svg` + `isInteractive` (SMIL runs in its sandboxed frame); mods draw only on the host surface, never in a `--remote-control` view ([claude-code#99217](https://github.com/anthropics/claude-code/issues/99217))
- a mod initialises on `session.start`, never `classic.SessionStart` — a hot reload fires only the first, so a classic-only init reloads empty and draws nothing (stash 0.2.0, 2026-10-04)
- every interactive element in a mod names itself on hover (dima, 2026-10-05) — the hover traps:
  - a hover card is a `Box` with a `key`, holding a child `Box` drawn `position="absolute"` `display="none"` `hover={{ display: 'flex' }}`; the card itself carries no `key`, or it becomes its own scope and never shows
  - a `Button` has no `title`, and its `hover` only restyles the label — wrap it in the keyed `Box`
  - no code runs on hover; the surface applies the styles
  - the card clips at its site's edge — a one-row band clips anything above or below, so place it on the same row
  - terminal hover needs pointer reporting: kitty, Ghostty, iTerm2 and WezTerm send it, tmux does not
  - an `Svg` `<title>` (`isInteractive`) does not show in the desktop (stash holds chip, 2026-10-05)
  - the test harness keeps `hover` out of `FoundElement.props` and cannot hover — test the hidden card and its words; the reveal is a look on the surface
- `api-map.md` — every hook event with its line in the types file, and the fleet ideas; re-read the types at a cc bump
- `stash/FTR.md` + `stash/CONTEXT.md` — read your section before changing what stash does
- the validator follows `$` only into functions declared in the same file, never across an import — a hook's `$`-using code lives in `register.tsx` (holds had to fold `holds.ts` back in, FRM-299)
- test-harness traps (FRM-299, ~6 debug rounds): `$.tool.call` answers a refusal as `{ deny }`, not `isError`; a `Text` drops its `key` — find it by text + type; an op hook (`ui.copy`) answers `{ value }`; the engine regenerates `.claude-plugin/types/` on reload, sometimes without the tool types, so tool inputs go `unknown` — narrow from `unknown`
