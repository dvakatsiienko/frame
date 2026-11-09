---
id: PK-373
title: 'linux vm: frame''s go tests run in a persistent vm on this mac, shape-idea'
status: open
assignee: []
created_date: '2026-11-09T14:19:00Z'
updated_date: '2026-11-09T14:20:00Z'
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
<!-- SECTION:NOTES:END -->
