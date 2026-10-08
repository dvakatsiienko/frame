# Claude fleet: capabilities, memory, who can operate whom

📌 **Do not delete — core coordinator knowledge.** The capability reference behind
`home/.claude/rules/fleet-identity.md`, which keeps only the lean charter and points here.

📌 Naming: **"harness" is reserved** for the home-baked-harness thread (FRM-43). Never use it for the
fleet.

⚠️ **Fragile knowledge. Edit carefully.** Little of this has an official source; it comes from
probes and Dima's observations, and some of it contradicts the docs. **Add verified or trusted
information only** — a plausible guess here is worse than a gap.

Claim tags: **[verified]** executed, not read · **[docs]** Anthropic docs only · **[observed]** seen
by Dima in the UI · **[?]** unknown. A dated tag is a probe on that day; anything older than the
surface's last big change says so.

Rewritten 2026-10-05: the cw-era (2026-08) probe sections were cut to what still holds; Cowork and
chat merged into one Claude app on 2026-09-16, so every cw-sandbox fact below is dated and unchecked
since.

## The surfaces

- **`cc`** — the cli on the mac. Loads everything: root `CLAUDE.md`, `rules/` (lazy ones via
  `memory-load-rule-lazy`), `plugin-x` skills, the project `AGENTS.md`, hooks, output style.
- **`cclio`** — a `cc` session booted in `~/frame/cclio`: the same, plus its `AGENTS.md`, the memory
  barrel and the boot ritual (`/cclio:boot <slug>`).
