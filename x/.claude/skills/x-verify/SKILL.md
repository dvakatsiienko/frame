---
name: x-verify
description: Load BEFORE verifying a change to `x`, the cli under `x/` — «verify x», «prove the verb», «x-go:gate», «lane pr-body», «brief preflight», a path-taking or cursor-paging verb, a sixth sense round on an x pr.
---

# x-verify

prove an `x` verb by running it, not reading it. the checks `x/AGENTS.md` § verify already lists (hostile argv, pty, planted trace dir, `replaces:`): see there; this file holds the rest.

## run it where it breaks

- a verb meant for a broken tree is run inside that broken tree, through the shim (FRM-352 retro, FRM-342 pr B)
- a worktree's `x/bin/x` is run by path, with a faked session id (FRM-359 codie)
- a mutant's verdict counts against the whole package: a `go test -run` filter hid 3 rows that read as survivors (FRM-509 sixth sense)

## the gate and the live checks

- `timeout 600 pnpm x-go:gate` runs in the background, never piped (FRM-355)
- `x lane pr-body` is proven live on a real frame pr (FRM-355)
- `x brief preflight <ticket>` runs on the ticket under test (FRM-359 sixth sense)

## inputs

- every path-taking verb is probed with a file, a dir, `.` and a case variant (FRM-359 sixth sense)
- a cursor handed between polls gets a same-second case (FRM-364 codie)
- a fix that reorders a read reruns each probe on head and base, in both directions: a top-down fix passed its own rows and broke the reverse case (FRM-434 sixth sense)
- an audit verb's misses are opened in their transcripts before a clean, a sample at least, never only counted: 10 of 11 passed as real (FRM-434 sixth sense)
- a gate's row carries one real plant through the real hook before a clean: a fixture's strict flag hid a gate the hook lacked (FRM-473 sixth sense)
- mutants batch by 8 when the filter runs many go tests: 12 at load 38 took 585 s (FRM-473 sixth sense)
