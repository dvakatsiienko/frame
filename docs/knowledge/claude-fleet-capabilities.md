# Claude fleet: capabilities, memory, who can operate whom

📌 Naming: **"harness" is reserved** for the home-baked-harness thread (DOT-43). Never use it for
the fleet, or the three-way term collision that was just cleaned up comes back.

📌 **Do not delete — core coordinator knowledge.** The detailed capability reference behind
`home/.claude/rules/fleet-identity.md`, which keeps only the lean charter and points here.

⚠️ **Fragile knowledge. Edit carefully.** There is little to no official source for most of this.
It was assembled from self-inspection and Dima's own observations, and some of it contradicts the
published docs. **Add verified or trusted information only** — a plausible guess written here is
worse than a gap, because the next session cannot tell them apart.

Claim tags: **[verified]** executed, not read · **[docs]** asserted by Anthropic documentation
only · **[observed]** seen by Dima in the UI · **[?]** unknown.

Probed 2026-08-15 from a Cowork session in this repo's project; fleet sections added 2026-08-17.
This file supersedes the earlier assumption that cw is always a detached cloud sandbox.

## 🚫 `CLAUDE_CONFIG_DIR` is REJECTED — do not re-propose it as an isolation mechanism

Evaluated during the coordinator migration and rejected. It is undocumented and it leaks four ways:

- `CLAUDE.md` loads from **both** the custom dir and real `~/.claude/` at once
- plugin state stays pinned to `~/.claude/plugins/` regardless
- a `.claude/` at or above the cwd overrides the profile
- credential paths are inconsistent

What replaced it: **ccli walks arbitrary ancestor dirs** (tested with a marker, not assumed), so
directory layering does the isolation with no env var at all. The precedence chain lives in root
`CLAUDE.md`.

## The desktop skill store is a MANAGED CACHE

