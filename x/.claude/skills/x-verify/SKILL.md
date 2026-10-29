---
name: x-verify
description: Load BEFORE verifying a change to `x`, the cli under `x/` — «verify x», «prove the verb», «x-go:gate», «lane pr-body», «brief preflight», a path-taking or cursor-paging verb, a sixth sense round on an x pr.
---

# x-verify

prove an `x` verb by running it, not reading it. the checks `x/AGENTS.md` § verify already lists (hostile argv, pty, planted trace dir, `replaces:`): see there; this file holds the rest.

## run it where it breaks

- a verb meant for a broken tree is run inside that broken tree, through the shim (FRM-352 retro, FRM-342 pr B)
- a worktree's `x/bin/x` is run by path, with a faked session id (FRM-359 codie)

## the gate and the live checks

- `timeout 600 pnpm x-go:gate` runs in the background, never piped (FRM-355)
- `x lane pr-body` is proven live on a real frame pr (FRM-355)
- `x brief preflight <ticket>` runs on the ticket under test (FRM-359 sixth sense)

## inputs

- every path-taking verb is probed with a file, a dir, `.` and a case variant (FRM-359 sixth sense)
- a cursor handed between polls gets a same-second case (FRM-364 codie)
