---
id: PK-235
title: >-
  secrets wiring v2: 1Password Environments + shell plugins replace op.env and
  op-run.sh — shape-idea first
status: open
assignee: []
created_date: '2026-10-21T11:46:00Z'
updated_date: '2026-10-21T14:45:00Z'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-21, folded: i want every key — api keys, .env values, global cli tokens (github, linear, vercel) — in 1password, one place; they're scattered today, though the dev vault already exists and you read from it. the least known part for me is how 1password is wired into apps: the custom env file and op hook you built looked clunky to me, and i don't like clunky workarounds. does this change let us simplify it and drop that workaround? if yes, propose how.
facts (evergreen research 10-21, .scratch/evergreen-borrows/): today one tracked op.env holds 13 references and every op-run.sh call gets all 13; x reads keys with op read in-process because op run masks child output; bytes keeps gitignored plaintext .env files; gh, vercel and linear don't use the vault. Environments: one shared place per app; op run --environment <id> loads it for a process (service accounts work, so ci too); a local .env destination is a named pipe 1password serves on read (desktop app running, mac/linux, beta, 25 per computer, Vite's watcher may loop on it). shell plugins: gh and vercel log in through the desktop app + touch id, no token file; linear has no official plugin, a custom one is possible.
? the scope: frame only, or bytes' 15 apps too
? Vite + the FIFO .env: a probe before any app moves
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: waits on a cclio:shape-idea session, dima's word on the slot

slot (dima o7, 14:52): shape-idea after today's 4 grills, before the coordinator review.

2026-10-21 15:05 wishkeeper: ? a 1Password community bug says a service account gets «Environment was not found» even with read access (lanes/linkup.md:334) — op-run.sh runs on the x-fleet service account, so probe before shaping: OP_SERVICE_ACCOUNT_TOKEN=<x-fleet> op run --environment <throwaway id> -- env. also weigh 1Password's agent hook for Claude Code (linkup.md:340).

2026-10-21 16:11 the research moved: docs/research/evergreen-borrows-2026-10-21.md (1Password wiring) + the lanes summary in it.

**waiting for:** the coordinator review (PK-90) and the pm revamp (PK-103) — dima's o81, 2026-10-21 17:45
<!-- SECTION:NOTES:END -->
