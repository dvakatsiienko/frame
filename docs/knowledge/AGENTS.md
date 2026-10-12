# AGENTS.md: the knowledge shelf

distilled facts the fleet needs before a precision move: the traps, the defaults, the measured numbers a model's training does not hold. a file here is neither research (`docs/research/`, answers once) nor a test drive (`docs/test-drive/`, accumulates rounds).

## what belongs here

a subject scattered across the filesystem: go and charm live in any app, a spawn happens from any session. a subject that lives in one place keeps its knowledge in that place: the mods in `home/.claude/plugin-x/mods/AGENTS.md`, a skill's sources in its `references/` (dima, 2026-10-12).

## every file carries

- `fed-by:` in frontmatter — `recipe <name>` (the recipe whose runs keep it true) or `incidents` (a ledger grown by what went wrong)
- `when:` in frontmatter — the signals that deliver it: `{ kind, value }` with kind `extension`, `basename`, `import`, `command`, or `skill`; a signal names the kind of thing touched, never a path
- `## core` first in the body — ≤4 KB, the part an agent needs before acting; traps and design rules over api lists (the 10-12 knowledge A/B: coders read the types themselves, the knowledge paid on what to build)

## how it reaches an agent

`x-mod-primer` (sealed, built after the shelf revamp) watches each touch and attaches the matching file's core to the tool result, once per session, again after a compaction. until it ships, the `x:author-memory` skill and the recipes point here by name.
