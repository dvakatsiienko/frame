---
dies-when: the cli re-shape (FRM-284, `x:shape-idea`) has folded these into its spec — then this doc goes
---
Ticket: [FRM-284](https://linear.app/x-com/issue/FRM-284)

# prior art — an agent-facing fleet cli (`x`)

three lanes, 2026-10-05: exa (78 s, $0.10), parallel core (137 s), opus source lane (138 s, read gh, oclif, playwright-cli, gum source). they agree on the shape: a typed registry, a json envelope, discovery on demand.

## where `x` already stands
- envelope `{verb, ok, status, data}` on every verb, bare `x` = the registry as json (~1.1 KB, ~300 tokens today, ~2k at 60 verbs), bare `x` 16 ms median [verified, opus lane]

## patterns worth stealing
- **discovery in the failure path** — gh: bare `--json` or an unknown field fails and prints the valid field list (`cli/cli pkg/cmdutil/json_flags.go`) [verified]
- **two-level discovery** — names + one-line purpose resident, the full schema on demand (`x schema <verb>`, a detail level: name / +purpose / full); Anthropic's tool-search + code-execution posts, aclif `discover`/`learn`, Lark cli `schema` [verified]
- **side effects in the registry** — each verb declares mutating / safe, dry-run where it writes (aclif) [verified]
- **json by explicit flag or a pipe, never by agent detection** — gh detects agents (`AI_AGENT` first, then `CLAUDECODE`…) for telemetry only, output follows the tty + flags (`internal/ghcmd/cmd.go`) [verified]
- **generated, never hand-kept agent docs** — playwright-cli ships `skillCheck.js` because its skill is hand-written and drifts; generate the resident index / skill from the registry, and print the refresh command when stale [verified]
- **errors that say the next step**, concise vs detailed response formats (Anthropic, writing tools for agents) [verified]
- **one stream contract** — fly mixes json docs, json-lines and stray text; pick one per verb and test it [verified docs, reported breakage]

## traps
- registry libraries give help/completion, not json schema + tests — keep our registry the source of truth [verified: oclif, cobra, stricli]
- clipanion is stale (4.0.0-rc.4, no release since 2024-09); alive: commander 15, @oclif/core 5.1, gunshi 0.37, citty 0.2, cleye 2.7, @stricli/core 1.3 [verified npm]
- additive json fields still break strict consumers (gh `Unknown JSON field` reports) — version the envelope [reported]

## the charm question
- gum v2.0.2 (2026-09-24): 4.7 MB tarball, stdout/exit-code contract, styles via `GUM_*` env; a TS cli spawns it with a plain fallback when missing [verified]. one spawn per widget, never per line. human-only flows, never agent-critical verbs
- bubbletea is for a genuinely interactive TUI, not for prettier json verbs [verified]
- no source measured TS vs go regret; the go/bun numbers out there compare different things [reported]
- for FRM-284's arms: **a** TS plain · **b** TS + gum costs a fallback wrapper and an optional dependency · **c** go only if a real interactive view is wanted
