---
verified-against: claude code 2.1.283, on this mac, 2026-09-27
method: real spawns — bg sessions, subagents, a fork, worktree isolation, cross-session sends, forced tool calls, transcript + registry inspection. docs/schema only where execution was ruled out, and labelled so.
refresh-when: the claude code minor version changes
procedure: recipes/refresh-craft-spawning/recipe.md
---

# spawn mechanics — what is actually true

the evidence base for every way a claude code session can start another worker. the resident
distillate is `cclio/memory/craft-spawning.md`; this is the on-demand detail behind it.

claim tags: **[verified]** ran it, observed the result · **[schema]** read from a tool definition
or `--help` · **[docs]** anthropic documentation only · **[inferred]** reasoning, not evidence ·
**[unknown]** · **[volatile]** verified, but flipped across builds — re-probe every build.

📌 **the doors, at a glance:** subagent and fork die with the parent and dima cannot open them.
a background session is real, survives a coordinator reset, and takes model and effort. worktree
isolation is a subagent in its own branch. a workflow is a script driving many subagents. cloud
runs on anthropic machines and nobody in the fleet can start one.

## 1. subagent — the `Agent` tool

- runs inside the parent's **own os process** [verified]
- **starts in the parent's SHELL cwd** [verified 2.1.258, 2.1.283] — the cwd the parent's `Bash` tool sits
  in, mutated by any earlier `cd`. a cclio parent (registry cwd `~/frame/cclio`) whose last Bash
  call had `cd ~/frame/docs` produced a child at `~/frame/docs`; after `cd ~/frame`, the
  next child started at `~/frame`. the shell cwd sets the child's cwd only, not its context
  stack (§7). 2.1.283: a cclio parent (registry cwd `~/frame/cclio`, last shell cwd `~/frame`)
  produced a child at `~/frame`.
  - 🚨 **reversed on 2.1.251**: through 2.1.239 a subagent started at the *workspace root*
    (`~/frame/cclio` → `~/frame`). absolute paths in briefs are correct under both.
- **async** [verified] — the parent keeps its turn; completion arrives as a `<task-notification>`
  user-role message with the agent's final text plus a token/duration block.
- **model is settable and honoured** [verified] — `model: "haiku"` from an opus parent produced
  `claude-haiku-4-5-20251001` in the child's transcript.
- **effort takes no param; inherited only by a child whose model carries effort** [verified], §6.
- **`name` is accepted** [verified] though absent from the printed parameter list; regex
  `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` — no emoji, colons or spaces [verified]. `🔬 probe: emoji name`
  is an `InputValidationError`; transliterate to `probe-emoji-name`. 📌 `claude --bg -n` has no
  such restriction — the two naming surfaces do not share a validator.
- dima sees it in `/tasks` and **can resume it with another message** [schema]
- no remote-control channel of its own — no session, nothing to bridge [inferred]; its output
  surfaces through the parent
- 🚫 **`ListAgents` and `Workflow` are absent from a subagent's toolset** [verified 2.1.258, 2.1.283] — proven by
  `ToolSearch` failing to resolve either name (§12). `SendMessage` **is** available (deferred)
  [verified].

## 2. fork — `Agent` with `subagent_type: "fork"`

- a subagent carrying the parent's **full context, including prior tool results** [verified] — a
  fork answered five facts with zero tool calls, three of them known only from `Bash` and
  `TaskCreate` results
- **`model` is ignored — a fork is always the parent's model** [schema]
- everything else matches §1

## 3. worktree isolation — `Agent` with `isolation: "worktree"`

- cwd: `<repo>/.claude/worktrees/agent-<agentId>` [verified]
- branch: `worktree-agent-<agentId>`, listed as `locked` [verified]
- 🚨 **it branches from `origin/<default-branch>`, NOT local `HEAD`** [verified] — the probe's
  worktree sat at `origin/main` while local `main` was one commit ahead, so **a worktree agent
  cannot see unpushed commits.** governed by `worktree.baseRef`: default `fresh` = origin, `head`
  = local HEAD.
