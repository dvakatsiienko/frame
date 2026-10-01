---
researched: 2026-08-21
sources-current-as-of: 2026-08-21
refresh-when: claude code minor version bump, or 60 days
ticket: FRM-43
dies-when: FRM-43's build-or-not verdict lands; the parts that fit the night shift are distilled into cclio:shift at m1 first
---

Ticket: none

# Claude Code extension surfaces

Reference for building a custom orchestration harness on top of Claude Code (ccli). Mechanics + gotchas per surface, primary sources cited inline. Several of these surfaces are version-sensitive — re-verify against `https://code.claude.com/docs/en/claude_code_docs_map.md` before depending on exact behavior in production tooling.

## CLAUDE.md / AGENTS.md hierarchy

Scope stack, highest to lowest precedence: managed policy → user (`~/.claude/CLAUDE.md`) → project root (`./CLAUDE.md`) → subdirectory `CLAUDE.md` files. Docs: https://code.claude.com/docs/en/memory

- Subdirectory `CLAUDE.md` files are **lazy-loaded** — pulled in only once the agent actually touches a file under that subtree, not eagerly at session start. Project-root and user-level `CLAUDE.md` load at session start every time.
- `@path/to/file` import syntax pulls another file's content inline. Imports are for **organization**, not for saving tokens — the imported content still loads into context in full, same as if it were pasted inline. Don't treat `@import` as a lazy-loading mechanism.
- All in-scope `CLAUDE.md` content (user + project + any already-touched subdirs) is resident every turn — this is a fixed context tax that scales with file size, not with relevance. Push detail that's only sometimes needed into skills (which load on trigger) rather than a large root `CLAUDE.md`.
- AGENTS.md is treated as an alias/equivalent entry point in newer Claude Code versions for cross-tool compatibility (Codex/other agents also read AGENTS.md) — confirm current precedence between a coexisting `CLAUDE.md` and `AGENTS.md` in the same directory against current docs before relying on it; this is one of the faster-moving areas.

## Skills

Docs: https://code.claude.com/docs/en/skills, https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

