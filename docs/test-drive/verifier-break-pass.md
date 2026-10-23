---
status: live
until: 2026-11-04
dies-when: the verdict line below is written
fits: verifier
---

# verifier-break-pass — the verifier also tries to break what it checks

Ticket: none

**born:** 2026-10-21 from `refresh-crew-coordinator` run #6 ([the findings](https://claude.ai/artifact/UQDHgn3qcntgD2UCShxpfv), `recipes/refresh-crew-coordinator/last/run6/research-craft.md` § 1, `neuroarxiv.md`). dima, o107: «let's try. what I didn't like is the noise part, but let's test drive this verifier extension. make it easy to undo if it doesn't work, and most importantly, measure it on all PRs the verifier runs.»

**test card:** we believe a capped break pass makes the verifier catch real breaks the exit lines miss · we test it by every PR a verifier checks until `until:` (the cli lane first), round 1 only · we measure per PR: probes run, breaks found, false alarms (a break dima or the coder shows is not one), refutes it caused, extra minutes · we're right if over all trial PRs at least 1 real break the exit lines missed turns up and false alarms stay at or below real breaks
**kill rule:** false alarms beat real breaks over 3 PRs in a row, or the pass adds more than 20 min to a round twice

**undo:** delete the «break pass» bullet in `x:crew-verifier` step 1.4 and the `break:` line of its verdict object; both name this file.

## stress list
- the contract written from the ticket before the diff (the neuroarxiv open thread: does it drift toward what was built?) — every PR — contract lines that the diff later contradicted
- concurrent action — a PR with a write path — broke or held
- slow or failed network — a PR with a fetch — broke or held
- hostile input — a PR with a form, an arg or a parser — broke or held
- a cli PR (no browser) — the cli lane — does the menu fit a cli at all

## rounds
- 2026-10-22 · FRM-403 #96 round 1 (bb7019ff), a cli pr · contract written from the ticket before the diff, not contradicted · 8 probes: rebase-main on a dirty tree, a detached head, an up-to-date branch, a rerun mid-conflict; verify-tree twice on one pr, 5 hostile targets, from inside another tree; plus 7 hostile force-push shapes through the guard · breaks found: 1 (verify-tree refuses a second round on the same pr and points at decamp, which a verifier may not run — the want, not an exit line) · false alarms: 0 · refutes caused: 1 · extra minutes: ~9 · side finds: `git push --mirror` passes the guard (predates the pr); a mid-rebase rerun gives wrong `next` advice · the menu fit a cli: concurrent and network probes had no target here, the state probes (dirty, detached, mid-rebase, rerun) did the work
- 2026-10-23 · FRM-404 #98 round 1 (e27d1f16), a cli pr wrapping a third-party cli · contract written from the ticket before the diff, not contradicted · 3 probes, all an upstream source read of github/gh-stack main@6721eba: exit codes 7/8/9, the paused-rebase text, `view --json` against `link` · breaks found: 1 (`stack view` cannot see a stack `stack link` made — gh-stack's `link` writes no local state, its `view` reads only that; the fake gh answered regardless — the want, not an exit line) · false alarms: 0 · refutes caused: 1 · extra minutes: ~12 · the menu fit a cli: a new probe kind earned its place, «read the wrapped tool's source against our fake»; concurrent and network had no target
- 2026-10-23 · FRM-405 #99/#100/#101 round 1, a 3-layer cli stack · contract written from the ticket before the diff, not contradicted · 9 probes: hostile path lists (tab, newline, double space, leading space), LEFTHOOK=0, core.hooksPath, a `git mv` with a changed quote, a staged delete, a new memory file · breaks found: 2 (a quote changed in a renamed rules file committed unseen — the want; LEFTHOOK=0 ran 0 typechecks, not 1 — a decision, taken) · false alarms: 0 · refutes caused: 1 · extra minutes: ~10 · the menu fit a cli: state probes (rename, delete, env switch) did the work again

## verdict
