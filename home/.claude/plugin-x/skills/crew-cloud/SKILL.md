---
name: crew-cloud
description: Load BEFORE any `claude --cloud` spawn — «run it in the cloud», «cloud session», «cloud coder», «offload to the cloud», «use the cloud credits», a `--teleport` read, a cloud session in ListAgents.
---

# crew-cloud — a coder on an Anthropic VM

A cloud coder is a full cc session on a fresh Ubuntu VM. It clones the **pushed** branch of one
GitHub repo, runs while the mac sleeps, and dies when idle. It carries **nothing of ours**: no
user `CLAUDE.md`, no rules, no plugin `x`, no memory, no 1password, no launchd. It does load the
repo's own `AGENTS.md` / `CLAUDE.md`. So the brief carries the rest, and the PR carries the report.

Sources: `docs/research/cc-cloud.md`, `docs/test-drive/cc-cloud.md`, code.claude.com
`claude-code-on-the-web` and `cloud-environments`.

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

- `frame` works: the encrypted set is every `filter=git-crypt` line in `.gitattributes`; a fresh clone has no filter
  config, so those paths stay ciphertext and the rest commits normally (? inferred from git's
  undefined-filter rule, unproven in a VM). the brief bans touching them.

## step 2 — launch

`--cloud` refuses a non-tty (measured). From a Bash tool call, wrap it in `script`:

```bash
cd <repo> && script -q <scratch>/cloud-<ticket>.log claude -n '<🌗|🌘> ☁️ <ticket> cloud: <what>' --effort medium --cloud "<the brief>" </dev/null >/dev/null
```

- **effort is medium by default**, like every coder and verifier (dima 2026-09-28); high only for
  a big sweep or migration. (? unproven that
  `--effort` reaches the VM — the first job with it asks the session its effort through
  `--teleport`, then this line loses its `?`)

- **`-n` comes before `--cloud`** — `--cloud` takes the brief as its own value; `--cloud -n …` dies
  on «--cloud requires a description» (measured, `docs/test-drive/cc-cloud.md` round 1). the name is type-first like every spawn (`x:crew-lead`); an unnamed session titles
  itself from the brief and is unfindable in the sidebar.
- the log ends with `Created cloud session: <title>`, `View: <url>` and `Resume with: claude
  --teleport <session_id>`. Keep all three; the session shows in `ListAgents` as `cloud`.

## step 3 — the brief

**In an environment that boots plugin `x` (see the setup script below), the prompt starts with
the coder contract** — probe 4 (2026-09-28): a cloud prompt opening with `/x:crew-codie` arrives
expanded, zero tool calls, the same door as a `--bg` spawn. Then only the cloud deltas follow:

```
/x:crew-codie <BYT-N> <one-line job>
cloud mode — you run on an anthropic vm, not the mac:
- you cannot message anyone: skip every ping and SendMessage step; the pr body is your report, the exit lines graded ✅/❌ in it.
- nobody answers questions: an open decision goes in the pr body as `? <question>`, and you take the safer option.
- no worktree: you are already on a fresh clone; branch `coder/<BYT-N>-<slug>`, `CI=1 pnpm install`, push, open ONE pr with gh.
- run everything in the foreground; the vm is reclaimed when idle.
- your last act, pr or no pr: push your final report as REPORT.md to a branch `cloud/<short-slug>` — clio's pr-watch sees that branch; nothing else tells it you finished.
```

**Without plugin `x` in the environment** (no setup script), the self-contained brief is
[references/brief-no-plugin.md](references/brief-no-plugin.md): the coder contract and our
coding rules inline, the `<crew-dna>` slot filled by `crew-dna-cloud`.

## step 4 — watch and read

- **the pr is the signal.** arm the pr watch from `x:crew-lead`, keyed on the ticket id in the
  pr body (`gh pr list --state all --search '<BYT-N> in:body'`), never on the head branch: a cloud
  session is pinned to its own `claude/<slug>` branch and ignores the brief's `coder/…` name.
- **send** a steer with `claude -p "<msg>" --cloud <id>`, which lands as a task. a `SendMessage` reaches a cloud session only as information, never a task (2026-09-28).
- 🚫 **it cannot answer by message** — ListAgents' own doc: a cloud session «cannot message any
  session back yet». never brief it to ping; never wait for one.
- **read** its transcript in a scratch clone of the same repo, never the main checkout:
  `claude -p "<question>" --teleport <session_id>` (measured: answers from the cloud history).
- `notify_when_idle` is same-machine only. the done signal is the session's `ListAgents` status turning `idle` — never a fixed sleep before a read.

## step 5 — close

- **a report is handled in place, the turn it lands** (dima, 2026-10-07: «what if reports have
  something useful? … take care of them in place») — never parked for a halt or a boot. read
  `REPORT.md`, act on what it says (a finding → a ticket line or a fix, a `?` → a question to dima),
  then delete the `cloud/<slug>` branch (`git push origin --delete cloud/<slug>`) and archive the
  card. the branch is the done signal: while it lives, every fresh session's pr-watch announces it
  again.
- archive and delete are web-ui only (claude.ai/code sidebar or the session menu; docs
  `claude-code-on-the-web#archive-sessions`, read 2026-09-28) — no cli verb, no api. an idle
  session costs nothing, its VM is reclaimed; the archive is sidebar hygiene. the pr merged or
  closed → the session is archived by the coordinator, never left for dima (his call, 2026-09-28:
  «if another army appears — you clean»), one line per archived name in the reply. probed 2026-10-28 (FRM-442): a
  cli-made cloud session opens on claude.ai/code in clio's browser pane, but its row menu holds no
  Archive, only Delete, which stays dima's word; until a door exists, clio names each finished
  session in the reply and dima archives it in the desktop sidebar, hover → archive.
- the verifier, the ci reviewer (`review.yml`, subscription oauth) and the done-comment in linear
  are the local flow's, unchanged: clio reads the pr and writes the comment.

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
- `crew-codie` and `crew-sixth-sense` are model-loadable but fire only on a brief that names them; a prompt
  that starts with `/x:crew-codie` expands (probe 4) — step 3's short form

## keys and browsers

- a key the job needs goes into the environment's **API credentials** (claude.ai/code → the
  environment → edit → API credentials), never an env var — env vars are readable in the session.
  the proxy attaches it per host; the session never sees it.
- the VM has no browser (measured). a browser check goes through Browserbase: credential on host
  `api.browserbase.com`, custom header `X-BB-API-Key`, no prefix (proven locally: 200; `Bearer` → 401).
- in the VM, node's built-in `fetch` skips `HTTPS_PROXY`, so the key never attaches (401): run node with `NODE_USE_ENV_PROXY=1`. a Browserbase session defaults to 300 s (ask for more at create), and the VM cannot reach `*.vercel.app` directly — read the app inside the remote browser (round 2, 2026-09-28).

## the meter

No field reads the $250 credit — not the statusline, not a cli (docs + research, 2026-09-28).
Before and after a cloud job the coordinator reads claude.ai → Settings → Usage through
`claude-in-chrome`, one page-text call each (dima's yes, 2026-09-28); the job's line in the test-drive
log carries both numbers.

**Done** = the pr exists with its exit lines graded, clio has read it, and the session is archived
or told to stop.
