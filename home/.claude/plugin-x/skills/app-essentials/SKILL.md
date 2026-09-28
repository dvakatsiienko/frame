---
name: app-essentials
description: Load BEFORE creating or wiring up an app — «new app», «scaffold an app», «add an app to bytes», «wire up the app», «app essentials», «apps:essentials is red», a new dir under bytes apps/ — and before a coder spawn into an app that fails the checker.
---

# app-essentials

Every app carries the same essentials, and one script proves it. **The list lives only in the
script**: `bytes/script/apps-essentials.ts` (BYT-111). Read its data, never a copy here.

- bytes: `pnpm apps:essentials` (every app) · `--app <name|path>` (one) · `--staged` (the commit hook)
- chords, the one app outside bytes: `node ~/projects/bytes/script/apps-essentials.ts --app hotkeys/chords`,
  which frame's `chords-essentials` hook runs on a chords commit
- it is a required check on bytes main, runs in the commit hook, and prints in cclio's boot digest
- a gap prints `🔴 <app> <row> — <detail>` and names the tool that fills it; a 🟡 is a doc gone stale
  and never fails
- a waiver is a postponement with a reason and a ticket, kept in the script's data. it is lifted the
  day that ticket lands

## birth — a new app, in order

1. `AGENTS.md`: what the app is, how it runs, its hazards. The repo's root `AGENTS.md` gets its registry row.
2. `x:ftr` drafts `FTR.md` from the running app. Every line starts ⬜ until its check runs.
3. matt's `domain-modeling` writes `CONTEXT.md` and `docs/adr/0001-*.md`, with the stack pick as ADR-0001.
4. `/run-skill-generator <app>` makes `<app>-run`. It is user-invoked, so dima types it, or cclio
   spawns a one-shot session whose prompt is that command. Then write `<app>-verify` from it.
5. A ui app: impeccable `init` for `PRODUCT.md`, and `document` for `DESIGN.md` after the first build.
6. Run the checker until it is green, then commit. The hook refuses a commit that leaves a gap.

## verify kits — shared as they repeat, not hoisted later

trophy-sys has the first kit (`apps/trophy-sys/.claude/skills/trophy-sys-verify/kit.sh`). dima's
goal (2026-09-28): by the time every app has a kit, the shared part already exists, so no app's kit
is written twice. when a second app's kit needs a step another kit has, the step moves to a shared
home and both call it. the steps expected to repeat, each with its likely home:

- fake secrets and a free port per tree → `worktree:seed` (done)
- the essentials run against main's src as a baseline → `x:browser-headless`
- prove the store is local before any write → a `health` contract every app's api answers
- state backup and restore, admin login → a shared `verify-kit` lib that each app's kit sources

**Done** = the checker prints ✅ for the app, and its root README and `CONTEXT-MAP.md` rows exist.
