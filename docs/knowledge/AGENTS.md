# AGENTS.md: the knowledge shelf

distilled facts the fleet needs before a precision move: the traps, the defaults, the measured numbers a model's training does not hold. a file here is neither research (`docs/research/`, answers once) nor a test drive (`docs/test-drive/`, accumulates rounds).

## what belongs here

a subject scattered across the filesystem: go and charm live in any app. a subject that lives in one place keeps its knowledge in that place: the mods in `home/.claude/plugin-x/mods/AGENTS.md`, a skill's sources in its `references/` (the model cards and spawn facts in `x:crew-lead`'s, dima's o76–o81), an app area in a nested `AGENTS.md` beside its code (trophy-sys `src/server/`, `src/web/charts/`), which loads when the folder is touched (dima, 2026-10-12).

## every file carries

- `fed-by:` in frontmatter — `recipe <name>` (the recipe whose runs keep it true) or `incidents` (a ledger grown by what went wrong)
- `when:` in frontmatter — the touches that should bring it, the source of a `rules-lazy` row: `{ kind, value }` with kind `extension`, `basename`, `import`, `command`, or `skill`; it names the kind of thing touched, never a path, and no code reads it
- `## core` first in the body — ≤4 KB, the part an agent needs before acting; traps and design rules over api lists (the 10-12 knowledge A/B: coders read the types themselves, the knowledge paid on what to build)

## how it reaches an agent

a row in `home/.claude/rules-lazy/triggers.json` brings a file when its subject comes up: the first matching call is refused once, naming `x knowledge read <name>` (`shelf-load-go-charm`, `shelf-load-macos-apps`). every other file is reached by name: `x knowledge list` in `crew-dna`, `x:author-memory`, the recipes. a new row waits for a miss that cost something; `pnpm memory-load:replay` shows its false fires before it ships.
