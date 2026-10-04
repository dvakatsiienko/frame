# stash — dima's command center above the prompt

one folded row, three features: **asks** (every live session's open ⏳ asks), **afk** (one switch
every session obeys), **holds** (no two sessions write the same file).

## holds — the want

> collision guard - i think this os most useful! and it will allow to reduce memory lines?

two sessions never write the same file at the same time; a session about to edit a file another live
session is working on gets stopped and told who holds it — so the «shared working tree» rules stop
being memory and become a mechanism.

## holds — decided (grill round 1, 2026-10-04)

- a session holds a file from its first Edit/Write of it until it commits that file, ends, or sits idle 30 min
- another session's edit of a held file is denied, the deny names the holder; no override in v0
- a file is its absolute path — worktrees never collide, only shared checkouts do
- seen: `Edit`, `Write`, `NotebookEdit`; Bash writes are out
- the dock pane shows who holds what, live, with a release button for a stale hold
- holds live in stash: one store, one name; the row shows a holds chip that opens the pane

## holds — decided (grill round 2, 2026-10-04)

- a hold is released once its file is clean in git (`git diff --quiet HEAD -- <file>` through `$.process`), checked lazily at a deny — a revert or checkout releases it too
- idle = 30 min since the holder's last turn ended; a crashed session falls under it
- the holder hears nothing; its holds chip turns ⚠ and the pane shows who wanted the file, when
- the chip counts other sessions' holds in this session's repo, hidden at zero; a click opens the pane
- the pane is the dock pane `/dock-probe` proved (`seat: dock` on terminal and desktop): who holds what, live, plus release
- out of v0: Bash writes, dima's hand edits (cc's own «modified since read» error is that net)

## holds — prior art (step 3, 2026-10-04)

**build it inside stash.** two public hooks already deny an edit from a PreToolUse hook — [agent-coord](https://github.com/ThatHunky/agent-coord) (1★, last push 2026-06-26, a json board under `~/.agent-coord`, TTL 120 / 20 min, fail-open) and [claude-code-file-lock](https://github.com/nstksean/claude-code-file-lock) (4★, last push 2026-04-12, `O_EXCL` lock files, 5 min TTL + dead-pid, fail-open). neither is reused:
- a mod imports only its own files and `"claude-code"` — no npm, no foreign hook code
- neither has our release rules (clean in git, session end, idle since the last turn) or a pane
- stash already owns the store, the session lifecycle and the row
- the rest (mcp_agent_mail, agent-claim-mcp, Dibs, agentlocks) are advisory leases the agent must opt into

**what cc already covers, and where it stops:**
- «modified since read» (sha + size per session) stops a blind overwrite only — a re-read and edit interleaves anyway
- `bgIsolation` covers `--bg` sessions only — interactive and Code-tab sessions, the ones holds is for, are bare

**the lib per part:**
- store → `$.store` (one json per plugin, cc locks each write); no compare-and-set, so the claim is per-session keys `hold:<sid>:<path>`: write own key, then read every claim on that path; earliest `at` wins, ties by sid
- deny → `tool.call` returning `{ deny }`
- release → `turn.complete` for the idle clock, `session.end` (1.5 s, not on a crash), a lazy `git` check through `$.process.run`
- liveness → `~/.claude/sessions/<pid>.json` + the pid, before the idle clock
- path → `$.fs.stat({ resolve: true }).realPath`, lowercased on darwin (APFS is case-insensitive; `realpathSync` keeps the spelling)

**borrowed:** dead-pid recovery (file-lock), fail-open on a store error (both), a synthetic git-index hold (agentlocks) — a candidate for the cut

**open for the cut:**
- an untracked new file is never clean under `git diff HEAD` — needs a status check
- `/clear` keeps the process under a new session id — its old holds die at the next turn
- subagents share the parent's hold — two parallel subagents in one session are not guarded
- `$.process` is labelled «CLI only» — whether a Code-tab session counts is unproven
- a session started before the `CLAUDE_CODE_PLUGIN_DIRS` change runs `stash@x` with its own store and sees no holds

## holds — the cut (step 5, 2026-10-04)

step 4 skipped on dima's word: lock design is well-trodden ground, and there is no naming fork.

**v0**
- claim: a session's first `Edit` / `Write` / `NotebookEdit` on a file takes the hold; each session writes its own key `hold:<sid>:<path>`, the earliest `at` wins (ties by sid); the path is the real path, lowercased on darwin
- deny: another session's edit of a held file is refused; the message names the holder session, since when, and «wait, or ask it to commit»
- release, checked lazily at a deny: the file is clean in `git status --porcelain -- <file>` (covers an untracked new file), the holder pid is dead, the holder sat idle 30 min since its last `turn.complete`; `session.end` releases best-effort
- fail-open: a store or git error lets the edit through and logs the error
- the row: a `🔒 n` chip, other sessions' holds in this repo, hidden at zero; ⚠ on the holder's side when someone was denied

**out**
- the pane (who holds what + release) — later, when a real stale hold asks for it; the dock pane is kept for it in `mods/dockprobe/`, unloaded
- Bash writes, and with them a git-index hold (a commit sweeping another session's work)
- dima's hand edits — cc's «modified since read» is that net
- two subagents inside one session — they share the parent's hold
- override, a ping to the holder, globs and directories
- sessions started before the `CLAUDE_CODE_PLUGIN_DIRS` change — they run `stash@x` with its own store

📌 unproven: `$.process` is marked «CLI only»; the done test probes a Code-tab session first
