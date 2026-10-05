---
dies-when: the cli's mcp-mirror decision is made and the Projects facts live in `docs/knowledge/claude-fleet-capabilities.md` (done for the facts 2026-10-05) — then this doc goes
---
Ticket: none

# Claude Code Projects (redesigned) vs our fleet, and Desktop Commander

three lanes, one brief (2026-10-05): exa agent (93 s, $0.10), parallel core (183 s), opus source lane (272 s, read the local app bundle + logs). all three agree on every vector; tags: verified = docs/changelog/local file, reported = user post, inferred = ours.

## what it is
- verified: announced 2026-09-17 ([projects redesigned](https://claude.com/blog/projects-redesigned)); a coordinator conversation scopes a goal, delegates to parallel threads, reviews, follows up; each thread a full cc session, own branch and repo copy; shared file memory + a Library ([docs](https://code.claude.com/docs/en/claude-projects))
- verified: beta for select Pro/Max with cloud-session use and NO existing chat/Cowork projects; claude.ai/code, desktop Code tab, mobile; not CLI or IDE ([help center](https://support.claude.com/en/articles/9517075-what-are-projects)). legacy chat/Cowork projects stay as they are until migrated · correction (dima, 2026-10-05): he has the redesigned Projects — his read «threads look like Cowork, not cc» vs the docs' «full cc cloud sessions» is open, settled by a coordinator system report
- verified: coordinator opus low, threads opus high; 200 new threads a day; plan limits, burns faster
- verified: Cowork + chat merged into one Claude app on 2026-09-16; the plugin portal 09-25; MCP 2026-07-28 («MCP 2.0») + MCP Apps in chat — none of these touches a project coordinator

## the link to cc
- verified: a self-started session (terminal, `--bg`, desktop local) cannot be added to a project; a cloud session can be moved in
- verified: «Work locally» (announced 09-24) runs a thread as a Remote Control session in a connected folder (cc ≥ 2.1.280); it gets the mac's MCP, hooks, settings and the instructions, not the project memory
- reported: real local sessions as threads requested, no roadmap answer ([claude-code#99156](https://github.com/anthropics/claude-code/issues/99156)); `create_session` missing from Remote Control sessions since ~09-18, coordinators unable to start local sessions since 10-03 ([claude-code#98059](https://github.com/anthropics/claude-code/issues/98059))

## comms
- verified: the coordinator routes and sees reports only; a thread replies once, when done; the user steers a thread by opening it; no public api / tool surface
- verified: memory = files, `MEMORY.md` index read at every cloud-thread start, editable in project settings; instructions cap 16k chars
- shape vs ours: same coordinator → thread hub; ours adds peer messages (coder ↔ verifier), mid-run pings and a written board; theirs adds a cloud default and auto-routing of follow-ups

## Desktop Commander
- verified (local logs): DC is healthy — two live processes, `LocalMcpServerManager` «Connected (26 tools)», installed as `desktop-commander@synced`; `localMcpBridge` advertises it and `x-cw` to the device bridge
- verified (docs): the coordinator has no connectors at all; cloud threads get claude.ai connectors + one repo's `.mcp.json`; a local stdio server never reaches them → the coordinators' «DC fails» is the execution boundary, not a regression (the match is inferred)
- doors: a «Work locally» thread; DC's remote MCP mode (`npx @wonderwhy-er/desktop-commander@latest remote`) as a claude.ai connector — threads only, untested
- reported traps: [claude-code#97924](https://github.com/anthropics/claude-code/issues/97924) threads merged PRs on red ci and ignored `AGENTS.md`, 4 reverts; [claude-code#99274](https://github.com/anthropics/claude-code/issues/99274) a cloud thread ignored permission rules

## not known
- whether a coordinator can ever be tied to a device (and reach `localMcpBridge`) · the cloud tool-count cap value (`{toolLimit}`) vs DC's 26 · the migration date for accounts with legacy projects · whether #98059 is a bug or by design · `claude remote-control --spawn worktree` unprobed (agent shell is not signed in to Remote Control)

## what it means for the cli's mcp mirror
- a stdio mirror inside the existing `x-cw` server reaches Cowork tasks tied to this mac (the bridge advertises x-cw's 13 tools), never a project coordinator and never a cloud thread; those reach the mac only through a remote MCP connector or a «Work locally» thread. the mirror question becomes «x verbs in x-cw (cw only), a remote MCP (everyone, a public endpoint to the mac), or none» — decided in the cli plan