`~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/<uuid>/<uuid>/skills/`,
manifest `{"name": "anthropic-skills", …}`. It is uuid-keyed per install and its mtime moves when the
app runs, so it is materialised from the account side rather than being a source of truth. **Writing
files there cannot automate the upload** — Dima drags and drops by hand until an account-side channel
exists ([DOT-77](https://linear.app/x-com/issue/DOT-77)).

📌 The «regenerated» read is **inferred from the mtime and the manifest name**, never from an
overwrite test.

### What loads where

- `cc` cli — everything: `CLAUDE.md`, all `rules/`, `plugin-x` skills, project `CLAUDE.md`, memory.
- `cclio` — the same, plus `cclio/CLAUDE.md` and its own `memory/` barrel and boot ritual.
- `cc cloud` — no `~/.claude` config, no `plugin-x`, no Desktop Commander. Project `CLAUDE.md` only.
- `cw` — the `x-cw` plugin, whose skills are symlinks into `plugin-x`. No `rules/`
  mechanism, so what `plugin-x` defers to a rules file reaches it another way: `linear-flow.md`
  is symlinked into the plugin root, and `x-cw__pm_guide` inlines it on demand.
## Claude on disk — the durable facts (distilled from the DOT-157 survey, 2026-08-19)

Two homes, not variants of one thing: `~/.claude` + `~/.claude.json` belong to the **cli**;
`~/Library/Application Support/Claude/` is the **desktop/cowork** tree. The desktop app embeds a
copy of the cli, so a desktop-launched session writes into both at once.

- **slug rule**: a `projects/` dir is the cwd with `/` AND `.` → `-`. So **resume is
  cwd-sensitive** — `claude --resume <uuid>` finds a session only from a directory that slugifies
  to its home. The transcript is appended per turn, on disk before exit: kill-and-reattach is safe.
- `~/.claude.json` is **state, not config** — the cli holds it in memory and rewrites it whole;
  hand-edits mid-session get clobbered. `~/.claude/.claude.json` is a symlink back to it.
- cc **refuses to write through a symlink** — resolve with `readlink -f`, edit the real file under
  `~/frame/home/.claude/`.
- `daemon/` is the reattach machinery (roster, control key, socket) — live, never sweep.
  `focus/` is ours (sline pin). Deleting from `projects/` is safe but **permanent** — that
  conversation and its `--resume` are gone.
- growth-only stores to check first when `~/.claude` gets fat: `session-env/`, `file-history/`,
  `projects/`, `paste-cache/`, `focus/`. Everything except `plugins/` + `projects/` is ~12 MiB.
- cowork tree: `local-agent-mode-sessions/<account>/<install>/` — `spaces.json` (mounted folders),
  `agent/memory/` (the desktop agent's memory), `local_<uuid>/` per chat with its own **private `.claude`**;
  a folderless chat's whole world is its own `local_<uuid>/` dir.
- 🚨 security habit from the 2026-08-19 finding (plaintext github token, world-readable, in a stray
  mcp config): tool-written files under `~/.claude` can be world-readable —
  `grep -rn "ghp_\|sk-\|AKIA" ~/.claude` occasionally.
- macos frame: `Caches` is disposable, `Application Support` is not; `com.apple.*` folders
  self-clean — never our business (except: `com.apple.TCC` = privacy grants, `com.apple.wallpaper`
  holds the actual wallpapers; both look like junk and are not).

## Memory, per surface

| surface | mechanism | location | who can edit |
| --- | --- | --- | --- |
| `cc` | file-based `memory/` + `MEMORY.md` index | `~/.claude/projects/<slug>/memory/` | agent + Dima |
| `cw` | **30 fixed cells** in desktop-app settings | app settings, not the filesystem | **Dima only** |
| `cc cloud` | none of its own | — | — |

📌 `cw`'s 30 cells are a hard cap and Dima-editable only, so anything `cw` should retain must be
handed to him to enter. This is why `cw` context arrives through handoff CSTs instead.

## Who can spawn or operate whom

| spawner | can spawn | cannot |
| --- | --- | --- |
| Dima | anything, incl. cloud `cc` via CLI flag or the desktop app | — |
| `cc` | local sessions, worktrees | cloud `cc` |
| `cw` | nothing | local `cc`, cloud `cc` |

⚠️ **Nobody in the fleet can spawn a cloud `cc`.** Not `cw`, not `cc`. Only Dima,
by CLI flag or from the desktop app. **[verified]**

Scope note: this file is about **Cowork**. The Claude Code cloud session is a different product
with a different VM — see [The two VMs](#the-two-vms-do-not-confuse-them). Conflating them was the
single biggest source of wrong conclusions in this repo's history.

## The core correction

A Cowork session started from the desktop app runs **locally** — session id prefix `local_…`
**[verified]** via `session_info.list_sessions`. Within one such session there are two execution
surfaces, and they are **not** two disjoint filesystems:

| Surface | Runs on | Sees |
|---|---|---|
| `Read` / `Write` / `Edit` file tools | the Mac, natively | real `~/projects/...` paths |
| `workspace.bash` | Ubuntu 22.04 aarch64 VM | `/sessions/<name>/mnt/*` bind-mounts of the same folders |
| Desktop Commander MCP | the Mac, zsh, full shell | everything, as `dima` |

A file written from the sandbox at `mnt/dotfiles/x` is immediately readable on the Mac at
`~/frame/x` **[verified]**. The mounts are a view of the real folder, not a copy.

The genuinely detached, Mac-independent surface is Claude Code's `--cloud` session, not this.

## Sandbox facts [verified]

- Ubuntu 22.04.5, aarch64, 4 vCPU, 3.8 GiB RAM, 9.6 GiB root + 9.8 GiB `/sessions`.
- `/sessions` **persists across bash calls**; only cwd and env do not carry over.
- Preinstalled: node 22.22.3, npm 10.9.8, python 3.10.12, git 2.34.1, jq, ripgrep, curl.
- **Missing: pnpm, gh, go, rust, deno, bun, fd, docker.**
- Node is **22**, this repo's `engines` floor is **>=24**. `pnpm test` / `frame-link` cannot be
  validated from the sandbox — run them through Desktop Commander (Mac node is 24.12.0).
  `node --experimental-strip-types` does work under 22, so single files still run.

### Mount permission quirk

The mounts are **create/write/append/truncate — but not unlink**. `rm` and `rmdir` return
`Operation not permitted` **[verified]**. An agent can therefore make a mess in the sandbox that
it cannot clean up from the sandbox. Delete via Desktop Commander (real Mac shell) instead.

### Network is a proxy allowlist, not open egress [verified]

All traffic goes through `HTTP_PROXY` / `ALL_PROXY` on `localhost`. Reachable: `registry.npmjs.org`,
`github.com`, `pypi.org`, `claude.com`. Blocked (`000`): `api.github.com`, `example.com`,
`cdn.jsdelivr.net`. So `npm install` works, arbitrary HTTP does not.

Git over **SSH** fails from the sandbox — `Host key verification failed`, no keys, no known_hosts.

### Git from the sandbox: read yes, write no [verified 2026-08-15]

Tested end to end against `dvakatsiienko/frame`:

| Step | Result |
|---|---|
| `git clone https://github.com/dvakatsiienko/frame.git` | **OK** — public repo, anonymous, no auth needed |
| `git commit` | **OK** — the sandbox git has **no `commit.gpgsign`**, so the 1Password Touch ID wall that blocks Mac-side commits does not exist here |
| `git push` | **fails**: `could not read Username for 'https://github.com'` |

The push failure is **no credentials at all** — not a 403, not a token scope. There is no
`GH_TOKEN`/`GITHUB_TOKEN` in this session's env and no proxy injecting one. Nothing the user can
toggle in the Claude Code cloud-environment dialog changes this, because that dialog configures a
different sandbox (see below). Treat sandbox git as read-only, permanently.

## The two VMs — do not confuse them

Two separate Linux sandboxes exist and they are constantly mixed up. Almost every "why can't you
just clone and work" question comes from attributing the Code VM's capabilities to the Cowork VM.

| | **Cowork VM** (this doc) | **Claude Code cloud session VM** |
|---|---|---|
| OS / arch | Ubuntu 22.04, aarch64 | Ubuntu 24.04, x86_64 |
| Resources | 4 vCPU, 3.8 GB RAM, ~10 GB disk | 4 vCPU, **16 GB RAM, 30 GB disk** |
| Toolchains | node 22, npm, python, git, jq, rg | Python, Node 20/21/22 **+ pnpm**, Ruby, PHP, Java, Go, Rust, C/C++, **Docker**, PostgreSQL, Redis |
| Network | fixed proxy allowlist, **not configurable** | **None / Trusted / Full / Custom**, user-configurable |
| Git write | impossible — no credentials | works, via a credential proxy that keeps the real token outside the VM |
| Setup script | none | Bash, runs as root before Claude starts, snapshot-cached |
| Purpose | scratchpad for a chat assistant | a real coding agent environment |

**Consequence:** route anything that needs to clone-build-commit-push to a Claude Code cloud
session, never to the Cowork sandbox. The Cowork VM is for parsing a file, running a throwaway
script, testing a regex.

Two gotchas in the Code VM worth carrying: **`gh` is not preinstalled** there either, and there is
**no secrets store** — Anthropic's own docs say "cloud environments have no dedicated secrets
store, so don't add API keys or other credentials" to environment variables.

### The GitHub proxy is a separate gate from the allowlist [docs]

In Code cloud sessions, GitHub traffic bypasses the network allowlist entirely and goes through a
dedicated credential proxy — which enforces its own rule: "GitHub API and release-asset requests
reach only repositories attached to the session, so a setup script that downloads release assets
from an unattached repository gets a **403**."

This is why installing `fnm` there fails with 403 while `nvm` largely works: `fnm` pulls a GitHub
**release asset** from an unattached repo; `nvm`'s installer is a committed file served from
`raw.githubusercontent.com`. Raising the network level to Full does **not** fix it — wrong gate.

Diagnostic, from inside a Code cloud session:
`curl -sS "$HTTPS_PROXY/__agentproxy/status"` returns the proxy config plus recent denials with
timestamps and hosts. Also: the allowlist **reloads live** — a policy change applies to an
already-running container, despite the dialog's "applies to new sessions" wording.

## Artifacts [verified]

Persisted HTML pages in the sidebar that survive across sessions and re-fetch on open. A probe
artifact (`cw-bridge-probe`) confirmed all three bridge APIs:

- `window.cowork.callMcpTool(name, args)` — **works**, ~650 ms against the Linear MCP.
  Returns `{content:[{type:'text',text}], isError}`. **`structuredContent` was absent** — always
  parse `r.structuredContent ?? JSON.parse(r.content[0].text)`.
- `window.cowork.askClaude(prompt, data[])` — **works**, ~6 s (Haiku). Returns an **object, not a
  string**; stringify before rendering.
- `localStorage` — **works** and persists.

Only tools listed in `mcp_tools` at creation are callable. Page network is blocked except three
exact pinned CDN URLs (Chart.js 4.5.0, Grid.js 5.0.2, Mermaid 11.15.0) — everything else inline.
`verify_artifact` returns a debug log with `resultShape` summaries, which is the fastest way to
learn an MCP tool's real output shape.

## Projects

📌 **two products share the name since 2026-09-17** (three research lanes agreed, 2026-10-05; evidence and links in `docs/research/claude-code-projects.md`):

- **Claude Code Projects (redesigned, public beta, Pro/Max, gradual)** — one coordinator conversation
  (opus, low effort) splits a goal into threads (opus, high effort); each thread is a full cc session
  on its own branch, cloud by default. Lives in claude.ai/code, the desktop Code tab and mobile — never
  the CLI. File-based project memory (`MEMORY.md` index) read by cloud threads; 200 new threads a day;
  plan limits. Rollout started with accounts holding no chat/Cowork projects (those keep the legacy
  experience below until migrated); dima has the redesigned one (2026-10-05). his read: the threads
  look like Cowork threads, not cc sessions — the docs say full cc cloud sessions; open until a
  coordinator's own system report settles it.
- **no bridge to our fleet:** a session you start yourself (terminal, `--bg`, desktop local) cannot be
  added to a project; a cloud session can. A «Work locally» thread runs as a Remote Control session in a
  connected folder (cc ≥ 2.1.280) and gets the mac's MCP servers and hooks, not the project memory. No
  public api to spawn or message threads.
- **Desktop Commander does not reach a project** — by design, not a bug: the coordinator has no MCP at
  all, cloud threads get only claude.ai connectors (+ a single repo's `.mcp.json`). DC itself is healthy
  on the mac (`localMcpBridge` advertises its 26 tools). Doors: a «Work locally» thread, or DC's remote
  MCP mode as a connector (threads only, untested).

### Cowork projects (legacy)

A Cowork project bundles six things: description, folders,
standing instructions, reference links, linked claude.ai projects, and a **project-scoped memory
store that persists across sessions**. Three creation paths: from scratch, import a claude.ai
project, or point at an existing folder — this repo's project is the third.

Quirks worth knowing:

- Dragging in a **file** copies it into the project's first folder; dragging in a **folder** mounts
  it as an additional project folder. Individual file reads cap at 50 MB.
- **Archiving deletes the project's memory** along with its name, instructions and links. The
  attached folders on disk are untouched. There is no "archive but keep memory".

### Cowork project vs claude.ai Chat project

They are **not** subset and superset — they overlap partially, and each does something the other
cannot. Cowork holds local folders and project memory; Chat holds a RAG-backed knowledge base and
can be shared on Team/Enterprise. A claude.ai project can be *linked* into a Cowork project for
knowledge without merging.

Practical rule for this setup: **folder-bound work → Cowork project; conversation-and-connector
work with uploaded reference material → Chat project.**

⚠️ **Docs are wrong about sync.** The docs claim "Projects are desktop-only and stored locally.
There's no cloud sync for project data at this time." **Dima observes projects syncing across his
Mac and iOS/iPadOS devices [verified by user, 2026-08-15].** Trust the observation; the page is
stale. The *attached local folders* are still Mac-only, which is a different claim and does hold —
"Projects tied to a local folder support Cowork sessions on desktop only."

### Cowork execution mode: local vs cloud [docs, contested]

Cowork cloud execution exists — "Cowork sessions run in the cloud by default… Cloud execution is in
beta and rolling out gradually across plans." But two Anthropic pages disagree on whether Pro has
it yet, and this account currently sees **only Local**. Most likely a combination of the staged
rollout and the project being folder-bound. Not a tier you can buy your way out of.

**Retracted:** an earlier version of this repo's notes described a "Run new tasks in the cloud"
setting and a per-task "Run this task" picker. Neither could be sourced in any documentation.
Treat as non-existent until seen in the UI.

Source: <https://claude.com/docs/cowork/guide/projects>

### Mobile (iOS/iPadOS) reach [verified by user, 2026-08-26]

- **All thread types from iOS — chat, cowork — reach the x-plugin skill set, even with the
  desktop app closed.** An earlier
  thread claiming otherwise predated the plugin install.
- **`cc --remote-control` sessions are reachable and usable from mobile** — Dima runs the
  coordinator via RC and prints from his phone routinely.

## Spawning cloud sessions — nothing agent-side can do it [verified 2026-08-15]

Neither `cw` nor `cc` can start a Claude Code cloud session programmatically. `cc` tested it and
the CLI refuses outright:

```
--cloud cannot be combined with --print. Cloud sessions are interactive only.
```

An agent only has non-interactive shell, so `claude --cloud` is closed to it, and `/tasks` is an
interactive slash command rather than something callable. The only ways to start a cloud session
are a human at a terminal, the Desktop **Code** tab, the Claude mobile app, or claude.ai/code.

Related commands, easily confused:

| Command | Direction | Notes |
|---|---|---|
| `claude --cloud "<task>"` | local → new cloud session | clones the **GitHub remote at the current branch, not the local checkout** — push first |
| `claude -p "<msg>" --cloud <id>` | any machine → running cloud session | queues and exits; works where full `--cloud` does not |
| `claude --teleport <id>` | cloud → local terminal | needs a clean working tree; the local copy does not flow back |
| `claude remote-control` | local session → viewable from web/phone | runs on the Mac; sleep pauses it, it resumes on wake |

## Session capability varies [verified 2026-08-15]

Two Cowork sessions on the same machine do **not** necessarily expose the same tools. One session
reported having `start_code_task` (spawns a real local `cc` session with worktree isolation, which
appears in the Code tab); this session did not have that tool at all. Never assume a capability
from another session's report — check the current tool list.

## The desktop Browser pane is Code-tab-born only [verified 2026-09-03]

The desktop app injects its built-in mcp servers (Browser pane `mcp__Claude_Browser__*`:
preview_start / navigate / computer / read_page / read_console_messages / preview_logs, plus the
Chrome bridge, scheduled-tasks, mcp-registry) via `--mcp-config` **once, at session creation, only
for sessions the Code tab itself spawns**. Terminal-born sessions — plain `claude`, `--bg`,
`--remote-control` — never get them: not on resume in the Code tab, not via `/exit` + `--continue`;
no flag or setting exists, and `claude mcp add` cannot recreate a desktop-only surface. Measured: a
terminal-RC session viewed in the Code tab had zero browser tools; a fresh Code-tab session drove a
whole app (login, forms, screenshots, console). Sources: https://code.claude.com/docs/en/desktop.md ·
https://github.com/anthropics/claude-code/issues/37284. `.claude/launch.json` per repo defines the
dev servers `preview_start` can launch. Consequence: a browser-needing coder is a handoff Dima opens
in a fresh Code-tab session; cli-born coders verify with headless chromium + playwright instead.

## Scheduled tasks [verified: none currently exist]

Stored as `{taskId}/SKILL.md` under `~/Claude/Scheduled/` — the directory does not exist until the
first task is created **[verified]**. Cron is evaluated in **local time, not
UTC**. Each run starts with **no memory of the originating conversation** — the prompt must be
fully self-contained. Tasks only run while the desktop app is open; a task due while it is closed
fires on next launch. A fired one-shot still reports a stale future `next_run_at` — `ended_reason`
is authoritative.

## Power model — why the bridge drops [verified 2026-08-15, live sampling]

An earlier version of this file claimed "the Mac never idle-sleeps while the Claude desktop app is
open". **That is wrong**, and it is why the bridge-drop question stayed open so long. The Mac sleeps
constantly. Measured on this machine: **201 sleep events in the log** — 188 `Maintenance Sleep`,
13 `Software Sleep pid=396`.

### The five layers, in the order they bite

| # | Layer | This machine | Effect on the bridge |
|---|---|---|---|
| 1 | `displaysleep` | 20 min AC / **5 min battery** | Monitors off, machine awake. Bridge fine — but **Touch ID prompts become invisible**, which is the 1Password commit-signing hang. |
| 2 | `sleep` (system idle) | **1 min, on BOTH AC and battery** | **The root cause.** Once every wake assertion clears, the Mac sleeps in 60 seconds. |
| 3 | Wake assertions | Claude, Chrome, coreaudiod, powerd, sharingd | The only thing holding the machine up. Load-bearing and accidental. |
| 4 | `loginwindow` (pid 396) | 13 explicit sleeps | Lid close, Apple menu → Sleep, or lock. Instant, ignores everything above. |
| 5 | Power Nap + `tcpkeepalive` + `standby`/`hibernatemode 3` | all on | Produces the `Sleep → DarkWake 45s → Maintenance Sleep` churn seen every few minutes overnight. Explains why the bridge sometimes *reappears* on its own. |

### The actual finding: `sleep 1`

```
AC Power:      sleep 1     displaysleep 20
Battery Power: sleep 1     displaysleep 5
```

**A one-minute system sleep timer on AC is the whole problem.** It is not a macOS default. The Mac
stays up only while something holds an assertion, and the moment the last one drops there is a
60-second fuse. That is exactly the "bridge goes online and offline randomly" behaviour — it tracks
assertion churn, not anything Claude does.

Critically, one of the biggest assertion holders is **`powerd — "Prevent sleep while display is
on"`**. So the machine is really being kept awake *by the display being awake*. When `displaysleep`
fires at 20 minutes, that assertion drops, and everything then rests on whatever apps happen to be
holding one. Chrome playing audio counts. That is not a foundation.

### Assertion holders are accidental, not designed

Sampled live: `Google Chrome ("Playing audio")`, `Claude ("Electron")`, `coreaudiod`, `powerd`,
`sharingd ("Handoff")`, plus transient `caffeinate` processes. **Claude is one of several.**

Two consequences worth stating plainly:

- Observing "the Mac stayed awake" is **not** evidence that Claude was running.
- Quitting Claude does **not** guarantee sleep, and keeping Claude open does **not** guarantee wake.

### Fix

Set the AC system-sleep timer to never. Display sleep can stay as it is — it does not affect the
bridge, only Touch ID visibility.

```bash
sudo pmset -c sleep 0        # AC only; leaves battery behaviour untouched
```

GUI equivalent: Settings → Lock Screen / Battery → Options → *Prevent automatic sleeping on power
adapter when the display is off*.

Leave the **battery** profile alone (`sleep 1`, `displaysleep 5`) — on battery, sleeping fast is the
correct behaviour and the cloud path covers unattended work.

`caffeinate -d -t 1200` remains the ad-hoc escape hatch for a single long task, but it is a
workaround for a misconfigured timer, not a fix.

### Battery cost of staying awake — near zero, on AC

Current state: **40 cycles, 96% maximum capacity, Condition Normal**, charge limit 80%, and on AC
the battery reads *"80%; AC attached; not charging"*.

Two mechanisms age a lithium-ion cell: **cycling** (charge/discharge) and **calendar aging**
(sitting at a given state-of-charge and temperature). Keeping the Mac awake **on AC** touches
neither meaningfully:

- **Cycle count does not grow.** The battery is held at 80% and not discharging, so staying awake
  adds no cycles. This is the single biggest lever and it is already handled by the 80% limit.
- **Calendar aging is dominated by state-of-charge and temperature, not by whether the CPU is
  idle-awake.** Sitting at 80% rather than 100% is the meaningful mitigation, and that is already
  in place.
- **Heat is the remaining variable**, and it is small here: an idle-awake M4 Pro with the display
  off draws very little. `pmset -g therm` records no thermal or performance warnings on this
  machine, ever.

So the real costs of `sleep 0` on AC are **electricity and a marginal amount of heat**, not battery
health. The 80% charge limit is doing the work that actually matters.

⚠️ This applies to **AC only**. On battery, staying awake drains the pack and *does* burn cycles —
which is why the battery profile should keep its aggressive timers.

Note the diagnostics that matter, for re-checking later:

```bash
pmset -g custom       # per-power-source settings — the source of truth
pmset -g assertions   # who is holding the machine awake right now
pmset -g log | grep "Entering Sleep state due to"   # what actually happened
system_profiler SPPowerDataType | sed -n '1,40p'    # cycles, max capacity, condition
```

## What cw does and does not get [verified 2026-08-15]

A Cowork session in a project **does** receive the project's `CLAUDE.md` and standing instructions.
It does **not** receive `home/.claude/CLAUDE.md` — the global cc memory carrying codenames and
global defaults — nor `hooks/`, `output-styles/`, or `rules/`.

Consequence: repo-scoped conventions transfer, machine-global ones do not. Mechanical style drift
is bounded anyway because `biome.jsonc`, `.editorconfig` and lefthook enforce it at commit; what
actually drifts is taste-level convention that lives only in the global file.

⚠️ Do **not** generalise this to Claude Code cloud sessions. Whether *those* get the global
`CLAUDE.md` is unsettled — one cloud session had it injected at start (content present, file
absent on disk) and another did not. Owned by DOT-55; do not build on either answer yet.

## Practical routing

- Repo work needing pnpm / node 24 / real git → **Desktop Commander**, or Claude Code.
- Throwaway compute, parsing, scratch scripts → **sandbox bash**.
- Clone-build-commit-push, or anything that must survive a closed laptop → **Claude Code cloud
  session**, started by a human. Not Cowork.
- Recurring reports over connector data → **artifact** + **scheduled task**.
- Deleting anything in the repo from the sandbox → impossible; use Desktop Commander.

## Open questions

- Whether a Cowork session started from phone/browser exposes the same `mnt/` bind-mounts (it has
  no Mac to mount) — untested.
- Whether the mount unlink restriction is configurable.
- Why `start_code_task` is present in some Cowork sessions and absent in others.
- Whether dynamic workflows run in the Cowork tab at all — undocumented, and Cowork does not read
  the CLI's `~/.claude` directory, so probably not. Tracked in DOT-56.

## Scheduling from `cc` — three routes

Three routes exist, in order of preference:

1. **built-in `CronCreate` / `CronList` / `CronDelete`** — local scheduled sessions, first-class
   cli tools. They are currently listed in `permissions.deny` in
   `home/.claude/settings.json` **by Dima's own choice** — removing three strings from that array
   turns them back on. **[verified]**
2. **`RemoteTrigger` + the `schedule` skill** — cloud routines on a cron schedule, and webhook
   triggers. Never disabled. Survives a closed laptop, which the desktop MCP does not. **[verified]**
3. **plain `cron` + `claude -p "<prompt>"`** — the fallback. Viable, and the most transparent of
   the three, but each run starts with no session context, so the prompt must be fully
   self-contained. Same constraint the desktop scheduled tasks already carry. **[verified]**

📌 **Device-bound scheduled tasks (claude.ai/cw side) are UI-create-only.** `create_trigger` with
`requires_local_device: true` fails with `no_signed_approval`, and the `Require this computer`
toggle cannot be added after creation — Dima must create the task by hand in the desktop UI, so a
cw thread needing one hands him the prompt in a copy-fence instead. **[verified 2026-08-28, cwrk]**