- `SKILL.md` frontmatter: `name`, `description` (the only field the model sees when deciding whether to trigger the skill — write it as a matching signal, not a summary), `disable-model-invocation` (skill becomes user/slash-invoked only, model won't auto-trigger it), `allowed-tools`.
- **Gotcha: `allowed-tools` on a skill is parsed but not enforced** — https://github.com/anthropics/claude-code/issues/37683. Do not use it as a security/sandboxing boundary; it's advisory metadata, not a permission gate. Contrast with subagent `tools`/`disallowedTools`, which *is* enforced (see Subagents below).
- Progressive disclosure, three tiers:
  1. Frontmatter (name + description) — always resident, cheap, this is what triggers matching.
  2. Skill body (the rest of `SKILL.md`) — loaded into context only once the skill is triggered.
  3. Bundled files (scripts, templates, reference docs sitting alongside `SKILL.md`) — loaded on demand, only when the skill body directs the agent to read them.
- Scope/precedence: bundled (built-in) → personal (`~/.claude/skills/`) → project (`.claude/skills/`) → plugin-bundled skills. Exact override behavior when names collide across scopes should be re-checked against current docs.
- Because triggering is entirely description-driven, two skills with overlapping descriptions will compete/misfire — keep descriptions specific and mutually exclusive when hand-authoring a fleet of skills.

## Plugins & marketplaces

Docs: https://code.claude.com/docs/en/plugins-reference

- Plugin root layout: `.claude-plugin/plugin.json` (manifest; only `name` is required) sits at plugin root, and component directories (`skills/`, `commands/`, `agents/`, `hooks/`, `output-styles/`, `themes/`, `monitors/`, `.mcp.json` for MCP servers) are **siblings** of `.claude-plugin/`, not nested inside it. Getting this nesting wrong is a common authoring mistake.
- A plugin can bundle: skills, slash commands, hooks, MCP server definitions, and subagents — effectively the full extension surface in one distributable unit.
- `marketplace.json` shape: `name`, `owner{name,email}`, `plugins[]{name,source,description}` — `source` points at a git repo/path per plugin.
- Install flow: `/plugin marketplace add owner/repo` to register a marketplace, then `/plugin install <plugin-name>` (or equivalent `claude plugin` CLI subcommands) to install from it. Updates are pulled from the marketplace source on demand, not auto-synced.

## Subagents

Docs: https://code.claude.com/docs/en/sub-agents

- `.claude/agents/*.md` frontmatter: `name`, `description`, `tools` / `disallowedTools` (this one **is actually enforced**, unlike skill `allowed-tools`), `model` (supports `inherit` to match the parent session's model), `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `skills`, `memory`, `effort`, `background`, `isolation`.
- Context isolation: a subagent gets a fresh context window; only its final summary/report returns to the parent, not its full transcript. This is the core trade-off:
  - **Helps** when the task is noisy exploration (grepping, reading many files, trial-and-error) that would otherwise bloat the parent's context with irrelevant intermediate steps.
  - **Hurts** when the task needs the parent's accumulated context/decisions to do well — a fresh subagent has no memory of what the parent already tried, ruled out, or decided, so prompts to subagents must be fully self-contained or the subagent will re-derive (or contradict) prior work.
- `isolation` (worktree/remote-style options) and `background` fields suggest subagents can run detached from the interactive session — check current docs for exact semantics before building orchestration logic around them, this is a newer/evolving area.

## Slash commands

Docs likely under https://code.claude.com/docs/en/slash-commands (verify path)

- Location: `.claude/commands/*.md` (project) and presumably `~/.claude/commands/*.md` (personal) — same scope pattern as skills.
- Frontmatter: `description`, `allowed-tools`, `argument-hint`.
- Argument substitution: `$ARGUMENTS` for the full argument string, plus positional `$1`, `$2`, etc.
- Namespacing via subdirectories: `commands/frontend/component.md` surfaces as `/project:frontend:component`.
- Distinct mechanism from MCP-prompt-derived commands, which surface as `/mcp__<server>__<prompt>` (see MCP section) — don't conflate the two when building a command-discovery layer.

## Hooks

Docs: https://code.claude.com/docs/en/hooks (fetch directly for the exhaustive, currently-growing event list)

- Known event types include: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `PreCompact`, and others added release over release — treat any list (including this one) as non-exhaustive and re-check the docs page directly before depending on a specific event existing.
- Exit code semantics:
  - `0` — success/no-op. Anything written to stderr is swallowed into a debug log only, not surfaced to the user.
  - `1` — non-blocking error; message is shown to the user but the flow continues.
  - `2` — blocking. For `PreToolUse`, this blocks the tool call before it runs. For `PostToolUse`/failure hooks, the tool has already run, but exit 2 forces stderr through to the user/agent even though it's after the fact.
- Structured JSON on stdout is the richer control surface — supports fields like `permissionDecision` (allow/deny/ask a tool call), `updatedInput` (rewrite the tool call's input before/as it executes), and `additionalContext` (inject extra context into the conversation). This is the mechanism for hooks that mutate rather than just block.
- This is the surface most directly useful for an orchestration harness that wants to intercept, veto, or rewrite tool calls programmatically rather than relying on prompting.

## Output styles / statusline / settings.json

Docs: https://code.claude.com/docs/en/settings, https://code.claude.com/docs/en/env-vars, https://code.claude.com/docs/en/permission-modes

- Settings scope stack (same pattern as CLAUDE.md): managed policy → user (`~/.claude/settings.json`) → project (`.claude/settings.json`) → project-local override (`.claude/settings.local.json`, typically gitignored).
- Permission modes: `default` (ask per action per current permission rules), `acceptEdits` (auto-accept file edits, still ask for other risky actions), `bypassPermissions` (no prompts — dangerous, meant for sandboxed/CI contexts), `plan` (research/plan only, no mutating actions).
- `additionalDirectories` grants filesystem access beyond the current working directory — the mechanism this session itself uses to mount extra folders.
- `env` block in settings.json lets you set environment variables that apply to every Claude Code invocation reading that settings file.

### CLAUDE_CONFIG_DIR — the critical multi-persona question

**Answer: the mechanism exists (`CLAUDE_CONFIG_DIR` env var) but is undocumented and only partially implemented — not a supported, reliable isolation boundary today.**

- Not present in `claude --help` output or in the official docs pages as of this research. There is an open issue specifically asking for it to be documented: https://github.com/anthropics/claude-code/issues/33430
- Originated as feature requests modeled on `XDG_CONFIG_HOME`: https://github.com/anthropics/claude-code/issues/28808 and https://github.com/anthropics/claude-code/issues/25762
- Known breakage while the variable is set, per GitHub issues against anthropics/claude-code:
  - #30230 — CLAUDE.md is loaded from **both** the custom `CLAUDE_CONFIG_DIR` location and the real `~/.claude/` simultaneously, so two personas' global CLAUDE.md files bleed into each other rather than staying isolated. https://github.com/anthropics/claude-code/issues/30230
  - #15071 — plugin/marketplace state stays pinned to `~/.claude/plugins/marketplaces/` regardless of `CLAUDE_CONFIG_DIR`, i.e. plugin state is not relocated. https://github.com/anthropics/claude-code/issues/15071
  - #80791 — a `.claude/` directory found at or above the current working directory can override the `CLAUDE_CONFIG_DIR`-selected profile, meaning cwd location can silently punch through the intended isolation. https://github.com/anthropics/claude-code/issues/80791
  - #37570 — credentials have been reported stored under a literal `~` subpath relative to cwd rather than under the relocated config dir. https://github.com/anthropics/claude-code/issues/37570
  - #3833, #519 — reports of a local `.claude/` directory still being created, or expected files not found, when `CLAUDE_CONFIG_DIR` is set — inconsistent behavior across subsystems. https://github.com/anthropics/claude-code/issues/3833, https://github.com/anthropics/claude-code/issues/519
- Unverified from primary sources: whether `~/.claude.json` (a separate top-level file from the `~/.claude/` directory) respects the variable, and whether the VS Code/JetBrains IDE extensions respect it at all (a separate earlier finding flagged the VS Code extension as ignoring it entirely and always using `~/.claude/` — treat that as likely but re-verify, since it wasn't independently reconfirmed in this pass).

**Practical implication for a coordinator/coder two-persona setup**: do not rely on `CLAUDE_CONFIG_DIR` alone. At minimum, also isolate the working-directory ancestry (no shared `.claude/` above either persona's cwd) and independently verify where each persona's credentials/plugin state actually land before trusting the isolation. Treat this as an experimental, best-effort separation, not a hard security or state boundary.

## MCP

Docs: https://code.claude.com/docs/en/mcp

- Two transport shapes: local **stdio** servers (spawned as a child process) and **remote** servers (SSE/HTTP, frequently behind OAuth).
- Three MCP primitives surface differently in Claude Code:
  - **Tools** — model-invoked, appear in the tool list like any built-in tool.
  - **Prompts** — surface as slash commands in the form `/mcp__<server>__<prompt>`; these are user-invoked, not model-chosen, distinct from `.claude/commands` slash commands.
  - **Resources** — user-pulled via `@`-mention, not automatically injected.
- Token cost / deferral: MCP tool schemas are **deferred by default** rather than resident — at session start only tool names plus server instructions load into context, not full parameter schemas. Full schemas load on demand when a tool is actually about to be called, which is the same "load full definition just-in-time" pattern as the `ToolSearch` deferred-tool mechanism visible in this very session. A server can opt out of deferral with `alwaysLoad` if it's trusted and its tools are used on nearly every turn — but that reintroduces the fixed token cost per session for that server's full tool set.
- For a harness with many MCP servers connected, expect meaningful per-session token overhead if servers aren't using deferral — this is the direct motivation for the ToolSearch-style pattern.

## Gotchas

- `@import` in CLAUDE.md is organizational only — it does not defer or reduce token cost; imported content is fully inline every session.
- Skill `allowed-tools` is advisory and unenforced (#37683) — never treat it as a sandbox boundary. Subagent `tools`/`disallowedTools` is the enforced equivalent.
- Subdirectory CLAUDE.md is lazy (loads on first touch); user/project-root CLAUDE.md is not — a large root CLAUDE.md is a fixed tax on every session regardless of relevance.
- `CLAUDE_CONFIG_DIR` is undocumented and leaks across personas in multiple ways (CLAUDE.md bleed, plugin state pinned to `~/.claude/`, cwd-ancestor `.claude/` override, credential path oddities). Do not build a security-sensitive coordinator/coder split on it without independently re-verifying current behavior.
- Plugin manifest layout is easy to get wrong: component dirs (`skills/`, `commands/`, etc.) are siblings of `.claude-plugin/`, not children of it.
- Subagents return only a final summary to the parent — a subagent prompt must be fully self-contained; it cannot lean on "based on what we discussed" context from the parent session.
- Hook stdout JSON (`permissionDecision`, `updatedInput`, `additionalContext`) is the actual programmatic control surface for an orchestration harness — exit codes alone only allow/block, they don't let you rewrite a tool call.
- MCP prompts vs. `.claude/commands` slash commands are two different systems that both show up as `/something` — don't assume uniform discovery/authoring mechanics between them.
- MCP tool schema deferral is the default and is the same "load full schema on demand" pattern as the ToolSearch tool visible in this session — worth mirroring in a harness that connects many MCP servers, to avoid fixed per-session token tax.

## Open questions

- Current precedence/interaction between a coexisting `CLAUDE.md` and `AGENTS.md` in the same directory — this area is moving fast, re-check `https://code.claude.com/docs/en/memory` directly.
- Exact skill-scope override behavior when personal/project/plugin skills share a name.
- Whether `~/.claude.json` (distinct from the `~/.claude/` directory) respects `CLAUDE_CONFIG_DIR` — not confirmed from primary sources.
- Whether the VS Code/JetBrains extensions respect `CLAUDE_CONFIG_DIR` at all — one earlier signal said no (VS Code always uses `~/.claude/`), not independently reconfirmed here; re-verify against https://github.com/anthropics/claude-code/issues/30538 directly.
- Exact semantics of subagent `isolation` and `background` frontmatter fields (worktree-style isolation, detached/background execution) — these look newer and under-documented; verify against current https://code.claude.com/docs/en/sub-agents before relying on them.
- Full exhaustive current list of hook event types and their exact JSON payload shapes per event — treat the list in this doc as a snapshot, not exhaustive; hook events have been added release over release.
- Full precedence rule when the same-named slash command exists in both project and personal `.claude/commands/`.

## Sources

- https://code.claude.com/docs/en/claude_code_docs_map.md
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/skills
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://code.claude.com/docs/en/plugins-reference
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/permission-modes
- https://code.claude.com/docs/en/env-vars
- https://code.claude.com/docs/en/mcp
- https://github.com/anthropics/claude-code/issues/33430
- https://github.com/anthropics/claude-code/issues/28808
- https://github.com/anthropics/claude-code/issues/25762
- https://github.com/anthropics/claude-code/issues/30230
- https://github.com/anthropics/claude-code/issues/15071
- https://github.com/anthropics/claude-code/issues/80791
- https://github.com/anthropics/claude-code/issues/37570
- https://github.com/anthropics/claude-code/issues/3833
- https://github.com/anthropics/claude-code/issues/519
- https://github.com/anthropics/claude-code/issues/37683
- https://github.com/anthropics/claude-code/issues/30538 (VS Code extension + CLAUDE_CONFIG_DIR — flagged in prior pass, not independently reconfirmed in this one)
