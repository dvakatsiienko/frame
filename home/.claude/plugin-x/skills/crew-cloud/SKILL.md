---
name: crew-cloud
description: Load BEFORE any `claude --cloud` spawn — «run it in the cloud», «cloud session», «cloud coder», «offload to the cloud», «use the cloud credits», a `--teleport` read, a cloud session in ListAgents.
---

# crew-cloud — a coder on an Anthropic VM

A cloud coder is a full cc session on a fresh Ubuntu VM. It clones the **pushed** branch of one
GitHub repo, runs while the mac sleeps, and dies when idle. It carries **nothing of ours**: no
user `CLAUDE.md`, no rules, no plugin `x`, no memory, no 1password, no launchd. It does load the
repo's own `AGENTS.md` / `CLAUDE.md`. So the brief carries the rest, and the PR carries the report.

Sources: `docs/vet/browserbase.md` round 1 (the probe, 2026-09-28), the day's research in
`docs/research/cc-cloud.md`, code.claude.com `claude-code-on-the-web` and
`cloud-environments`.

## when the cloud, when `--bg`

- ✅ a well-specified PR-lane ticket on `bytes` or `frame`: exit lines written, no taste call
  mid-flight, no dima hands needed
- ✅ the night: it survives the mac sleeping, and the cloud credit pays first (dima's usage page:
  «applies automatically to cloud sessions»)
- ✅ parallel PRs across tickets that touch different files
- 🎯 local `--bg` instead for: taste work, anything reading the vault, hotkeys, launchd, raycast,
  1password, a design loop dima steers by eye

## step 1 — the tree the VM will see

The VM clones the remote at the current branch. `git status` clean, the base pushed, and every
file the brief points at committed and pushed. A brief that names an unpushed file names nothing.

- `frame` works: git-crypt covers one file (`gmail/blocklist.json`); a fresh clone has no filter
  config, so it stays ciphertext and the rest commits normally (? inferred from git's
  undefined-filter rule, unproven in a VM). the brief bans touching that file.

## step 2 — launch

`--cloud` refuses a non-tty (measured). From a Bash tool call, wrap it in `script`:

```bash
cd <repo> && script -q <scratch>/cloud-<ticket>.log claude --cloud "<the brief>" </dev/null >/dev/null
```

The log ends with `Created cloud session: <title>`, `View: <url>` and `Resume with: claude
--teleport <session_id>`. Keep all three. The title is generated from the brief (? no flag names
it); the session also shows in `ListAgents` as `cloud`.

## step 3 — the brief

**In an environment that boots plugin `x` (see the setup script below), the prompt starts with
the coder contract** — probe 4 (2026-09-28): a cloud prompt opening with `/x:crew-coder` arrives
expanded, zero tool calls, the same door as a `--bg` spawn. Then only the cloud deltas follow:

```
/x:crew-coder <BYT-N> <one-line job>
cloud mode — you run on an anthropic vm, not the mac:
- you cannot message anyone: skip every ping and SendMessage step; the pr body is your report, the exit lines graded ✅/❌ in it.
- nobody answers questions: an open decision goes in the pr body as `? <question>`, and you take the safer option.
- no worktree: you are already on a fresh clone; branch `coder/<BYT-N>-<slug>`, `CI=1 pnpm install`, push, open ONE pr with gh.
- run everything in the foreground; the vm is reclaimed when idle.
```

**Without plugin `x` in the environment**, the self-contained brief below carries the core
rules inline. Fill every `<…>`; the fence body is the prompt.