- **auto-removed when the agent changes nothing** [verified] — `git worktree list` clean afterwards
- ⚠️ in `frame` a worktree **cannot push** and must **never run `pnpm`** — it rewrites the
  shared `.git/hooks` to the worktree path (`rules/fleet-hazards.md`). brief both bans explicitly.

## 4. workflow — the `Workflow` tool

- a js script driving many subagents; `agent()` returns a promise the script awaits, so **the
  workflow call blocks until the script ends** [schema]
- **effort and model are per `agent()` call, and per-call effort is honoured** [verified 2.1.258, 2.1.283]
  — `agent(…, {model: 'opus', effort: 'high'})` under a session at `low` read
  `CLAUDE_EFFORT=high`; `effort: 'low'` read `low`. a workflow agent starts in the parent's shell
  cwd, like a subagent (§1). 2.1.283: a workflow run by a `--bg` session at `low` from
  `~/frame/docs` gave its `{model: 'opus', effort: 'high'}` agent `CLAUDE_EFFORT=high`,
  `effort=high` on its records, and cwd `~/frame/docs`.
- the concurrent cap is raisable: `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` (1–256) [docs,
  changelog 2.1.269]
- concurrency caps: `min(16, cpus-2)` concurrent agents, 1000 total per workflow, 4096 items per
  `parallel()` / `pipeline()` [schema]
- absent from subagent toolsets — only a top-level session can run one [verified]

## 5. background session — `claude --bg`

the door for all coding work: real, watchable, outlives the session that started it.

- 🚨 **`claude --bg '<prompt>'` DOES run the prompt** [verified 2.1.251, 2.1.258, 2.1.283] — the transcript
  carries the prompt as a user record and the answer as the first assistant text. this reversed the
  rule that the session comes up idle and needs a `SendMessage` brief. `SendMessage` remains the way
  to brief it *after* launch, and the only way to attach `notify_when_idle`.
- **model and effort are both flags, both honoured** [verified 2.1.283] — `--model opus --effort low`
  wrote `effort=low model=claude-opus-5-5` onto every assistant record (`claude-opus-5` on 2.1.258). the earlier
  `effort: null` came from pairing the flag with `--model haiku`, not from the flag.
  - ⚠️ **always pass `--model`** — the settings default moved (fable until 09-24, `opus[1m]` at
    `effortLevel: high` on 2026-09-27) and a spawn must not ride it silently.
- 🚨 **`--bg` now checks workspace trust** [docs, changelog 2.1.281] — in a directory that has not
  passed the trust prompt it asks first, or **exits when not run interactively**. a subdirectory of
  a trusted repo counts: `~/frame/docs` (no trust entry of its own, `~/frame` trusted) launched
  from a non-tty shell [verified 2.1.283]. a night shift spawning into a new repo trusts it first.
- **a bg session can be retired by the daemon** [inferred — binary strings only]: the build names
  retire reasons `stale-spare`, `empty-idle`, `empty-idle-grace`, `abandoned-stale`, `max session
  age`. which of them hits a live idle coder is unmeasured.
- **`-n <name>` sets the registry name** [verified] — free-form, emoji and spaces allowed.
  `--remote-control [name]` labels only the rc card; an unnamed session names itself from its
  first turn. a rename afterwards is a typed `/rename` inside the session (`claude attach <id>`);
  a spawned coder has no tool for it.
- **`remoteControlAtStartup: true` is inherited — no flag needed** [verified]. the registry entry
  gains a `bridgeSessionId`; the log shows a `claude.ai/code/session_…` link.
