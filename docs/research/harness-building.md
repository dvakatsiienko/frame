---
researched: 2026-08-21
sources-current-as-of: 2026-08-21
refresh-when: claude code minor version bump, or 60 days
ticket: FRM-43
dies-when: FRM-43's build-or-not verdict lands; the parts that fit the night shift are distilled into cclio:shift at m1 first
---

# Building a custom agent orchestration harness on Claude Code / Agent SDK

Scope: a solo power user, one Mac, one coordinator agent that dispatches to coder agents, memory that
survives sessions. Everything below is checked against primary sources — the docs pages under
`docs.claude.com`, the Anthropic engineering blog, and repo metadata on GitHub. Where a claim is a
judgement rather than a documented fact it is marked as such.

---

## Claude Agent SDK: `query()` and streaming input

The TypeScript entry point is a single function that returns an async generator you iterate
(`docs.claude.com/en/api/agent-sdk/typescript`):

```ts
function query({ prompt, options }: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;   // extends AsyncGenerator<SDKMessage, void>
```

Two input modes, and the difference matters for a harness:

- **String prompt** — one-shot. Simple, but most of the runtime control surface is unavailable.
- **`AsyncIterable<SDKUserMessage>` (streaming input mode)** — the coordinator keeps a live handle.
  `interrupt()`, `setModel()`, `setPermissionMode()`, and `applyFlagSettings()` are documented as
  *only available in streaming input mode*. If you want to retarget a running worker's model
  mid-flight, you must be in this mode.

`startup()` pre-warms the CLI subprocess and completes the initialize handshake before a prompt
exists, returning a `WarmQuery` whose `.query()` skips the spawn cost. For a coordinator that
dispatches bursts of short workers this removes the per-spawn latency from the critical path.

### Query handle: the control surface worth knowing

From the `Query` interface: `interrupt()`, `setModel(model?)`, `setPermissionMode(mode)`,
`applyFlagSettings(settings)`, `initializationResult()`, `reinitialize()`, `supportedModels()`,
`supportedAgents()`, `getContextUsage()`, `readFile(path, opts)`, `setMcpServers(servers)`,
`streamInput(stream)`, `stopTask(taskId)`, `rewindFiles(userMessageId)`, `close()`.

Two of these are unusually useful for orchestration and easy to miss:

- **`getContextUsage()`** returns the same breakdown `/context` shows interactively — by category,
  skill, and tool. A coordinator can poll its own or a worker's context pressure and decide to
  hand off *before* compaction rather than after.
- **`applyFlagSettings()`** mutates the flag-settings layer live. `model` applies during the current
  turn (from Claude Code v2.1.212; earlier it waited for the next turn); `permissions`, `hooks`,
  `effortLevel`, `agent` apply on the next turn; **system prompt options have no effect
  mid-session** — they resolve once at startup, so changing the coordinator's persona requires a new
  session. That last one is the sharpest constraint on "one long-lived coordinator" designs.

### Session resumption and forking

`Options.resume` takes a session ID. `Options.forkSession: true` makes the resume branch to a *new*
session ID instead of appending to the original. `Options.sessionId` lets you **choose the UUID
yourself** instead of accepting a generated one — meaning a harness can name sessions
deterministically from its own task IDs rather than scraping IDs back out of output.
`resumeSessionAt` resumes at a specific message UUID (with `resumeDropsTurn` naming the prompt UUID
of the turn a truncating resume intends to discard; Claude Code refuses if the discarded range
contains anything not attributable to that turn). `persistSession: false` disables on-disk
persistence entirely for throwaway workers.

### Custom tools via in-process MCP

`createSdkMcpServer({ name, version, instructions, tools, alwaysLoad })` returns an
`McpSdkServerConfigWithInstance` you pass in `options.mcpServers`. Tools are built with
`tool(name, description, zodShape, handler, extras)` — Zod 3 and Zod 4 both supported. No
subprocess, no stdio framing: the handler is a normal async function in your harness process. This
is the single most important primitive for a coordinator, because it is how you expose
`spawn_worker`, `check_worker`, `read_worker_result` to the model as first-class tools.

