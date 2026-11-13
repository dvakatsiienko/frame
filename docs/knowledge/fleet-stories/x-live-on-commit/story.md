---
status: open
dates: 2026-11-13 → 2026-11-13
tickets: [FRM-621, FRM-624]
tags: [x, build, quick-lane, review]
fed-by: incidents
---

# x goes live on commit, before anyone reads it

## what happened

- 17:38 main clio set a rule: every x diff waits for her read before the push
- 19:44 the strays codie (Sonnet 5.5, a quick lane on main) committed FRM-621 (86953b92): `x mods edit` moved its scratch to one dir per session
- wing 1 sent the diff to main for her read and held the push, thinking the change was not live yet
- 19:45 `x mods edit status` in `~/frame` already read the new per-session dir. the mods codie was mid-FRM-504 with 20 edited files in the shared scratch, so its next call would have found an empty one
- 19:47 the codie reverted it as a new commit (5471d417); status read the shared scratch again, the 20 files intact. no edit was lost

## the cause

- the x shim (`home/.local/bin/x`) rebuilds from the main checkout's working tree whenever an x/go file is newer than the binary. a commit, or even an unsaved edit, on main is live for every session at once
- so the read-before-push rule guarded the remote, not the fleet: the change had already reached every session

## the wrong call

wing 1 (Opus 5.5) dispatched an x change to a shared on-disk path as a quick lane on main, and treated the push as the moment it went live. cost: three minutes of a broken `x mods edit` for the mods codie, and a revert commit.

## what changed

- FRM-621 waits; it is re-applied after FRM-504 lands
- crow named the root (20:14): FRM-624 makes every session run a promoted build, never the working tree

## the line that keeps it away

until FRM-624 lands: an x/go change on main is live at its commit, so one that changes a shared path or state is timed by its commit
