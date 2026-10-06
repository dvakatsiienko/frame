# Sline System

Sline is this repo's implementation of the official Claude Code «statusline»
feature: a stdlib-only Go binary rendering directory, model, versions, git,
session, quota, and context segments. Vocabulary lives in [GLOSSARY.md](../../../GLOSSARY.md);
design invariants in `docs/adr/` at the repo root.

- **Source**: `home/.claude/sline/` · **Build**: `pnpm sline:build` · **Test**: `pnpm sline:test`
- **Go craft**: `x:guide-go` — the gate (gofmt, vet, staticcheck, `go fix -diff`), errors, table tests
- **Wired via** `statusLine` in settings.json → `~/.claude/sline/bin`
- **State**: `sline-state.json` — disposable cache, gitignored
- **Invariant**: every displayed number is server-provided (ADR 0001)
- **Gotcha**: branch hyperlinks need `FORCE_HYPERLINK=1` (exported in `home/.zshenv`;
  Warp isn't in CC's terminal-detect list)
