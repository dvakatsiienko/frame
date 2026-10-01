# flawlog · 2026-10-01 · cclio · run cc·20260929·readaloud

- wispr ignores an applescript quit (main pid stayed, a helper spawned at 14:07:41) · the dictionary write could not run, nothing touched · a write needs dima's ⌘Q, or a probe of writing while it runs
- speak's daemon.err.log lines carry no date · today's window had to be found by line number · a date per line goes into the speak coder's exit lines
- research-lanes.sh exits 0 when both lanes fail (missing brief → «create failed», «exit 2») · a fan-out looked green and ran nothing · the script should exit non-zero when any lane fails
- fixed: a Linear create that answered «usage limit exceeded» still created the ticket (FRM-279), and my retry made a twin (FRM-281) · one dupe, closed as duplicate · before any create retry, search the run marker (x:pm already says so; I skipped it)
- a race, not a cache: the FRM-283 coder handed each round to the verifier in the same minute it asked cclio to push (a frame worktree cannot push), so the verifier's live `git ls-remote` ran before the push landed and printed «remote is still X» three times · three false alarms · the hand-off order: coder pings cclio → cclio pushes and confirms → only then the round goes to the verifier (x:crew-coder, the frame lane)
- FRM-283 coder retro (flush candidates): live tests on dima's daily daemon cut his reads twice → a quiet-window protocol for audible tests (announce, wait, check `speaking` before a swap) · «round N only after cclio's push» belongs in x:crew-coder for repos a coder cannot push · frame worktrees cannot push: 9 push round-trips → a `lane push` from the main checkout, or a mirror gate that skips in a worktree · «capture the real grab before writing a normalizer rule» (one F4 beat guessing) · theory-right runtime-wrong twice, caught only by the live ear and log · sonnet helper spawned before EnterWorktree had no Bash · promote `speak:daemon-swap` and `speak:audible` from the coder's scratch
- #53 verifier retro: a verb that shells out (bun, git-crypt) was green on the mac and red on ci — candidate verify-recipe line «a verb that shells out runs on the ci runner before a local green is trusted» · cost one ci round
- #53 verifier retro: `gh run list --commit <sha>` misses pull_request runs (they run on the merge sha); filter `--branch` by headSha — candidate x:github-contrib line
- #53 verifier retro: `CI=1 pnpm install` still printed «sync hooks» and re-synced the shared lefthook shims to the worktree — the fleet-hazards CI=1 guard may be wrong on pnpm 12; re-measure before trusting it
- #53 verifier retro: two hand-repeated checks worth a script — a smudge-off worktree for git-crypt paths; a mutation spot-check (flip, vitest + tsc, restore)
- #53: the coder branched from local main 10 commits ahead of origin — the pr carried 56 files and a merge would have published them; a coder branch should start from origin/main, or main is pushed before the pr opens
- #53 coder retro: skipped the crew-coder first-act `origin/main..main` check → the 10-commit ride-along; candidate: `x lane` warns when the base is ahead of origin (v0.1)
- #53 coder retro: a new runtime dep in tests needs its ci step in the same commit — candidate line for x:crew-coder or fleet-hazards
- #53 coder retro: the worktree guard refused computed paths in python/sed/loops ~4×; the scratch-script-by-path hazard line was read late
- #53 coder retro: `rules/fleet-hazards.md` still names plugin-x `lane` — update to `x lane` after #53 merges (rules edit, needs dima's ask)

## flushed 2026-10-01 ~19:55 (dima: «do everything obvious»)
- → x:crew-coder: `x lane` is the lane (push from a frame worktree included); a test's new tool ships its ci step in the same commit
- → x:crew-verifier: a shelling-out verb is trusted only after the ci runner ran it
- → rules/fleet-hazards: `x lane`; the `CI=1 pnpm install` guard marked «re-measure on pnpm 12»
- → speak/AGENTS.md: announce a daemon swap and check `status` first; a normalizer rule starts from the real grab
- → FRM-281 (log lines get a date) · FRM-282 (speak:daemon-swap, speak:audible) · FRM-285 closing word (the v0.1 list: base-ahead warning, smudge-off + mutation verbs)
- dropped, verified false: «`gh run list --commit` misses pull_request runs» — it returned run 36888180692 (pull_request, 6c3e772)
- dropped, fixed: the FRM-279 dupe, the wispr quit (sqlite writes while it runs), the push race (`x lane push`), research-lanes exit 0 (27939592), the sonnet-before-EnterWorktree helper (one sighting, kept in the coder retro)
