---
status: live
until: 2026-11-05
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
- 2026-10-23 · FRM-423 #105 round 1 (6d80b467), pr 0 of a cli lane: a sign door and a guard rule · contract written from the ticket before the diff, not contradicted · 6 probes: the guard rule fed x's root flags before the family, a pipe into sh, the flag in a variable; the sign hash fed a section below the block, bare text below it, a crlf body · breaks found: 2 (`x --json lane merge-auto … --dima-ok` skipped the guard — exit 2, refuted, fixed in round 2; text below `## signed` is never hashed — a decision, sent to cclio) · false alarms: 0 (round 1 also named `--apply` as a root flag, wrongly; the break held through `--json`/`--board`) · refutes caused: 1 · extra minutes: ~8 · the menu fit a cli: hostile-input probes against a pure function (`mergeWord`, `readSign`) called directly from a scratch file were the cheapest and found both
- 2026-10-23 · FRM-423 #106 round 1 (01431c6e), stack layer 1 of a cli lane: a head-mismatch brake and preflight reading the lane spec · contract written from the ticket before the diff, not contradicted · 4 probes: preflight run with no `--repo` from a worktree, a label POST refused after a mismatch, an omitted expected_head_sha, a dropped quoted line through main's quote-diff · breaks found: 1 (worktree preflight read the ticket, the want; refuted, fixed in round 2) · false alarms: 0 · refutes caused: 1 · decisions: 2 (refused label leaves no brake; an omitted field skips the check) · extra minutes: ~9 · the menu fit a cli: «run it from where its user stands» (a worktree) was the probe that broke; concurrency had no target
- 2026-10-23 · FRM-423 #107 round 1 (38bf30ac), stack layer 2: restack + verify-tree --stack + the pr-mode contract · contract written from the FTR lines before the diff, not contradicted · 8 probes: restack twice at once in one clone, restack from the bottom layer, a rival push mid-restack, the rerun after it, hostile argv (extra word, bare `--`, unknown flag, no `--apply`), frame's real commit-msg lint over the merge, live verify-tree --stack on #107, live on a no-stack pr · breaks: 1 (the rejected-push dead end, a decision) · false alarms: 1 (the lint hook) · refutes caused: 0 · extra minutes: ~10 · the menu fit a cli: «a rival writer between read and write» was the probe that broke
- 2026-10-23 · FRM-423 #107 round 2 (18e5ab58): contract from o194 before the diff · 9 probes (submit merged with no head, poll fails, submit fails, failed with no head, poll names another head, release of an unreadable record, a second brake while a record holds, failed-poll surface, live merge-async shape from gh-stack) · breaks: 1 (failed poll hides unverified + release; refuted, fixed in round 3) · decisions: 1 (submit 500 leaves the brake off) · false alarms: 0 · ~15 min
- 2026-10-25 · FRM-411 bytes#130: 4 probes on the review-round counter, 1 broke (an unencoded branch name in `?branch=` lifted the one-round cap, `x&status=failure`), 0 false alarms, ~6 min — the lane's only real defect, fixed in 0443df8; the verifier suggests a probe list per state kind (a counter, a gate, a check run)

## verdict