- **a detached daemon, not a child process** [verified]. the process is
  `claude bg-spare --bg-spare /tmp/cc-daemon-501/<n>/spare/<id>.claim.sock` — **claimed from a
  pre-warmed spare pool**; its ppid is the spare slot, never the spawner, so it survives the
  spawning session by construction.
  - the pool's owner [verified 2.1.258, 2.1.283]: `claude daemon run --origin transient --spawned-by
    {"label":"claude --bg","cwd":…}`, ppid 1, started by the FIRST `--bg` call and recording that
    call's cwd. it holds `bg-pty-host` slots, each wrapping one `bg-spare`; a claimed spare becomes
    the session, and one unclaimed spare stays warm after every session is stopped. nothing exists
    before the first `--bg` of the day.
- **stopping: both routes work** [verified 2.1.251, 2.1.258; `claude stop` re-verified 2.1.283]
  - `claude stop <jobId>` — works from a non-tty shell
  - `kill <pid>`, pid read from `~/.claude/sessions/<pid>.json`
  - verification for both: the registry file removes itself on exit; `ls` is the whole check.
    🚫 never pattern-kill — your own process carries the same path in its argv.
  - ⚠️ deleting the session card in the desktop Code ui does **not** stop the process.
- `claude logs <jobId>` works from a non-tty shell [verified]; `claude attach <id>` needs a tty,
  so it stays [schema] here.
- 📌 `attach`, `logs`, `stop|kill` and `rm` are **documented in `claude --help` since 2.1.251**
  [verified]; absent on 2.1.239.
- ⚠️ **`--bg` and `--print` conflict** — a real error, separate from the `disableAgentView`
  refusal that once gated `--bg` entirely [verified].

## 6. effort — the rule is model-conditional

**effort is a recorded field** on every `assistant` record in the session jsonl — the cheap audit
for any claim about it:

    jq -r 'select(.type=="assistant") | "\(.effort) \(.message.model)"' <transcript>.jsonl | sort -u

- `claude --effort <low|medium|high|xhigh|max>` — honoured [verified]
- `claude --bg --effort` on an effort-capable model — honoured [verified], §5
- `Agent` tool — no param; **inherited by an effort-capable child** [verified]: an opus subagent
  of a `high` parent had `CLAUDE_EFFORT=high` in its env and `effort=high` on its records
- 🚨 **a haiku child carries no effort at all** [verified] — no `CLAUDE_EFFORT`, `effort=null` on
  its records, same `high` parent. a property of the model, not broken inheritance. 📌 this
  confound produced a wrong conclusion twice: **never measure effort with haiku in the loop.**
- `Workflow` → `agent(prompt, {effort})` — per call, honoured [verified 2.1.258], §4

## 7. base context — what a spawn knows before it reads anything

**a background session's stack is decided by the launch shell's cwd, recorded faithfully in the
registry** [verified 2.1.258, 2.1.283] — a `--bg` from `~/frame/docs` recorded `cwd: /Users/dima/frame/docs`
and loaded `~/.claude/CLAUDE.md` + `rules/*` + `dotfiles/CLAUDE.md` + the auto-memory index, and
nothing below that. 2.1.283 from `~/frame/docs`: `~/.claude/CLAUDE.md` + `rules/*` +
`~/frame/AGENTS.md`, nothing under `cclio/`. 📌 **`cd` before `--bg` is the entire
context-selection mechanism.**
- AGENTS.md is a first-class instruction file since 2.1.277 [docs, changelog]: a project with no
  `CLAUDE.md` is read through its `AGENTS.md`.

**a subagent INHERITS the parent's context stack, whatever its own cwd** [volatile — verified
2.1.258, 2.1.283] — two cclio subagents (opus at `~/frame/docs`, haiku at `~/frame`) both held
`cclio/CLAUDE.md` and every `cclio/memory/*` leaf and quoted its first sentence on request; a
`--bg` from the same shell and cwd held neither. 2.1.283: this run's own agent, a cclio subagent
at `~/frame`, carried `cclio/AGENTS.md` and every memory leaf — two builds in a row now.
🚨 **reversed 2.1.251** (re-derive from own cwd), which had reversed 2.1.239 (inherit). three
builds, three answers — never write a brief that depends on either.
🎯 **consequence:** a subagent or workflow agent spawned by cclio wears the coordinator's brain
on this build, and no `cd` sheds it. a coder that must think as a plain session goes through
`claude --bg` from the target repo — the only door that derives from cwd.
- 🆕 **`omitClaudeMd`** in agent frontmatter and `--agents` JSON runs a custom or plugin subagent
  without user, project and local CLAUDE.md files [docs, changelog 2.1.271; unprobed]. the first
  in-tool lever against the inherited stack — but it drops the fleet rules too, not only cclio's.

**conversation is not inherited by a plain subagent** [verified]; a **fork** inherits everything,
tool results included (§2).

**the parent cannot choose a subagent's cwd** — the `Agent` tool takes `description`, `prompt`,
`subagent_type`, `model`, `isolation`, `name`; no `cwd` [schema]. `isolation: "worktree"` is the
only lever and it picks the path itself. 📌 `EnterWorktree`'s description mentions agents "whose
working directory was pinned at launch (subagent isolation or **explicit cwd**)" — the runtime has
the concept, this build's `Agent` schema does not expose it. **workaround: state the working
directory in the brief, every path absolute.**

## 8. the two registries — how to introspect a live session

- `~/.claude/sessions/<pid>.json` — one per live session, self-removing on exit. carries
  `sessionId`, `cwd`, `kind`, `name`, `nameSource`, `jobId`, `status`, `version`,
  `bridgeSessionId`, `messagingSocketPath`, `peerProtocol`, `peerFeatures`.
  - `peerFeatures` on 2.1.251 and 2.1.283: `["notify_idle", "reply_across_default_dirs", "artifact_yield"]`;
    `["notify_idle"]` alone on 2.1.239.
- `~/.claude/jobs/<jobId>/state.json` — richer, and the **only place the launch flags survive**
  [verified 2.1.251]: `respawnFlags` (the literal argv: model, effort, `-n`, `--remote-control`),
  `template`, `cliVersion` (`null` on 2.1.283), `cwd`, `tokens`, `state`/`detail`, a `fan` array mirroring the live
  todo list; `timeline.jsonl` alongside. 🎯 this answers "how was that session started?" without
  asking it.
- `claude agents --json` prints the live set; gated by `disableAgentView`, which does not gate the
  `ListAgents` tool [verified 2.1.239, setting `true`]. the setting is `false` today, so the gate
  is not re-testable without flipping it.
- 🚫 **`claude -p` sessions do not register** — no `~/.claude/sessions/` entry, no bridge
  [verified]: invisible to `ListAgents`, unreachable by `SendMessage`. use `--bg` for anything
  addressable.

## 9. messaging between sessions

**a two-way channel over unix-domain sockets, not polling** [verified]

- transport: `/tmp/cc-socks/<pid>.sock`, one per live session, advertised in the registry as
  `messagingSocketPath`
- discovery: **`ListAgents`** — works even with `disableAgentView: true` [verified]
- addressing: **the name is the address**; append ` [ref]` only on ambiguity [schema]
- delivery: enqueues and drains at the receiver's next tool round [schema]
- 🚨 **a reply only travels if the peer explicitly calls `SendMessage`** — plain prose reaches
  nobody. tell every peer *to reply with SendMessage* [verified, twice]
- **completion events:**
  - subagents and forks → automatic `<task-notification>` [verified]
  - another session going idle → `notify_when_idle: true` on a `SendMessage`, one-shot, opt-in,
    **from a main conversation only** [verified end to end 2.1.251] — the
    `[Cross-session idle notice]` arrived at the caller carrying the peer's closing line. (docs:
    it can route to dima's transcript instead when the two sessions differ in permission class.)
  - ⏱️ **the notice is queued, not immediate** [verified] — it drains at the subscriber's next
    tool round and can land after the target was stopped (one reported a 20:03 idle and arrived
    after the kill). read the timestamp it carries, never its arrival.
- **driving a session dima started himself works** [verified] — a probe reached a two-day-old
  `interactive` session and it replied. the message arrives wrapped and attributed:

      <cross-session-message from="uds:/tmp/cc-socks/<pid>.sock" from-name="…" from-mode="bypass">

  a subagent's send goes out under **its parent session's** address with the subagent named
  inside — an agent ping is always distinguishable from a human one.
- ✅ non-intrusive in practice. dima: *«does not look like spamming»*.
- **a script can write to a session's inbox socket directly, no cc in between** [verified 2.1.291,
  `ccrow/lib.ts` `sendLine`]: one newline-terminated json frame per connection —

      {"type":"user","message":{"content":"<text>"},"from_name":"<label>","priority":"next","uuid":"<uuid v4>"}

  a frame without `from_mode` reads as «no mode asserted», and a bypass session **holds** it
  («Held peer message … not delivered») unless its settings say `crossSessionInbound: "accept"`.
  ccrow's `--settings` sets that.
- a message held by the receiver's permission-mode policy now leaves a trace: a
  `[Cross-session delivery notice]` for a local target, and a `SendMessage` result no longer
  implies it was read [docs, changelog 2.1.271; tool description 2.1.283]. an offline Remote
  Control target reads «queued», not delivered (2.1.261).
- 📌 **a `Monitor` watch always has a deadline — at most 30 min** (10 in `-p`), and `persistent`
  is gone [docs, changelog 2.1.271; the tool's own schema on 2.1.283]. any unattended watch
  (a pr watch, a hang detector) re-arms on its expiry notice or goes dark.

## 10. cloud — `claude --cloud`

**not executed, deliberately.** everything here is [schema]/[docs]: runs on anthropic machines,
visible at claude.ai/code, model and effort settable, non-blocking, stopped by the user.
🚨 **nobody in the fleet can spawn one — only dima.** help takes `--cloud
[description|session_id|url]`; a prior-art claim that `--cloud` refuses `--print` dates from
2026-08-15 and is stale until re-run.

## 10b. facts the coordinator no longer keeps resident

moved out of `cclio/memory/craft-spawning.md`: true, measured, but none of them changes a spawn decision on its own. re-probe with the suite in §13.

- ⚠️ **a subagent starts in the parent's bash cwd and inherits cclio's whole stack regardless
  of it** (2.1.258 and 2.1.283; flipped on each of the three builds before — re-probe every build). keep every
  path in a brief absolute.
- ⚠️ **effort is inherited only by an effort-capable child** — an opus subagent gets
  `CLAUDE_EFFORT`, a haiku one records `effort=null`. never measure effort with haiku in the loop.
- ⚠️ **a worktree agent branches from `origin/<default-branch>`, not local HEAD** — it cannot see
  unpushed commits.
- 📌 `~/.claude/jobs/<jobId>/state.json` carries `respawnFlags` — the only place a session's
  launch argv survives.
- ⭐ **background sessions are ADOPTABLE** — anything reading `~/.claude/sessions/` can brief a
  coder it never spawned. Never respawn to escape a lost parent; delivery is proven, correctness is
  a separate check.
- ✅ **cclio spawns `--bg` coders from either birth, terminal or Code tab** — measured 2026-09-07: a Code-tab-born session's child booted on `Claude Max`, wrote a file, bridged rc. the desktop env markers (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `ANTHROPIC_BASE_URL`) are harmless. an auth error on spawn means cc is signed out, not a broken door — probe: `claude -p --model haiku 'reply: alive'`.
- **cloud is receive-only** and cli → cloud delivery is unverified — a one-way pipe plus a shared
  store, never a handshake.
- ✅ peer messaging is non-intrusive — Dima: *«does not look like spamming»*. No hedging about
  waking peers.
- `ListAgents` and `Workflow` are absent from subagent toolsets — only the coordinator surveys the
  fleet.

## 11. open questions

- **`claude attach`** — requires a tty; every shell here is non-tty.
- **row 10 in full** — cloud is forbidden by every brief so far.
- **what `disableAgentView` costs today** — it gated `claude agents` and `claude agents --json`
  and not `ListAgents` [verified 2.1.239]; whether it also hides the in-tui agent view [unknown].
- ⚠️ **the cclio-stack bleed — explained for subagents, unreproduced for `--bg`.** subagent
  inheritance (§7) is what the 2026-08-30 run saw from the inside. its one `--bg` observation
  (registry cwd `~/frame`, cclio leaves loaded) did not reproduce: two `--bg` probes on 2.1.258
  from `~/frame` and `~/frame/docs` loaded nothing under `cclio/`. 1 bleed in 3 bg launches
  across two builds; the daemon recording the first `--bg` call's cwd (§5) is the remaining
  suspect. **a bg coder's brief asks it to name its loaded CLAUDE.md paths in its first reply** —
  the only detector. 2.1.283: a third clean `--bg` (from `~/frame/docs`, nothing under
  `cclio/`), so 1 bleed in 4 launches across three builds.
- ⚠️ **the daemon spare that booted without the root `AGENTS.md`** (upstream
  [claude-code#95589](https://github.com/anthropics/claude-code/issues/95589), open) — **not
  reproducible cheaply on 2.1.283.** the daemon is transient: none existed before this run's
  first `--bg`, so the probe claimed a spare born the same second and loaded `~/frame/AGENTS.md`
  (fresh spare, clean — the known-good side). the day-old side needs a spare left warm for 24 h
  and then claimed; that probe costs a day of waiting, not a session. the build names a
  `stale-spare` retire reason [inferred, strings only], which may be the upstream fix or may be
  older. the spawn preflight in `craft-spawning` stays until a day-old claim is measured.

## 11b. compaction — the hooks an unattended member leans on

[verified 2.1.283] by one haiku `-p` session in a scratch dir: `--settings` carried a
`SessionStart` hook on matcher `compact` (printing a canary pin), plus `PreCompact` and
`PostCompact` hooks dumping their stdin; then `-p --resume <id> '/compact'`, then a third turn
asked for the canary with no tools.

- **`SessionStart` with matcher `compact` fires after every compaction**, input
  `{session_id, transcript_path, cwd, prompt_id, hook_event_name, source: "compact", model}`.
  **its stdout lands in the compacted context**: the canary, present nowhere else, came back
  word for word on the next turn. the schema's `source` enum is `startup | resume | clear |
  compact | fork`.
- **`PostCompact` exists**, input `{…common, hook_event_name, trigger: "manual"|"auto",
  compact_summary}` — `compact_summary` is the full generated summary text (it opens with an
  `<analysis>` block). no decision field in its schema.
- **`PreCompact`**, input `{…common, trigger, custom_instructions}`; `custom_instructions` is
  `null` on a bare manual `/compact` too, not only on auto.
- order: `PreCompact`, then ~20 s of summarising, then `PostCompact` and `SessionStart:compact`
  in the same second.
- the `compact_boundary` record carries `compactMetadata` with `trigger`, `preTokens`,
  `postTokens`, `durationMs`, `preservedMessages` (22.6k → 2.5k, 2 messages kept verbatim).
- 📌 `/compact` via `-p --resume` works, which makes this a cheap re-runnable probe.
- `--setting-sources project` kept the user-scope hooks out; flag `--settings` hooks still ran.
- present in the binary, not exercised: `CLAUDE_CODE_AUTO_COMPACT_WINDOW`,
  `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, `DISABLE_AUTO_COMPACT`, `DISABLE_COMPACT`,
  `autoCompactWindow`, `--autocompact <auto|tokens>` (in `--help`), and the compaction prompt's
  own «## Compact Instructions» example [schema]. the skill re-inject caps (5k / 25k tokens) stay
  [docs]; an auto compaction stays unmeasured on this mac.

## 12. method lessons specific to probing spawns

the general ones live in `cclio/memory/method-report-verify.md`. this subject's own:

- 🚨 **a model's self-report of its own tool list is unreliable** — sessions answered yes to
  "do you have `ListAgents`" where it was absent. a **forced call** or a `ToolSearch` resolution
  is the proof.
- 🚨 **change one variable.** the effort question stayed open eight days because the first probe
  moved the flag and the model together; the haiku confound nearly repeated on the rerun.

## 13. the test suite — re-run this list at every refresh

```bash
claude --version
claude agents --json                                  # live set + gating state

# bg: prompt execution, naming, model+effort. ALWAYS pass --model (default is fable)
claude --bg -n 'probe-x' --model opus --effort low 'reply with exactly: PROBE_OK'
jq -r 'select(.type=="assistant") | "\(.effort) \(.message.model) \(.sessionKind)"' \
  ~/.claude/projects/<slug>/<sessionId>.jsonl | sort -u
jq . ~/.claude/sessions/<pid>.json                    # registry: name, cwd, bridge, peerFeatures
jq '.respawnFlags, .cwd, .template' ~/.claude/jobs/<jobId>/state.json
ps -o pid,ppid,command -p <bg-pid>                    # ppid → bg-spare slot, not the parent

# context stack: launch cwd decides — run from two directories, compare
cd ~/frame/docs && claude --bg -n probe-cwd --model haiku '…list your CLAUDE.md paths…'

# subagent cwd — must run from a SUBDIRECTORY of a repo to discriminate
#   parent ~/frame/docs → child ~/frame/docs  = parent's cwd (2.1.251)
#   parent ~/frame/docs → child ~/frame       = workspace root (2.1.239)

# forced tool calls — the only reliable capability test inside a subagent
#   ToolSearch 'select:ListAgents,Workflow' → "No matching deferred tools found" = absent

# effort inheritance — use an OPUS child; a haiku child proves nothing
env | grep -i CLAUDE_EFFORT                           # inside the subagent

# worktree isolation — brief it read-only, no pnpm, no writing git
#   pwd → <repo>/.claude/worktrees/agent-<agentId>, branch worktree-agent-<agentId>
git rev-parse --short main origin/main                # base ref is ORIGIN, not local HEAD
git worktree list                                     # empty after an unchanged agent = auto-clean

# compaction hooks — one haiku -p session in a scratch dir, hooks via --settings
#   SessionStart{matcher:"compact"} echoes a canary; PreCompact/PostCompact cat stdin to files
claude -p --model haiku --setting-sources project --settings hooks.json --session-id <uuid> '…'
claude -p --model haiku --setting-sources project --settings hooks.json --resume <uuid> '/compact'
claude -p … --resume <uuid> 'no tools: what canary word do you see?'   # must name it
#   then trash ~/.claude/projects/<scratch-slug>/ — the probe writes auto-memory there

# bundled skills — the names, gated ones included (a gated skill never shows in a session list)
strings -n 6 ~/.local/share/claude/versions/<v> | …  # python: re.finditer(r'\bds\(\{name:', …)

# stopping — both work; verify by the registry file vanishing
claude stop <jobId>
kill <pid>                                            # pid from the registry, NEVER a pattern
ls ~/.claude/sessions/<pid>.json                      # must be "No such file"
```

**agents spawned by the 2026-09-27 run (2.1.283):** 1 `claude --bg` opus session (effort low,
from `~/frame/docs`) which ran 1 one-agent workflow (opus, effort high) — stopped by `claude
stop`, registry file gone; 1 haiku `claude -p` session (three turns, never registered), its
project dir trashed. subagent rows read off this run's own agent. worktree isolation and the
`kill <pid>` route not re-run (rows keep their 2.1.258 tags). the transient daemon and one warm
spare stay up after the stop, as recorded in §5. no repo files touched by any probe.

**bundled skills on 2.1.283** (from the binary; the next run diffs against this): `artifact-capabilities`
`artifact-components` `artifact-design` `artifact-diagramming` `artifact-pr-review` `batch`
`claude-api` `claude-in-chrome` `code-review` `commit` `cowork-plugin` `dataviz` `debug`
`design` `design-sync` `doctor` `explain-usage` `fewer-permission-prompts` `keybindings-help`
`loop` `pr` `prototype` `run` `run-skill-generator` `schedule` `setup-claude` `simplify`
`update-config` `verify` `whiteboard` `workflow-authoring` `workshop`, plus a memory-taxonomy
reference (model-only), a claude-code guide skill behind a feature flag, and the artifact-type
skills. model invocation off: `batch` `debug` `design-sync` `doctor` `run-skill-generator`.
gated by env or flag: `commit`/`pr`, `schedule`, `claude-in-chrome`, `cowork-plugin`/`setup-claude`
(cowork only). no baseline exists for 2.1.258, so «new» is not decidable this run.

**agents spawned by the 2026-09-02 run (2.1.258):** 3 subagents (1 opus, 2 haiku — one
worktree-isolated), 2 one-agent workflows (opus, effort low / high), 2 `claude --bg` opus
sessions — one stopped by `claude stop`, one by `kill <pid>`, both registry files gone. worktree
auto-cleaned. no repo files touched by any probe.

**agents spawned by the 2026-08-30 run:** 4 subagents (2 haiku, 1 opus, 1 worktree-isolated),
1 fork, 1 rejected `name` validation, 2 `claude --bg` sessions — both stopped and verified gone.
no repo files touched by any probe.
