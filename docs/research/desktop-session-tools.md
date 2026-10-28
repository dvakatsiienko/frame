---
dies-when: folded into x:crew-lead's references/spawn-mechanics.md
---

Ticket: none

# the desktop app's session tools — arrival and mechanics

Researched 2026-10-28. Desktop app here: 4.29.0 (`defaults read /Applications/Claude.app/Contents/Info.plist CFBundleShortVersionString`, 2026-10-28).

## Answer

- No public note dates these tools. The desktop release notes and the Claude Code docs never name `start_session`, `spawn_task` or `ccd_session`.
- From local evidence, `start_session` + `hand_off_to_session` replaced the older `spawn_task` chip between 2026-10-05 and 2026-10-15, under a feature called "side sessions".
- Started sessions are native Code-tab sessions, not `--bg` sessions.
- No doc says `--bg` sessions draw plugin UI in the desktop app.

## 1. Arrival

### Public sources (none name the tools)

- Desktop release notes (https://support.claude.com/en/articles/12138966-release-notes, fetched 2026-10-28; newest entry 2026-10-21):
  - no entry names session tools, side sessions, `spawn_task` or `start_session`;
  - entries carry dates, not app version numbers.
- Desktop docs (https://code.claude.com/docs/en/desktop.md, fetched 2026-10-28) describe the behaviour without naming tools or dates:
  - "Work across sessions" (lines 483–497): list, read, message and archive other sessions;
  - "Start a task that Claude suggests" (lines 499–508): Start / Do it here / Options / Start all cards.
- `rg -n 'start_session|spawn_task|wake'` on that page: no hits for the tool names.
- Not checked: Anthropic news pages. Their silence is likely (inference) but unconfirmed «?».

### Older name: `spawn_task` ("task chip" / "Suggested task")

- GitHub issues show it in use from July 2026 at the latest:
  - #82683, 2026-07-30: "spawn_task chips inherit the spawning session's pinned model" (https://github.com/anthropics/claude-code/issues/82683)
  - #80238, 2026-07-22: remove the "Suggested task" chip (https://github.com/anthropics/claude-code/issues/80238)
  - #76372, 2026-07-10: built-in desktop MCP schemas (https://github.com/anthropics/claude-code/issues/76372)
  - Ship date unknown «?».
- Local transcripts name `mcp__ccd_session__spawn_task` from 2026-09-09 (first: `-Users-dima-frame-cclio/5b50c48d-….jsonl`) to 2026-10-14 (last: `a88a268f-…/subagents/agent-affa2d93a9c298672.jsonl`).
  - Method: `rg -l` over `~/.claude/projects/**/*.jsonl`, dated by each file's first `timestamp`. Run 2026-10-28.

### `ccd_session_mgmt` (list / get / send / stop / archive …)

- Present by 2026-10-05:
  - `~/.claude/projects/-Users-dima-frame-cclio/d6bf9215-d3a5-4867-8d58-c01ed73050c2.jsonl` line 920 is a tool-list `attachment` (timestamp 2026-10-05T11:34:59Z, CLI `version` 2.1.286, `entrypoint` `claude-desktop`).
  - It carries real schemas for `mcp__ccd_session_mgmt__list_sessions` and `mcp__ccd_session_mgmt__stop_session`.
- In that file, `start_session` appears only inside those descriptions ("A linked session (one Claude started from another with start_session, or a linked fork)…").
  - It is not a tool entry there. Check: `rg -n 'start_session' <file> | head`.
- The desktop log `~/Library/Logs/Claude/main3.log` (last written 2026-10-15) lists `'ccd_session'` and `'ccd_session_mgmt'` at lines 158–159 (`rg -n -m3 'ccd_session'`).
  - Older logs have rotated away.

### `start_session` / `hand_off_to_session` (plus `list_start_targets`)

- First local tool list: `-Users-dima-frame-cclio/cf0b9766-5a48-4af8-9210-01ba31e18809.jsonl` line 29.
  - It is an `attachment` dated 2026-10-15T10:56:05Z, CLI 2.1.295.
  - Tools listed: `mcp__ccd_session__start_session`, `hand_off_to_session`, `list_start_targets`, `mark_chapter`.
- From 2026-10-15 on, no transcript has `spawn_task` as a tool. The three files after that date which match both names only mention them in text (timeline run 2026-10-28).
- Issue #104205 (2026-10-22, desktop 3.1623.1, CLI 2.1.304) confirms the swap (https://github.com/anthropics/claude-code/issues/104205): "Before side sessions shipped, a Desktop session could post a `spawn_task` chip with a `cwd` … With side sessions on, `spawn_task` is gone".
  - It names a server flag: `bootSideSessions.supported: true`. So this may be a per-account rollout, not one app release (inference).
- Issue #102625 (2026-10-16) dates the new behaviour to "a recent Claude Code desktop update" and counts 46 sessions on 2026-10-15 (https://github.com/anthropics/claude-code/issues/102625).
- Version numbers disagree:
  - #104205 gives the desktop app as 3.1623.1 (2026-10-22);
  - this Mac reports 4.29.0 (2026-10-28).
  - The tie between desktop version and shipped tool cannot be pinned down «?».
- The live process today still allows the old name:
  - pid 4165 started 2026-10-28 13:45 on CLI 2.1.309 (`ps -o lstart=,command= -p 4165`);
  - its `--allowedTools` includes `mcp__ccd_session__spawn_task`, `dismiss_task`, `mark_chapter` and mgmt `list_sessions`, `get_session`, `get_usage`, `set_session_title`, `send_message`, `detach_session`, `search_session_transcripts`;
  - `start_session` is not in it.
  - Inference: the allow-list is a stale pre-approval list. `start_session` is held back for a prompt on purpose (see #104101 below).
- Not found as tools in any source I opened: `set_session_model`, `set_session_output_style`, `clear_session`, `archive_session`, `list_events` «?».
  - `archive_session` is only named in the `list_sessions` text (10-05).

## 2. How it works

### What a started session is

- A native Code-tab session, not a `--bg` one:
  - "a real session the user can open, talk to and stop, shown as a row here" (`start_session` instructions, cf0b9766 line 29, 2026-10-15);
  - "the sidebar lists the started session under the current session" (desktop.md line 503, 2026-10-28).
- `--bg` sessions are a CLI feature run by the CLI's own supervisor and seen through `claude agents` (https://code.claude.com/docs/en/cli-reference.md line 76; agent-view.md).
- Desktop's cross-session surface "doesn't see … sessions you started from the terminal CLI" (desktop.md line 489).

### `initiation` (cf0b9766 line 29)

- `offer`: a card asking "New session" or "Do it here". The call waits for the answer.
- `user_asked`: starts now.
- `own_initiative`: a card the user may start.
  - It expires after a week; at most three per turn.
  - On a turn that another session's message or an automated event started, "the app refuses a start: propose instead".
- `user_asked` and `own_initiative` need a `prompt`.

### `context`

- `fork` passes the whole conversation.
- `fresh` needs `background` of at least 80 characters (same source).

### Where it runs

- `use_worktree: false` in a worktree session runs inside the parent's worktree, branch and PR, "archived with it".
- `cwd` / `host` (`target: "ssh"`) / `preset` / `environment` work only "when the user names the place". Names come from `list_start_targets` (same source).
- Proposal cards refuse every place: "A proposal card cannot carry a host, folder, environment or preset" (#104205, 2026-10-22).
- Issue #105594 (2026-10-28): `start_session` cannot target Windows SSH hosts (https://github.com/anthropics/claude-code/issues/105594).

### Linking

- `list_sessions` rows of a linked session carry `name` and `startedBy`. `{"linked": true}` lists only "your own family".
- `permissionMode` is reported only for sessions this session started (d6bf9215 line 920, 2026-10-05).

### Notes back and `wake_when_done`

- On every turn end, the parent gets a note "quoting the first 400 characters of its latest report (its wrap-up recap, then its final message); a cloud session sends none" (cf0b9766 line 29).
- Issue #104683 (2026-10-23) says the parent wakes "whether or not `wake_when_done` is set" (https://github.com/anthropics/claude-code/issues/104683).
  - So the flag's effect is unclear «?».
  - `detach_session` stops the relay but removes nesting, cannot be undone, and is refused for forks and chips (same issue).
- Duplicate notes are reported in #103172 (2026-10-18).

### Cloud

- `target: "cloud"` only for new work the user asked to run in the cloud.
  - It starts from the parent's pushed branch, else the default branch.
  - "No note comes when it ends, so `wake_when_done` is ignored" (cf0b9766 line 29).
- The parent gets no reply channel (#104160, 2026-10-22, https://github.com/anthropics/claude-code/issues/104160).
- The docs' cross-session surface "doesn't see cloud sessions" (desktop.md line 489).

### Stop

`stop_session` (d6bf9215 line 920, 2026-10-05):

- "Interrupt another CCD session's in-flight turn — the same as the user pressing Stop there. The session stays open and idle afterwards."
- Not for the calling session.
- Idle, starting or archived sessions are left alone.
- Prompts:
  - "Usually no prompt when the target is a session this session started … for any other session the app asks the user first (in auto mode it may decide without asking; in bypass permissions mode it does not ask)".
  - Admin or user permission rules can still require a prompt.

### Archive

- An approval card is shown, "except in Auto mode and Bypass permissions mode" (desktop.md line 495).
- Archived sessions cannot receive messages (line 491).
- Archiving can discard worktree changes (lines 444–450).

### Messages

- Shown as a card attributed to the sender.
- If the receiver is mid-task, the message is held until its current work finishes.
- Checked against the receiver's `crossSessionInbound`. The receiver keeps its own permission settings.
- Source: desktop.md lines 491–497.

### Start permission

- Since CLI 2.1.304, every `start_session` asks "Allow once", even in Bypass mode. Hooks and `permissions.allow` don't remove the prompt:
  - #104101, 2026-10-21 (https://github.com/anthropics/claude-code/issues/104101);
  - #103832, 2026-10-20 (https://github.com/anthropics/claude-code/issues/103832).
- Both are user reports, not docs.

## 3. `--bg` sessions and plugin «mods» UI in the desktop app

- Not documented. Expected answer confirmed: no.
- The desktop page has no `--bg` hit (`rg -n -- '--bg'` on desktop.md, 2026-10-28).
- agent-view.md has no "desktop" hit (`rg -i desktop` on agent-view.md, 2026-10-28). It only describes terminal attach rendering (line 244).
- Desktop's session surface excludes terminal-CLI sessions (desktop.md line 489).
- Desktop plugin docs (desktop.md "Install plugins", line 602) cover installing plugins in local and SSH sessions only. They say nothing about background sessions.
- «mods» is a local plugin term, so no doc would use it (inference).

<!-- end -->
