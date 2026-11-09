---
id: PK-373
title: 'linux vm: frame''s go tests run in a persistent vm on this mac, shape-idea'
status: done
assignee: []
created_date: '2026-11-09T14:19:00Z'
updated_date: '2026-11-09T15:59:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-373:W1 (2026-11-09 15:35, dima, o12): looks like an interesting win. but is it free? what is the cost of this trick?
PK-373:W2 (2026-11-09 15:35, dima, o12): does this need to be applied across the whole fleet? in frame and bytes both? for all tests (go, vitest, everything else) or only go?
PK-373:W3 (2026-11-09 15:46, dima, o14): let's try, but i have clarifications. are you sure you picked the most optimal linux distribution version for this work?
PK-373:W4 (2026-11-09 15:46, dima, o14): is it worth researching our tricky move with this vm, exploring if someone else tested a similar approach, and what best practices we can borrow? maybe vm settings tweaks, or a linux distro that is optimized for tests, or other best practices and settings. for example, did we pick the correct ram value for the vm?
PK-373:W5 (2026-11-09 15:46, dima, o14): maybe there are complementary tools worth installing inside the vm.
PK-373:W6 (2026-11-09 15:46, dima, o14): how did you name the vm, and is it persistent or does it get created from scratch each time?
PK-373:W7 (2026-11-09 15:46, dima, o14): how do we optimize this move so the wins are clear wins, not blurred by some other bootstrapping set of chores that slows everything down? how do we make it a true win in performance?
PK-373:W8 (2026-11-09 16:19, dima, on the ram never given back): maybe start it during the boot and stop it during the halt?
measures and research: FRM-536's comments; ~/frame/.claude/worktrees/clio-wing-1/.scratch/vm-tests/

grill 1 settled 2026-11-09 16:27, dima's ticks o24-o31, all as picked:
- Q0 worth it, go only: no money; the vm's ram held boot to halt, one boot step, one halt step, go matched by go.mod's toolchain line, a mac fallback; against about 160 cpu-s and 3× the wall per go suite
- Q1 frame's go suite only (pnpm x-go:test and the commit hook's go job); vitest, mods, bytes stay on the mac
- Q2 persistent, started at clio's boot, stopped at the halt; the restart frees the ram lima never returns
- Q3 code in by git push to a vm repo (receive.denyCurrentBranch=updateInstead), warm GOCACHE and GOMODCACHE in the vm, the win counted as sync + run, cold and warm
- Q4 a stopped or broken vm sends the run to the mac, one line, never a red
- Q5 ubuntu 26.04 minimal arm64, --containerd none --mount-none, snapd and unattended-upgrades off, cpus and ram from a 4/6/8/10 vcpu sweep
- Q6 the name: round 2, seven candidates
- Q7 no tools inside past go, git and rsync

PK-373 name, dima's o32 steer 16:44: vm-go-test (over my go-test-vm pick)

16:46 name: vm-go-test (dima's 16:44 steer over go-test-vm); the lima instance frm536 is renamed at the build, never before

ticket: FRM-551
close: 2026-11-09 17:58 — shaped (grill 1 o24-o31, name o32, crow critique folded) into FRM-551, all 8 W-lines carried as FRM-551:W1-W8; the raw drop stays here

close: W1-W8 moved to FRM-551 as FRM-551:W1-W8 (W1 cost, W2 scope, W3 distro, W4 research, W5 tools, W6 name and life, W7 a clean win, W8 boot and halt)
<!-- SECTION:NOTES:END -->
