---
dies-when: dima's verdict on adopt / trial / borrow / skip is acted on
---
Ticket: none

# vibe-kanban: alive? usable? adopt or borrow?

Checked 2026-11-15, repo HEAD `3f095f01`.

**Verdict: borrow-only.**
- Alive but in hospice. bloop shut down on 2026-04-10. Releases stopped for about 7 months, then one maintainer (an ex-bloop dev) shipped v0.1.46 today. There is no community roadmap.
- Usable on macOS with `npx vibe-kanban`. It drives the real Claude Code CLI with the subscription login. Since 2026-11-12 it sends no analytics.
- It clashes with all three of Linear, our worktree/PR tooling and herdr. It would sit as a second tracker and a second worktree owner, in a browser tab.
- Borrow: (1) inline diff comments sent back to the lane, (2) the stream-json + `--permission-prompt-tool=stdio` approval bridge, (3) the "orchestrator mode" MCP toolset.

## 1. Alive?

- **Who maintains it.** The repo is still `BloopAI/vibe-kanban`: not archived, 28,698 stars, 3,063 forks, Apache-2.0 (`gh api repos/BloopAI/vibe-kanban`, 2026-11-15).
  - 13 of the 22 commits in the last 60 days are by `anastasiya1155` (Anastasiia Solop, GitHub company "@BloopAI"). The other 9 are from first-time outside contributors.
  - Source: commits since 2026-09-16 (`gh api repos/BloopAI/vibe-kanban/commits?since=…`, 2026-11-15) and the [v0.1.46 notes](https://github.com/BloopAI/vibe-kanban/releases/tag/v0.1.46.1794744340) (2026-11-15).
  - So it is one ex-bloop maintainer plus drive-by PRs. There is no visible community org.
- **Cadence.** Before the shutdown it released almost daily: about 40 tags in March–April 2026 ([releases](https://github.com/BloopAI/vibe-kanban/releases)).
  - Last bot release: `v0.1.44-20260424091429` (2026-04-24).
  - Then only 7 commits between 2026-04-24 and 2026-09-16 (commits API, 2026-11-15).
  - Last 60 days: bursts on 09-16..09-19 (9 commits), 10-26..10-28 (3), 11-03 (1) and 11-09..11-15 (9). v0.1.45 was only a version bump (PR #3462, 2026-09-19). v0.1.46 shipped 2026-11-15 and is on npm the same day (`npm view vibe-kanban`, 2026-11-15).
  - Releases now come from a local script (`3f095f01`, "Release from a local script to GitHub Releases and npm", PR #3507). CI/bot publishing is gone.
- **Issues.**
  - 382 open issues and 152 open PRs.
  - New issues per 30 days: 6 (09-16..10-15), then 7 (10-16..11-15). Closed in the same windows: 2, then 11. Source: GitHub search API, 2026-11-15.
  - Low traffic, with a small cleanup this month. The backlog is mostly untouched.
- **Wind-down statement.** From the [shutdown post](https://www.vibekanban.com/blog/shutdown) by Louis Knight-Webb, 2026-04-10. These are verbatim fragments; the fetch tool would not return the full text:
  - "Today we're shutting down bloop, the company behind Vibe Kanban."
  - "The Vibe Kanban project will live on, open source and community maintained."
  - "We'll release a roadmap for the community maintained edition over the next few weeks."
  - Remote services stayed up for 30 days, "after which Vibe Kanban will transition to a fully local architecture". The services removed are cloud issues, comments, projects and orgs. "local workspaces will continue to function."
- **Site and README banner:** "Vibe Kanban is sunsetting. The project will continue as open source and community maintained." ([vibekanban.com](https://www.vibekanban.com/), [README](https://github.com/BloopAI/vibe-kanban/blob/3f095f01/README.md), 2026-11-15).
- **Promised roadmap.** I found none. The 5 newest Discussions (2026-08-16..2026-11-12) are user posts, and a search for "roadmap community" in issue titles returned nothing (2026-11-15). Not published «?».
- **Future.** It is a local-only tool with one part-time maintainer. Expect agent-version bumps (Copilot/ACP, Codex) rather than new features.

## 2. Usable?

- **Install on macOS.** Log in to the agent first, then run `npx vibe-kanban` ([README](https://github.com/BloopAI/vibe-kanban/blob/3f095f01/README.md), [docs/claude-code](https://vibekanban.com/docs/agents/claude-code.md), 2026-11-15).
  - Rust backend with a web UI on localhost (`HOST` defaults to `127.0.0.1`, README env table).
  - There is a `tauri-app` crate for a desktop build (repo tree @3f095f01). Whether it ships as a release asset is unverified «?».
- **Drives Claude Code with the subscription login.**
  - It runs the real CLI, `npx -y @anthropic-ai/claude-code@2.1.119`, with `--output-format=stream-json --input-format=stream-json` and `--permission-prompt-tool=stdio` (`crates/executors/src/executors/claude.rs:65,168,190` @3f095f01).
  - The version pin is old next to the current CLI. A `base_command_override` exists (`claude.rs:150`).
  - It uses whatever login `claude` already has. If `ANTHROPIC_API_KEY` is set, it warns: "Usage will be billed via Anthropic pay-as-you-go instead of your Claude subscription". A `disable_api_key` option strips the key (`claude.rs:650-653,928`).
  - It also drives Codex, Gemini, Copilot, Amp, Cursor, OpenCode, Droid, Qwen and CCR (README; `executors/` dir).
- **Worktree per task.**
  - Each "workspace" gives the agent "a branch, a terminal, and a dev server" (README).
  - Worktrees go under the app temp dir in `…/worktrees`, or under `<override>/.vibe-kanban-workspaces` (`crates/worktree-manager/src/worktree_manager.rs:511-523`).
  - It runs automatic orphan/expired cleanup, which `DISABLE_WORKTREE_CLEANUP` turns off (README env table).
- **Review flow.**
  - A human review loop: diff panel, inline comments, "send the agent back to address them" ([docs/reviewing-code](https://vibekanban.com/docs/reviewing-code.md), 2026-11-15).
  - PRs get AI-written descriptions, and `pr_monitor.rs` watches them (README; `crates/services/src/services/pr_monitor.rs`).
  - It has no agent-on-agent review step. The separate `review` CLI uploads code to `https://api.vibekanban.com` ("code is uploaded to and processed on Vibe-Kanban servers", `crates/review/src/main.rs:21,38`). That backend is presumably dead after the shutdown «?».
- **MCP and CLI surface.**
  - It ships a `vibe_kanban_mcp` binary (`crates/mcp/src/bin/vibe_kanban_mcp.rs`).
  - Global mode has tools for workspaces, repos, issues, tags, relationships, task attempts and sessions. "Orchestrator mode" is only context + workspaces + sessions (`crates/mcp/src/task_server/tools/mod.rs:50-67`).
  - `start task attempt` takes an executor (`CLAUDE_CODE`, `CODEX`, …) and an optional issue ID (`tools/task_attempts.rs:25-40`).
  - It can also install agents from the ACP registry (PR #3489, 2026-11-10).
- **Where data lives.**
  - Local SQLite plus config, profiles and credentials under `ProjectDirs("ai","bloop","vibe-kanban")`, i.e. `~/Library/Application Support/ai.bloop.vibe-kanban` (`crates/utils/src/assets.rs:24-43`; the exact macOS path is inferred from the `directories` crate «?»).
  - Cloud kanban issues were removed after the shutdown (blog). Self-hosting the cloud via Docker is still documented (README).
- **Phone home.**
  - Until 2026-11-12 it sent PostHog and Sentry data. Issue [#3482](https://github.com/BloopAI/vibe-kanban/issues/3482) (2026-10-21) found that logging in turned telemetry back on and sent the user's email to PostHog.
  - PR [#3503](https://github.com/BloopAI/vibe-kanban/pull/3503) (merged 2026-11-12, shipped in v0.1.46) hard-disables both in code.
  - Release builds clear the `POSTHOG_*`/`SENTRY_*` keys (`.env.release.example`). They still point `VK_SHARED_API_BASE` at `https://api.vibekanban.com` for login and remote features, and the relay is "sunset" (same file).
  - What that endpoint still does is unverified «?». Use v0.1.46 or later only.

## 3. What it has that the fleet lacks, and what clashes

Its best ideas:
1. **Inline diff comments routed back to the running agent.** You comment on a line, and the comment becomes the next turn in the same session ([docs/reviewing-code](https://vibekanban.com/docs/reviewing-code.md)). Our second-session reviewer writes PR comments, but nothing feeds line comments straight back into the lane.
2. **A permission bridge over stream-json.** It runs Claude with `--permission-prompt-tool=stdio`, so approvals show up in its UI (`claude.rs:168`). It is also a clean model for turning herdr "asks" into tool approvals.
3. **Agent-agnostic executors.** One task can be retried with Codex, Copilot and others through a profile or the ACP registry (`executors/`, PR #3489). This is cheap second opinions per lane.
4. **Dev server and preview browser per workspace,** with devtools and inspect mode (README; [llms.txt](https://www.vibekanban.com/docs/llms.txt)). Lanes have no standard "run the app for this worktree" step. Discussion [#3502](https://github.com/BloopAI/vibe-kanban/discussions/3502) (2026-11-12) shows parallel dev servers fighting over ports, so this is hard.
5. **An "orchestrator mode" MCP toolset.** A planner session gets only create/inspect workspace and session tools (`tools/mod.rs:64-67`). That is a small, reviewable tool surface for our coordinator.

Clashes:
- **Linear.** It has its own kanban; the cloud issues are gone and local issues remain. I found no Linear sync in the tree. This was a search of the repo file list, and an unlisted integration is possible «?». It would be a second tracker.
- **Our worktree/PR tooling.** It owns worktree paths and auto-cleans "orphan" worktrees (`worktree_manager.rs:230-260`, README). It would fight lane scripts for the same repo's `.git/worktrees`. It also opens PRs itself.
- **herdr.** It is a browser UI on localhost that captures the agent's stdio as JSON, so lanes would no longer be interactive TUI sessions herdr can watch. Progress cards, ticked asks and the chat view would all be duplicated.
- **Risk.** One maintainer, a pinned Claude Code version, and a dead backend behind login.

## 4. Verdict: borrow-only

Adopting it means giving up Linear-driven lanes and herdr, for a tool one ex-bloop developer patches in bursts. A trial would only confirm the clashes above. Borrow these:
1. **Review-comment-to-lane loop.** The reviewer session (or dima) leaves line comments, and a herdr action sends them as the next prompt to that lane's session, with file:line attached. Model: [docs/reviewing-code](https://vibekanban.com/docs/reviewing-code.md).
2. **Approval bridge.** Run lane sessions with `--permission-prompt-tool` pointed at an MCP tool that posts to herdr asks and blocks until ticked. Model: `claude.rs:160-200` @3f095f01.
3. **Orchestrator-scoped tools.** Give the coordinator a minimal "start lane / read lane status / message lane" tool set. Model: `crates/mcp/src/task_server/tools/mod.rs:64-67`.
<!-- end -->