`extras.searchHint` and `alwaysLoad` interact with tool search
(`docs.claude.com/en/docs/agent-sdk/tool-search`): a deferred tool costs only its name in context
until fetched. A harness with 20 orchestration tools should defer most of them and `alwaysLoad`
only the two or three the coordinator needs on every turn.

Related: `toolAliases` maps a built-in tool name onto an MCP tool name — e.g.
`{ Bash: 'mcp__workspace__bash' }` — so you can swap Claude's Bash for your own sandboxed
implementation without the model noticing.

### Hooks in the SDK

`options.hooks` is `Partial<Record<HookEvent, HookCallbackMatcher[]>>` — in-process callbacks, not
shell commands. `includeHookEvents: true` surfaces hook lifecycle as `SDKHookStartedMessage` /
`SDKHookProgressMessage` / `SDKHookResponseMessage` in the message stream. Note the doc's explicit
guidance: `canUseTool` fires **only** when the permission flow falls through to a prompt, so calls
auto-approved by `allowedTools`, an allow rule, or `permissionMode` never reach it — *"To gate every
tool call, use a `PreToolUse` hook instead."* If your harness needs an audit log of every worker
action, that is a hook, not a permission callback.

### Permission callbacks

```ts
type CanUseTool = (toolName, input, { signal, suggestions, blockedPath,
  decisionReason, toolUseID, agentID, requestId }) => Promise<PermissionResult | null>;
```

`PermissionResult` is `{ behavior: 'allow', updatedInput?, updatedPermissions? }` or
`{ behavior: 'deny', message, interrupt? }`. Returning `null` means *"I already sent the
control_response out of band"* — anything else returning `null` leaves the tool call blocked
forever, because permission prompts never time out. `agentID` tells you which subagent asked, which
is how a coordinator can apply different policies per worker.

`PermissionMode` is `'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto'`.
`dontAsk` (deny anything not pre-approved) is the right default for unattended workers;
`bypassPermissions` additionally requires `allowDangerouslySkipPermissions: true`.

### Model per query, and per subagent

Three levers: `options.model` at query start; `query.setModel()` mid-session (streaming input only);
and `AgentDefinition.model` per subagent. The subagent field accepts an alias — `'fable'`, `'opus'`,
`'sonnet'`, `'haiku'`, `'inherit'` — or a full model ID. `options.fallbackModel` covers primary
failure. `options.effort` takes `'low' | 'medium' | 'high' | 'xhigh' | 'max'`, and
`AgentDefinition.effort` accepts a named level *or an integer*.

### Subagent definitions

```ts
type AgentDefinition = {
  description: string;        // when to use this agent — the model reads this to route
  prompt: string;             // system prompt
  tools?: string[]; disallowedTools?: string[];
  model?: string; effort?: ...; maxTurns?: number;
  mcpServers?: AgentMcpServerSpec[]; skills?: string[];
  initialPrompt?: string;     // auto-submitted first turn when run as main-thread agent
  background?: boolean;       // non-blocking background task when invoked
  memory?: 'user' | 'project' | 'local';
  permissionMode?: PermissionMode;
};
```

Passed as `options.agents: Record<string, AgentDefinition>`. `options.agent` names one to run as the
**main thread** — so "coordinator" can itself be an AgentDefinition rather than a pile of loose
options. `disallowedTools` accepts MCP patterns (`mcp__server__*`, `mcp__*`), which is the clean way
to deny a coder agent access to your orchestration tools so it can't spawn siblings.

`background: true` plus `agentProgressSummaries: true` gives non-blocking workers that emit one-line
progress on `task_progress` events. `query.stopTask(taskId)` kills one.

---

## Headless Claude Code: `claude -p` and what is actually scriptable