```
you are a cloud coder for ticket <BYT-N>: <one-line job>.
repo: <owner/repo>, base <branch>. its AGENTS.md is binding — read it first, then the ticket body below.

## the job
<ticket body, or the plan file path you pushed>

## exit — done means every line holds
<3–6 given/when/then lines from the ticket>

## how we code (our fleet rules; the VM does not have them)
- less is more: delete, derive or inline before you add. no speculative abstraction, no unasked docs.
- typescript: no `any`; inferred types over annotations; zod at boundaries only.
- names are entity-first: `usageSave`, not `saveUsage`; `crew-coder`, not `coder-crew`.
- comments only for a non-obvious why, one line.
- tests prove a contract, one behaviour each, runner vitest; a test is proven by making it fail once.
- setup: `CI=1 pnpm install` (keeps git-hook shims out). typecheck + the touched tests must pass.
<frame only: never touch gmail/blocklist.json.>

## git and the pr
- branch `coder/<BYT-N>-<slug>` from the base. step commits.
- commit subject `<emoji> <scope>: <lowercase imperative>`; emoji: 🔧 feature/config · 🐞 fix · ✨ refactor · 🗑️ delete · 📜 docs · 🎨 visual · 📦 deps. body: hyphen bullets, a line `- ticket: <BYT-N>`, last line `Agent: crew-cloud · <model>`.
- never write a linear keyword (closes, fixes, resolves, refs …) next to a ticket id, anywhere. never write a skip-ci marker.
- push the branch and open ONE pr (not a draft) with `gh` as soon as the first commit exists. pr body ≤ 25 lines: what shipped, what is left, the exit lines with ✅/❌, one line per known defect.

## you are alone
- nobody answers questions: a decision you cannot make goes in the pr body as `? <question>` and you continue with the safer option.
- run everything in the foreground; the vm is reclaimed when idle and background jobs die with it.
- finish with the pr body updated. that is your report.
```

## step 4 — watch and read

- **the pr is the signal.** arm the pr watch from `craft-spawning` (a `Monitor` on
  `gh pr list --search 'head:coder/<BYT-N>'`), so the verifier spawns within a minute of the pr.
- **send** a steer: `SendMessage` to its `ListAgents` name, or `claude -p "<msg>" --cloud <id>`.
- 🚫 **it cannot answer by message** — ListAgents' own doc: a cloud session «cannot message any
  session back yet». never brief it to ping; never wait for one.
- **read** its transcript in a scratch clone of the same repo, never the main checkout:
  `claude -p "<question>" --teleport <session_id>` (measured: answers from the cloud history).
- `notify_when_idle` is same-machine only. the done signal is the session's `ListAgents` status turning `idle` — never a fixed sleep before a read (a 150 s timer read probe 2 three minutes late).

## step 5 — close

- no cli stops a cloud session (`claude stop` is local only). the pr merged or closed → the web
  ui's archive, or a «stop and summarize» message.
- the verifier, the ci reviewer (`review.yml`, subscription oauth) and the done-comment in linear
  are the local flow's, unchanged: cclio reads the pr and writes the comment.

## the environment's setup script — plugin `x` in every cloud session

Probe 2 (2026-09-28) proved the VM reaches private `frame` and installs plugin `x` from a sparse
clone, the same directory-marketplace way the mac does. Installed in a running session, the skills
load only in the next one — so it belongs in the environment's **setup script** (claude.ai/code →
the environment → settings icon → Setup script), which runs before claude starts and is cached:

```bash
#!/bin/bash
set -euo pipefail
git clone --depth 1 --filter=blob:none --sparse https://github.com/dvakatsiienko/frame /opt/frame
git -C /opt/frame sparse-checkout set home/.claude/plugin-x
claude plugin marketplace add /opt/frame/home/.claude/plugin-x
claude plugin install x@x
```

- the VM gets the **pushed** plugin version, frozen until the environment cache rebuilds (~7 days
  or a script edit) — a skill edit reaches the cloud after a push and a rebuild
- ✅ proven by probe 3b (2026-09-28, environment «cloud base», network Custom: default list +
  `*.browserbase.com`): a fresh session listed 19 `x:*` skills, `gh` 2.45 came from ubuntu's
  archive (`apt-get install -y gh`), node 24 + pnpm 12.3.4 from dima's fnm block
- user-invoked skills (`crew-coder`, `crew-verifier`) never show in the model's list, and a prompt
  that starts with `/x:crew-coder` still expands (probe 4) — step 3's short form

## keys and browsers

- a key the job needs goes into the environment's **API credentials** (claude.ai/code → the
  environment → edit → API credentials), never an env var — env vars are readable in the session.
  the proxy attaches it per host; the session never sees it.
- the VM has no browser (measured). a browser check goes through Browserbase: credential on host
  `api.browserbase.com`, custom header `X-BB-API-Key`, no prefix (proven locally: 200; `Bearer` → 401).

## the meter

No field reads the $250 credit — not the statusline, not a cli (docs + research, 2026-09-28).
Before and after a cloud job, dima's usage page is the reading; the job's line in the vet log
carries both numbers.

**Done** = the pr exists with its exit lines graded, cclio has read it, and the session is archived
or told to stop.
