---
status: live
until: 2026-11-22
dies-when: the verdict line below is written
---

# worktrunk — a worktree cli (`wt`): a status list across trees and copy-on-write build caches

Ticket: none

**test card:** we believe `wt list` is the worktree view dima lacks, and `wt step copy-ignored` cuts a fresh tree's cold build · we test it by dima's own look at running lanes, and by giving a fresh bytes tree its caches before a real build · we measure seconds and cpu of `wt list` at many trees, seconds and disk for the copy, build cpu with it and without · we're right if dima reaches for `wt list` unprompted at least 3 times a week, and a copied cache cuts a fresh tree's first build by at least 30 % cpu, with no broken build
**kill rule:** `wt list` costs over 2 cpu-s at lanes' usual tree count, or a copied cache breaks a build once, or a release breaks either command

Not on trial, on dima's tick: `wt merge` (it lands on main past our pr flow), `wt switch` for lanes (no git-crypt seed or hook shims), the shell install, the cc plugin (it hooks worktree creation, where `worktree-seed.sh` sits). Installed by brew, not in the Brewfile until a verdict.

## stress list

- `wt list` — dima's look at running lanes, 5+ trees — wall, cpu, is it read
- `wt list --full` — the same with ci and summaries — wall, cpu, its model calls
- `wt step copy-ignored --dry-run` — a fresh frame tree, what it would copy — the file count, any `.env` or secret it would carry
- `wt step copy-ignored` — a fresh bytes tree, `.next` 81 to 326 MB, `node_modules` 2 GB — seconds, disk, then first build cpu against a cold tree
- `.worktreeinclude` — only build caches, no secrets — does it hold
- `wt step for-each` — `git status` across trees for a sweep — against a shell loop
- `wt step prune` — dry only — does it name what `x lane landed` would

## what users report

- its own tracker holds an open report of 15 to 25 git spawns per `wt list` or `wt remove`, costing 4 to 8 s on some machines: read it at round 2, since git spawns are our cpu bottleneck
- about 80 changelog lines say «breaking»: 81 by grep at v0.81.0, the video's count holds; 11,903 stars, one main author, about a release a week
- the author's cache numbers: a 14 GB Rust `target/` 2 min → 20 s, first build 68 → 3 s; reported, not ours, and Rust's

## rounds

- 2026-11-07 · `wt list` on frame, 7 trees, load about 50 · 0.32 s wall, 1.09 cpu-s; `git worktree list` 0.01 s · it shows each tree's changes and distance from main, which git's list lacks: better view, costs 100× the cpu

## verdict