Reference: `docs.claude.com/en/docs/claude-code/headless` and
`docs.claude.com/en/docs/claude-code/cli-reference`.

- **`claude -p "<prompt>"`** (`--print`) runs non-interactively, reads stdin, writes stdout.
- **`--output-format`**: `text` (default), `json` (result + session ID + usage/cost metadata),
  `stream-json` (newline-delimited events). `stream-json` is normally paired with `--verbose`, and
  with `--include-partial-messages` for token-level deltas. **The last line of a `stream-json`
  stream is a `result` message** with final text, cost, and session metadata — that is your join
  point.
- **`--json-schema '<JSON Schema>'`** with `--output-format json` puts a validated object in
  `structured_output`. Invalid schema now errors loudly (`Error: --json-schema is not a valid JSON
  Schema`) rather than silently degrading as before v2.1.205. This is how a coordinator gets
  machine-readable worker verdicts without prompt-parsing prose.
- **`--resume <session-id>`** / **`--continue`** / **`--fork-session`**. Crucially, from Claude Code
  v2.1.223 `--resume <id>` **works from any directory** — Claude Code searches the current project
  and its worktrees first, then every other project on the machine. Before that you had to `cd` back
  to the originating directory. `--session-id` lets you pick the UUID up front.
- **`--append-system-prompt`** (and `--append-system-prompt-file`) extends the Claude Code prompt;
  **`--system-prompt`** / `--system-prompt-file` replace it outright, and the two replacement forms
  are mutually exclusive with each other but combinable with the append forms. There is also
  `--append-subagent-system-prompt` for injecting into every subagent.
- **`--settings <file-or-json>`** takes a path *or an inline JSON blob*. Combined with
  `--setting-sources` (or SDK `settingSources: []`) you can run a session that ignores user, project,
  and local settings entirely and takes only what the harness hands it — reproducible dispatch.
- **`--allowedTools`** uses permission rule syntax: `"Bash(git diff *),Read,Edit"`. The docs stress
  the space before `*` — `Bash(git diff*)` would also match `git diff-index`. `--allowedTools` does
  **not** restrict Claude to those tools; unlisted ones fall through to `--permission-mode` and the
  permission callback. Use `--disallowed-tools` to actually block.
- **`--bare`** skips auto-discovery of hooks, skills, plugins, MCP servers, auto memory, and
  CLAUDE.md. The docs call it *"the recommended mode for scripted and SDK calls"* and say it will
  become the default for `-p`. Big caveat: **in bare mode Claude Code never reads OAuth credentials
  or the keychain** — you must supply `ANTHROPIC_API_KEY` or an `apiKeyHelper`. For a solo user on a
  Max subscription this is the reason *not* to use `--bare` for personal workers.
- **Security note worth internalizing**: without `--bare`, a `-p` session runs the hooks in a
  project's `.claude/settings.json` and connects the servers in its `.mcp.json` **even in a folder
  you never trusted**, because `-p` can't show a trust dialog.