- **Code-tab sessions** — `cc` born in the desktop Code tab. Same stack, plus the desktop-only MCP
  servers (Browser pane, Chrome bridge, scheduled-tasks, mcp-registry), injected **once at creation**,
  never for terminal-born, `--bg` or `--remote-control` sessions, not on resume **[verified
  2026-09-03]** ([docs](https://code.claude.com/docs/en/desktop.md),
  [claude-code#37284](https://github.com/anthropics/claude-code/issues/37284)). A local thread follows
  the desktop's bundled cc, which can lag the terminal's (2.1.286 vs 2.1.289 on 2026-10-05).
- **`cc cloud`** — `claude --cloud` on an Anthropic VM: no `~/.claude`, no `plugin-x`, the repo's
  `AGENTS.md` only. Procedure: `x:crew-cloud`.
- **Claude Code Projects** — a coordinator plus threads; see [Projects](#projects).
- **`cw`** — the Claude app's cowork side (merged with chat 2026-09-16). Gets the `x-cw` plugin, whose
  skills are symlinks into `plugin-x`; no `rules/`, no hooks, no output styles, no root `CLAUDE.md`
  **[verified 2026-08-15]**. What `plugin-x` defers to a rules file reaches it another way:
  `linear-flow.md` is symlinked into the plugin root and `x-cw__pm_guide` inlines it.
  - from iOS/iPadOS, every thread type reaches the `x` skills even with the desktop app closed;
    `--remote-control` sessions are usable from the phone **[verified by Dima, 2026-08-26]**

## Memory, per surface

- `cc` — file-based: `~/.claude/projects/<slug>/memory/` + `MEMORY.md`; cclio's barrel lives in
  `~/frame/cclio/memory/`. Agent + Dima edit.
- `cw` — global memory entries the agent writes through `memory_write` / `memory_str_replace` /
  `memory_append` / `memory_delete`; every write goes through `x-cw:memory-update` **[docs: the
  skill]**. Larger context still arrives through handoff CSTs.
- `cc cloud` — none of its own.
- Projects — a file mount (`/tmp/claude/memory/team/silo`, `MEMORY.md` index) read by cloud threads
  only; a local thread never sees it **[verified 2026-10-05]**.

## Who can spawn or operate whom

- **Dima** — anything.
- **`cc` / cclio** — local sessions and worktrees; `claude --bg` coders (take model and effort, survive
  a coordinator reset); `/fork`; **cloud sessions** via `claude --cloud` wrapped in `script` (it refuses
  a non-tty) **[verified, `x:crew-cloud`]**; subagents through `Agent` (no effort flag — an agent file's
  `effort:` pins it, e.g. `home/.claude/agents/helper.md`).
  - messaging: `SendMessage` reaches local, `--bg` and Code-tab sessions both ways; a cloud session
    takes a steer only as `claude -p "<msg>" --cloud <id>` and cannot message back.
- **a Projects coordinator** — threads only (cloud, or «Work locally» on the mac); it cannot reach the
  mac itself.
- **`cw`** — some sessions expose `start_code_task` (a local `cc` with worktree isolation), others do
  not **[verified 2026-08-15]**; never assume a capability from another session's report.

## Projects

📌 **two products share the name since 2026-09-17** (sources: [projects docs](https://code.claude.com/docs/en/claude-projects), [launch post](https://claude.com/blog/projects-redesigned); reported traps: [claude-code#98059](https://github.com/anthropics/claude-code/issues/98059) `create_session` missing from Remote Control sessions, [claude-code#97924](https://github.com/anthropics/claude-code/issues/97924) threads merged on red ci and ignored `AGENTS.md`).

- **Claude Code Projects (redesigned, public beta, Pro/Max, gradual)** — one coordinator conversation
  (opus, low effort) splits a goal into threads (opus, high effort); each thread is a full cc session
  on its own branch, cloud by default. claude.ai/code, the desktop Code tab, mobile — never the CLI.
  200 new threads a day; plan limits. Dima has it (2026-10-05).
- **probed from inside** (the «engineering» project's own system report, 2026-10-05):
  - coordinator and cloud threads are **real cc 2.1.289** in an Anthropic Firecracker VM (Ubuntu 24.04,
    4 vCPU, 15 GiB, root, opus 5.5 1m, medium, auto mode)
  - a «Work locally» thread is the desktop's bundled cc on the mac as `dima` in `~/frame`: boots our
    whole stack and runs `x`, `linear`, `gh`, `op` natively; no project memory
  - the harness differs: plain text reaches nobody, only `mcp__hearthbot__*` calls travel (a stop hook
    enforces it); the coordinator has no Bash/Read/Write and works through subagents; threads cannot
    start threads
- **who reaches the mac:** a cloud thread does, through the desktop device bridge —
  `mcp__remote-devices__plugin_desktop-commander_…__start_process` ran zsh as `dima` (the app must be
  open). the coordinator does not: its only Desktop Commander is a second copy inside the VM (same tool
  names, no `remote-devices` prefix — the name trap). cloud egress is an allowlist (github, npm, pypi;
  example.com 403).
- ⚠️ **the mac's Desktop Commander is a shell for every cloud thread.** `allowedDirectories` was narrowed
  to `~/frame`, `~/projects`, `~/.claude` and the vault (2026-10-05), but DC's own README says it
  restricts file tools only — `start_process` still runs anything not in `blockedCommands`.
- a session you start yourself (terminal, `--bg`, desktop local) cannot be added to a project; a cloud
  session can be moved in. Remote Control sessions do not show in the Code-tab sidebar.
- **shared memory across projects = the claude.ai profile instructions** (the `<!-- sync: cw -->` sections, `pnpm memory-sync:copy`): a coordinator and its threads read them, as a snapshot at session start — a new thread sees a paste at once, a running coordinator only after it is replaced **[observed by a coordinator, 2026-10-05]**
- **the fleet cli in a project:** no MCP mirror (decided 2026-10-05) — a cloud thread runs `x` through
  the `remote-devices` DC shell, a local thread runs it natively, the coordinator routes to a thread.

### Cowork and chat projects (legacy)

[docs + verified 2026-08-15, unchecked since the 09-16 merge]

- a Cowork project bundles a description, folders, standing instructions, reference links, linked
  claude.ai projects and a project-scoped memory; **archiving deletes that memory** (folders on disk
  stay)
- a Cowork project and a chat project overlap partially: Cowork holds local folders and project memory,
  chat holds a RAG knowledge base shareable on Team/Enterprise; a chat project can be linked into a
  Cowork project
- a dragged file is copied into the first folder, a dragged folder is mounted; reads cap at 50 MB
- projects sync across mac and iOS despite the docs saying «stored locally» **[verified by Dima]**;
  the attached local folders stay mac-only

## Desktop Commander

- installed as the synced plugin `desktop-commander@synced` (not a desktop extension); the app's
  `localMcpBridge` advertises its 26 tools and `x-cw`'s 13 to the device bridge **[verified
  2026-10-05]**
- config: `~/.claude-server-commander/config.json`, read and written by DC's own `get_config` /
  `set_config_value`; the README says to change it from a separate chat, because an agent blocked by
  a restriction may try to lift it
- `allowedDirectories: []` means the whole file system

## The two cloud VMs — do not confuse them

[verified 2026-08-15 unless dated]

- **the cw sandbox** — Ubuntu 22.04 aarch64, 4 vCPU, 3.8 GiB; node 22, npm, python 3.10, git, jq, rg;
  no pnpm, gh, docker. `/sessions` persists across bash calls. folders are bind-mounted from the mac
  (a write is instantly visible on the mac) and are create/write but **not unlink** — delete through
  Desktop Commander. network: a fixed proxy allowlist (npm, github.com, pypi; api.github.com blocked);
  git clone yes, push never (no credentials). a scratchpad, not a coding environment.
- **the Claude Code cloud VM** (cloud sessions and Projects threads) — Ubuntu 24.04 x86_64, 4 vCPU,
  15–16 GiB, root; many toolchains incl. pnpm and docker; network levels None / Trusted / Full / Custom;
  git push works through a credential proxy. **`gh` is not preinstalled**; no secrets store (the docs
  say never to put keys in env vars).
  - the GitHub credential proxy is a separate gate from the allowlist: API and release-asset requests
    reach only repos attached to the session — `fnm`'s installer 403s, `nvm`'s works, and Full network
    does not help **[docs]**
  - from inside: `curl -sS "$HTTPS_PROXY/__agentproxy/status"` prints the proxy config and recent
    denials; the allowlist reloads live
- route clone-build-commit-push to a cc cloud session or a Projects thread, never to the cw sandbox

## Claude on disk

[distilled from the DOT-157 survey, 2026-08-19]

- two homes: `~/.claude` + `~/.claude.json` belong to the **cli**; `~/Library/Application
  Support/Claude/` is the **desktop**. The desktop embeds a cli, so a desktop-launched session writes
  into both.
- **slug rule**: a `projects/` dir is the cwd with `/` and `.` → `-`, so `claude --resume <uuid>` finds
  a session only from a directory that slugifies to its home. transcripts append per turn: kill and
  reattach is safe.
- `~/.claude.json` is **state, not config** — rewritten whole from memory; hand edits mid-session get
  clobbered.
- cc **refuses to write through a symlink** — resolve with `readlink -f`, edit the real file under
  `~/frame/home/.claude/`.
- `daemon/` is the reattach machinery (roster, control key, socket), never swept; deleting from
  `projects/` is permanent — that conversation and its `--resume` are gone. growth-only stores:
  `session-env/`, `file-history/`, `projects/`, `paste-cache/`.
- 🚨 tool-written files under `~/.claude` can be world-readable (a plaintext github token sat in a stray
  mcp config, 2026-08-19): `grep -rn "ghp_\|sk-\|AKIA" ~/.claude` now and then.
- macos: `Caches` is disposable, `Application Support` is not; `com.apple.*` self-cleans, except
  `com.apple.TCC` (privacy grants) and `com.apple.wallpaper` (the wallpapers).
- **the desktop skill store is a managed cache** —
  `~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/<uuid>/<uuid>/skills/`,
  manifest `anthropic-skills`, uuid-keyed and re-materialised by the app; writing there cannot automate
  an upload, Dima drags skills in by hand ([FRM-77](https://linear.app/x-com/issue/FRM-77)). the
  «regenerated» read is inferred from mtime and manifest, never an overwrite test.

## 🚫 `CLAUDE_CONFIG_DIR` is rejected — never re-propose it for isolation

Undocumented, and it leaks four ways: `CLAUDE.md` loads from both the custom dir and the real
`~/.claude/`; plugin state stays in `~/.claude/plugins/`; a `.claude/` at or above the cwd overrides
the profile; credential paths are inconsistent. Isolation comes from the cli walking ancestor dirs
(tested with a marker) — directory layering, no env var.

## Scheduling

- **built-in `CronCreate` / `CronList` / `CronDelete`** — local scheduled sessions; listed in
  `permissions.deny` in `home/.claude/settings.json` **by Dima's choice** (still there, 2026-10-05).
- **`RemoteTrigger` + the `schedule` skill** — cloud routines on cron and webhook triggers; survive a
  closed laptop.
- **desktop scheduled tasks** — `{taskId}/SKILL.md` under `~/Claude/Scheduled/` (two exist on
  2026-10-05: `dispatch-notes-to-draft-tickets`, `weekly-health-updates`). cron in **local time**; each
  run starts with no memory, so the prompt is self-contained; runs only while the app is open, a missed
  one fires on next launch; `ended_reason` is authoritative over a stale `next_run_at`.
  - a device-bound task (`requires_local_device`) is UI-create-only: `create_trigger` fails with
    `no_signed_approval` **[verified 2026-08-28]** — a thread hands Dima the prompt in a copy fence.
- **plain `cron` + `claude -p`** — the transparent fallback, same self-contained-prompt rule.

## Power — why a bridge drops

- the root cause was a **1-minute system sleep on AC**; fixed: `pmset -g custom` reads AC `sleep 0`,
  battery `sleep 1` / `displaysleep 5` (checked 2026-10-05). keep the battery profile aggressive.
- the mac stays up only while something holds an assertion (Claude, Chrome audio, coreaudiod,
  `powerd` «display is on»); «the mac stayed awake» is never evidence that Claude ran.
- display sleep does not drop the bridge, but it hides Touch ID prompts — the 1Password signing hang.
- staying awake on AC costs no battery health (held at the 80 % limit, not cycling; 41 cycles, 96 %,
  2026-10-05). on battery it does.
- diagnostics: `pmset -g custom` · `pmset -g assertions` · `pmset -g log | grep "Entering Sleep state due to"`
- `caffeinate -d -t 1200` is the one-off escape hatch.

## Open questions

- whether the cloud-thread device bridge survives the desktop's device toggle being off
- the cloud tool-count cap (`{toolLimit}`) against Desktop Commander's 26 tools
- whether a Projects coordinator can ever be tied to a device
- why `start_code_task` is present in some cw sessions and absent in others
- the skill count is per surface: about 60 in the cli, 106–113 in the desktop (2026-10-05, FRM-305); a transcript's `skill_listing` attachment is the exact roster, built-ins included
