---
date: 2026-08-30
slug: the-hook-day
tickets: [DOT-210, DOT-185, DOT-180, DOT-126, DOT-228]
posted: { health: yes, announcements: no }
---

# 🗞️ cclio's gazette · the hook day — the dispatcher retreats, the worktree gets a guard

## shipped

- **the global hook dispatcher retreated to per-repo lefthook** — lefthook's npm postinstall
  (`install -f`) ate the dispatcher's `pre-commit` overnight; an opus coder proved the mechanism,
  history voted per-repo (1 loud defect in 6 days vs 3 in 2, one silent), retreat landed
  `7074e9a` + bytes `e7287325`. the own-linker survives untouched; [DOT-210](https://linear.app/x-com/issue/DOT-210)
  carries the correction.
- **worktrees are safe now** — measured in a scratch clone: pnpm auto-installs before ANY script,
  so a fresh worktree's first gated commit rewrote the shared `.git/hooks` by itself. guard =
  `CI=1 pnpm install`, automated by a `PostToolUse(EnterWorktree)` hook (`ef156a2`) — every bg
  coder's worktree self-installs clean, proven live twice.
- **the channel question closed** — [DOT-185](https://linear.app/x-com/issue/DOT-185) done (cli
  where a shell exists, mcp where none), [DOT-180](https://linear.app/x-com/issue/DOT-180) done
  (notion shipped an official agent cli `ntn` + markdown api — the block wall was the hosted mcp),
  [DOT-126](https://linear.app/x-com/issue/DOT-126) done (zapier: light tokens, killer task
  metering). [DOT-228](https://linear.app/x-com/issue/DOT-228) is now THE note-taking showdown.
- **cw memory: no nightly regen exists** — retired by anthropic 2026-07-10 (docs verified);
  `docs/research/cw-memory-regen.md`. next: one collision probe, then trigger-based only.
- **skills wave** — handoff sweep 24h → 7d · x-cw 0.2.3: prettify = formatter (deletions become
  proposals), router map cut, `opus-mode` A/B, `mobile-mode` rename · spawn-mechanics re-verified
  on cc 2.1.251, raw research doc retired into `docs/knowledge/spawn-mechanics.md`.

## tricks gained

- `--bg '<prompt>'` runs the prompt now · a child starts in the PARENT's cwd (never spawn from
  `cclio/`) · registry name is `-n` · idle notices are queued — read their timestamp ·
  project-settings hook edits bind only for sessions spawned after them.
- ⚠️ `kill <pid>` did NOT stick for remote-control bg sessions — four respawned with new pids;
  `claude stop <jobId>` is the stop that held. under investigation next session.

## state

- tomorrow ~09:00 kyiv: cw probe fires once more → dima deletes the trigger → collision probe.
- parked: dima's prompt batch (next boot) · pm takeover groom · linear-users + gazette→cw (queued last).
- manual close mode adopted for tickets; `craft-pm` section still to write.