- **Exit codes**: 0 on success, non-zero on failure. Invalid flags report to stderr before the run
  starts; failures *inside* the run are printed as the result on stdout (so a zero exit does not
  guarantee a good result — check the `result` message's fields, not just `$?`). SIGTERM aborts the
  turn, kills the Bash process tree, runs `SessionEnd` hooks, and **exits 143**.
- **Process lifetime**: background Bash tasks are killed ~5s after the final result. Background
  *subagents* are exempt and `claude -p` waits for them — capped at ten minutes by default from
  v2.1.182, tunable via `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` (`0` = no limit).
- **Slash commands and skills work in `-p`**: put `/skill-name` in the prompt string.
  `/model sonnet`, `/effort`, `/config key=value` accept arguments. `/login` and other
  terminal-only commands do not.

**Not scriptable / rejected combinations**: `--bg` is rejected with `-p`. `--cloud` with a task
description is rejected with `-p`. Interactive-only affordances (trust dialogs, per-server MCP
approval, the session picker) simply do not exist in print mode — which is why `-p` silently
auto-loads project hooks and MCP servers instead of prompting.

**Judgement**: the CLI and the SDK are the same binary. The SDK spawns `claude` as a subprocess
(`pathToClaudeCodeExecutable`, `spawnClaudeCodeProcess` are both overridable). So "SDK vs headless"
is a question of whether you want typed message objects and in-process callbacks, or a pipe. There
is no capability tier you unlock by choosing one — except that in-process MCP tools and
`canUseTool` callbacks are SDK-only by construction.

---

## Orchestration patterns: coordinator/worker, and when not to spawn

Anthropic's Research feature is an explicit orchestrator-worker system: *"a lead agent coordinates
the process while delegating to specialized subagents that operate in parallel"*
(`anthropic.com/engineering/multi-agent-research-system`). The measured result: Opus lead + Sonnet
subagents beat single-agent Opus by **90.2%** on their internal research eval.

The mechanism they name is compression, not cleverness: *"Subagents facilitate compression by
operating in parallel with their own context windows, exploring different aspects of the question
simultaneously before condensing the most important tokens for the lead research agent."* A worker
reads 100k tokens and returns 2k. That ratio is the whole point of the pattern.

### When to spawn vs do it yourself

Anthropic's own boundary: multi-agent systems *"excel at valuable tasks that involve heavy
parallelization, information that exceeds single context windows, and interfacing with numerous
complex tools"* — and explicitly, *"most coding tasks involve fewer truly parallelizable tasks than
research, and LLM agents are not yet great at coordinating and delegating to other agents in real
time."* Domains where all agents need the same context, or with many inter-agent dependencies, are
called out as a bad fit.

Their concrete effort-scaling rules, embedded directly in the lead agent's prompt:

| Task shape | Agents | Tool calls each |
|---|---|---|
| Simple fact-finding | 1 | 3–10 |
| Direct comparison | 2–4 | 10–15 |
| Complex research | 10+ | clearly divided responsibilities |

Encoding a table like this in the coordinator's system prompt is the single highest-leverage thing
in the whole post, because *"agents struggle to judge appropriate effort for different tasks"* and
overinvestment on simple queries was *"a common failure mode in our early versions."* Early agents
spawned **50 subagents for simple queries**.

### The delegation contract

*"Each subagent needs an objective, an output format, guidance on the tools and sources to use, and
clear task boundaries. Without detailed task descriptions, agents duplicate work, leave gaps, or
fail to find necessary information."* Their worked failure: `"research the semiconductor shortage"`
produced one agent on the 2021 automotive chip crisis and two duplicating each other on 2025 supply
chains.

For a coding harness this maps to a dispatch payload, not a sentence: `{ objective, files_you_own,
files_you_must_not_touch, done_criteria, output_schema, model, effort, max_turns }`.

### File ownership to avoid collisions

Nothing in the SDK arbitrates file writes between concurrent workers. The two real options:

1. **Git worktrees, one per worker** — each agent on its own branch in its own checkout. This is
   what essentially every OSS harness converged on (see the survey below); `claude --worktree`/`-w`
   exists as a first-class flag, and `--teleport` / `--tmux` sit alongside it.
2. **Declared ownership in the dispatch payload plus a `PreToolUse` hook** that denies Write/Edit
   outside the worker's assigned path set. Because `canUseTool` is skipped for auto-approved calls,
   this enforcement must be a hook — that's the documented distinction.

Worktrees are the safer default for coder agents; hook-enforced ownership is better when workers
must share one checkout (e.g. one worker editing `src/`, another editing `docs/`).

### Keeping the coordinator's context small

Concrete levers, all documented:

- **Structured returns.** `--json-schema` / `outputFormat: { type: 'json_schema', schema }` forces
  the worker to hand back a fixed-shape object rather than an essay.
- **Don't forward subagent chatter.** By default only `tool_use` / `tool_result` blocks from
  subagents are emitted; `forwardSubagentText` / `--forward-subagent-text` is opt-in. Leave it off
  unless you are rendering a nested transcript. `agentProgressSummaries` gives you one-line
  progress instead of the full stream.
- **Results on disk, pointers in context.** Workers write `reports/<task-id>.md`; the coordinator
  gets back a path plus a 200-token abstract and reads the file only if it needs to.
- **Watch the gauge.** `getContextUsage()` is a real API — the coordinator can hand off on a
  threshold instead of on vibes.
- **Persist the plan before it burns.** From the Research post: the LeadResearcher *"begins by
  thinking through the approach and saving its plan to Memory to persist the context, since if the
  context window exceeds 200,000 tokens it will be truncated and it is important to retain the
  plan."* A coordinator that writes its plan to a file on turn one survives its own compaction.

Anthropic's general framing on this is in
`anthropic.com/engineering/effective-context-engineering-for-ai-agents`; the taxonomy of
orchestration shapes (chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer)
is in `anthropic.com/engineering/building-effective-agents`.

---

## Persistence: sessions, transcripts, and reading the past programmatically

### Where state lives on disk

*"By default, Claude Code stores transcripts as JSONL at
`~/.claude/projects/<project>/<session-id>.jsonl`, where `<project>` is your working directory path
with non-alphanumeric characters replaced by `-`."* Paths whose converted name exceeds 200
characters are truncated to 200 and suffixed with a hash of the full path
(`docs.claude.com/en/docs/claude-code/sessions`). `CLAUDE_CONFIG_DIR` moves the whole store off
`~/.claude`.

Sessions created by `claude -p` or the SDK **do not appear in the interactive session picker**, but
are resumable by ID all the same. `/cd` relocates a session to the new directory's project storage
(v2.1.169+).

### Reading a past session — don't parse JSONL by hand

The SDK ships first-class readers, which is the single most under-advertised part of the surface:

```ts
listSessions({ dir?, limit?, includeWorktrees? }): Promise<SDKSessionInfo[]>
getSessionMessages(sessionId, { dir?, limit?, offset? }): Promise<SessionMessage[]>
getSessionInfo(sessionId, { dir? }): Promise<SDKSessionInfo | undefined>
renameSession(sessionId, title, { dir? })
tagSession(sessionId, tag | null, { dir? })
```

`SDKSessionInfo` carries `sessionId, summary, lastModified, fileSize, customTitle, firstPrompt,
gitBranch, cwd, tag, createdAt`. Omit `dir` and it searches **all** projects.

`SessionMessage` carries `type ('user'|'assistant'), uuid, session_id, message, parent_tool_use_id,
parent_agent_id`. Those last two are the orchestration payload: `parent_tool_use_id` is the
`tool_use_id` of the spawning Agent call, `parent_agent_id` is the `agentId` of the subagent that
spawned a nested one (Claude Code v2.1.202+). **You can reconstruct the full spawn tree of a past
run from the transcript alone.**

`renameSession` / `tagSession` append entries — repeated calls are safe, most recent wins. A harness
can tag every worker session with its task ID and then find them by scanning tags, no side index
needed.

### The three persistence tiers real harnesses use

1. **Files (markdown/JSON) in the repo.** CLAUDE.md, `docs/`, `reports/<task-id>.md`, a
   `state.json` task board. Wins because both the human and the agent read it with the same tools,
   and git gives you history for free. This is what Anthropic's own "save the plan to Memory"
   pattern reduces to on a local machine.
2. **Session store.** `Options.sessionStore` mirrors transcripts to an external backend so *another
   host* can resume them (`docs.claude.com/en/docs/agent-sdk/session-storage`), with
   `sessionStoreFlush: 'batched' | 'eager'` and `loadTimeoutMs`. Overkill for one Mac; the relevant
   detail is that the interface exists, so a SQLite-backed transcript store is a supported
   extension point rather than a hack.
3. **SQLite / a real index.** Only worth it when you want cross-session queries ("every task that
   touched `auth.ts`", "cost by worker last month"). The cheap version: append one JSON line per
   dispatch to `~/.claude-harness/tasks.jsonl` and let `jq` be the query engine until it hurts.

`AgentDefinition.memory: 'user' | 'project' | 'local'` selects which memory source a subagent sees —
so a coder agent can be given project memory while the coordinator keeps user memory, without them
sharing a file.

---

## Failure modes of multi-agent setups, and documented mitigations

**Cost blowup.** *"In our data, agents typically use about 4× more tokens than chat interactions,
and multi-agent systems use about 15× more tokens than chats. For economic viability, multi-agent
systems require tasks where the value of the task is high enough to pay for the increased
performance."* And the flip side, which is the actual justification for the architecture: *"token
usage by itself explains 80% of the variance"* in performance on their browsing eval, with tool-call
count and model choice as the other two factors (95% combined).
→ Mitigations: `maxBudgetUsd` stops a query at a client-side cost estimate; `maxTurns` caps
round-trips; `taskBudget: { total }` (alpha) tells the model its remaining token budget *so it can
pace itself*; a cheap model for workers and an expensive one for the lead is the shape Anthropic
shipped (Opus lead, Sonnet workers).

**Duplicated work.** The semiconductor example above — vague dispatch produces overlapping searches.
→ Mitigation: objective + output format + tool guidance + explicit task boundaries in every dispatch.
For code: non-overlapping file ownership, declared up front.

**Over-spawning.** *"Early agents made errors like spawning 50 subagents for simple queries,
scouring the web endlessly for nonexistent sources, and distracting each other with excessive
updates."*
→ Mitigation: the effort-scaling table in the coordinator prompt; hard `maxTurns` per agent.

**Context loss at handoff.** The 200k truncation problem, mitigated by the lead writing its plan to
memory before the window fills. Also relevant: **system prompt options don't change mid-session**,
so a "handoff" that needs a different persona is a new session seeded from a file, not an
`applyFlagSettings` call.

**Coordinator as bottleneck.** Anthropic names this as a live limitation of their own system:
*"our lead agents execute subagents synchronously, waiting for each set of subagents to complete
before proceeding. This simplifies coordination, but creates bottlenecks... the lead agent can't
steer subagents, subagents can't coordinate, and the entire system can be blocked while waiting for
a single subagent to finish."* They flag async execution as future work with costs in *"result
coordination, state consistency, and error propagation."*
→ Mitigations available to you today: `background: true` agents plus `stopTask(taskId)` and
`CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` (default 600000, resets on each stream event; on stall it
aborts the subagent, marks the task failed, and surfaces partial results to the parent).

**Error compounding and non-determinism.** *"minor changes cascade into large behavioral changes"*;
*"agents make dynamic decisions and are non-deterministic between runs, even with identical
prompts."* Their answers: durable execution that resumes from the failure point rather than
restarting, telling the agent when a tool is failing and letting it adapt, *"deterministic
safeguards like retry logic and regular checkpoints,"* and full production tracing.
→ Local equivalents: `enableFileCheckpointing` + `rewindFiles()`, session forking as a cheap
checkpoint, and logging every `SDKMessage` to a per-task JSONL so a failed run is diagnosable
after the fact.

**Evaluation is hard because paths differ.** *"Even with identical starting points, agents might
take completely different valid paths."* Their answer: start with ~20 representative queries, not
hundreds; an LLM judge with a single call producing 0.0–1.0 plus pass/fail was *more consistent*
than multiple specialized judges; and keep humans in the loop, because testers caught a bias toward
SEO content farms over academic PDFs that no automated eval surfaced.

---

## Survey: open-source harnesses built on Claude Code

Star counts are from the GitHub API at time of writing and are directional only.

- **`ruvnet/ruflo`** (formerly claude-flow, ~68k) — the maximalist meta-harness: swarms, a router,
  self-learning memory, federation across machines, 300+ MCP tools. *Steal:* its framing —
  *"Agent = Model + Harness. The model writes; the harness gives it tools, memory, loops, sandboxes,
  and controls"* — and the hooks-driven routing so the user keeps using plain Claude Code while the
  harness coordinates underneath. (github.com/ruvnet/ruflo)
- **`smtg-ai/claude-squad`** (~8.3k) — terminal multiplexer for many agents, *"each task gets its own
  isolated git workspace, so no conflicts,"* plus review-before-apply. *Steal:* worktree-per-task as
  the default isolation unit, and a human gate between "agent finished" and "changes land."
  (github.com/smtg-ai/claude-squad)
- **`raine/workmux`** (~2.2k) — git worktrees + tmux windows, per-worktree Claude Code settings.
  *Steal:* per-worktree settings files, so each worker gets a different permission/tool profile with
  zero orchestration code. (github.com/raine/workmux)
- **`Enderfga/claw-orchestrator`** (~550) — wraps Claude Code, Codex, Cursor, OpenCode as persistent
  programmable sessions; multi-agent "councils"; Planner/Coder/Reviewer loops; exposes itself as an
  MCP server and an OpenAI-compatible endpoint. *Steal:* making the orchestrator itself an MCP
  server, so any agent can drive it — that's exactly the `createSdkMcpServer` shape.
  (github.com/Enderfga/claw-orchestrator)
- **`bobmatnyc/claude-mpm`** (~150) — project-manager framing: a PM agent over specialized agents,
  session management, semantic code search, explicit headless/SDK mode. *Steal:* treating the
  coordinator as a *project manager over a ticket board* rather than a dispatcher over a queue —
  state lives in tickets, agents are stateless. (github.com/bobmatnyc/claude-mpm)
- **`andyrewlee/awesome-agent-orchestrators`** (~1.5k) — the catalogue; useful for surveying the
  long tail (multi-agent-shogun, orc, ORCH, dmux, polydev).
  (github.com/andyrewlee/awesome-agent-orchestrators)

The convergent finding across all of them: **nobody's differentiator is the LLM plumbing.** It's
isolation (worktrees), visibility (tmux panes / TUI), and the human review gate. The orchestration
logic itself is small.

---

## Minimum viable harness

**Answer: roughly 40–60 lines of TypeScript for a working coordinator that spawns a coder session
with a chosen model, watches it, and reads its result. Under 15 lines of bash if you accept
polling and no live steering.**

The reason it's this small: `createSdkMcpServer` + `query()` means the "spawn a worker" tool is just
a nested `query()` call inside a tool handler, and the SDK already does session persistence, result
capture, and transcript storage for you. You are not writing a scheduler; you are writing one
function and handing it to the model.

### The bash floor (~12 lines)

```bash
#!/usr/bin/env bash
# dispatch.sh — spawn a coder, capture id + result. No SDK.
set -euo pipefail
task_id="${1:?task id}"; model="${2:-sonnet}"; prompt="${3:?prompt}"
out="$HOME/.harness/$task_id"; mkdir -p "$out"

claude -p "$prompt" \
  --model "$model" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Bash(git *),Bash(pnpm *)" \
  --max-turns 40 \
  --output-format json \
  --json-schema '{"type":"object","properties":{"summary":{"type":"string"},"files":{"type":"array","items":{"type":"string"}},"done":{"type":"boolean"}},"required":["summary","done"]}' \
  > "$out/result.json"

jq -r '.session_id' "$out/result.json" > "$out/session_id"   # resume this worker later
jq   '.structured_output' "$out/result.json"                  # what the coordinator reads
```

Resume that worker at any time, from any directory:
`claude -p "now add tests" --resume "$(cat ~/.harness/$task_id/session_id)"`.

That is the whole contract: **`--output-format json` gives you `session_id` + `result`;
`--json-schema` gives you a typed verdict; `--resume` gives you continuity.** Everything else is
ergonomics.

### The SDK version (~50 lines) — coordinator with a real `spawn_coder` tool

```ts
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";

const workers = new Map<string, { model: string; sessionId?: string }>();

const spawn_coder = tool(
  "spawn_coder",
  "Run a coder agent on an isolated task. Returns its session id and structured result.",
  {
    task_id:   z.string(),
    objective: z.string().describe("objective, done-criteria, and the files this agent owns"),
    model:     z.enum(["haiku", "sonnet", "opus"]).default("sonnet"),
    cwd:       z.string().describe("worktree path this agent owns"),
    max_turns: z.number().default(40),
  },
  async ({ task_id, objective, model, cwd, max_turns }) => {
    let sessionId: string | undefined;
    let result = "";

    for await (const m of query({
      prompt: objective,
      options: {
        model, cwd, maxTurns: max_turns,
        systemPrompt: { type: "preset", preset: "claude_code" },
        permissionMode: "acceptEdits",
        allowedTools: ["Read", "Edit", "Write", "Bash(git *)"],
        disallowedTools: ["mcp__harness__*"],          // workers cannot spawn siblings
        outputFormat: { type: "json_schema", schema: {
          type: "object",
          properties: { summary: { type: "string" }, files: { type: "array", items: { type: "string" } }, done: { type: "boolean" } },
          required: ["summary", "done"],
        }},
      },
    })) {
      if (m.type === "system" && m.subtype === "init") sessionId = m.session_id;
      if (m.type === "result") result = JSON.stringify(m);   // ← watch: log every message here
    }

    workers.set(task_id, { model, sessionId });
    await mkdir(`${process.env.HOME}/.harness/${task_id}`, { recursive: true });
    await writeFile(`${process.env.HOME}/.harness/${task_id}/result.json`, result);
    return { content: [{ type: "text", text: result }] };    // coordinator sees only this
  },
);

const harness = createSdkMcpServer({ name: "harness", version: "1.0.0", tools: [spawn_coder] });

for await (const msg of query({
  prompt: process.argv.slice(2).join(" "),
  options: {
    model: "opus",
    mcpServers: { harness },
    allowedTools: ["mcp__harness__spawn_coder", "Read", "Glob", "Grep"],
    systemPrompt: { type: "preset", preset: "claude_code",
      append: "You are a coordinator. Do not edit files yourself. Delegate via spawn_coder with an objective, done-criteria, and explicit file ownership. Effort scaling: trivial fix = 1 agent; feature = 2-3 agents on disjoint paths; never more than 5." },
  },
})) {
  if (msg.type === "assistant") console.log(JSON.stringify(msg.message));
}
```

**LOC accounting:** ~12 lines of imports/glue, ~30 for the tool, ~15 for the coordinator loop. Call
it **55 lines** for the version above, **~40** if you drop the on-disk mirror and the worker map.
The bash floor is **12**.

**What the next 200 lines buy you**, roughly in order of value for a solo user on one Mac:

1. Git worktree creation/teardown per `task_id` (~30 lines) — the isolation everyone converged on.
2. `hooks: { PreToolUse: [...] }` enforcing declared file ownership (~25 lines) — remember this
   cannot be `canUseTool`, since auto-approved calls skip it.
3. Per-task JSONL of every `SDKMessage` (~10 lines) — makes non-deterministic failures diagnosable.
4. `maxBudgetUsd` + cost accumulation from `result` messages (~15 lines).
5. `background: true` agents + a `check_worker` / `stop_worker` tool pair so the coordinator stops
   blocking (~40 lines) — this is precisely the synchronous-bottleneck limitation Anthropic names in
   their own system.
6. Resume-by-task-id using `listSessions()` / `getSessionMessages()` instead of your own index
   (~20 lines).

**The honest bottom line:** the plumbing is a weekend. The coordinator's *prompt* — the effort table,
the dispatch contract, the "do not edit files yourself" rule — is the part that determines whether
the thing works, and it's the part Anthropic spent the most words on.
