- 🎲 frame pre-commit `test` failed once (🥊, no output kept) and passed on an identical retry 1 min later; `pnpm test` by hand = exit 0. cause unknown, a flaky gate — watch for a second sighting (2026-10-04 17:15)
- ✅ correction: the second `test` red (17:45) was mine — reply-check.test.ts asserted the ⏳-footer `·` exception i had just removed. only the 17:15 red stays unexplained
- 🎲 2nd sighting 19:13 — frame pre-commit `test` red in 0.75 s (vitest needs ~2.5 s), the identical retry green. both sightings: the first commit attempt right after staged files changed. cause unknown → flawlog flush: a ticket or a lefthook retry

- 19:25 · rule conflict: `cclio:init` step 1 says name `d03f3da` on the board, `fleet-output-format` bans commit hashes in replies → reply-check flagged the boot board. one of the two rules moves (the probe fact could be a non-hash word)
- 19:30 · stash band vanished after a peer-woken turn: `stash/hooks/register.tsx` sets `userTurn` from any non-empty `turn.start` text, so a cross-session idle notice counted as dima's turn, the reply had no ⏳ block, and the Stop hook deleted the bucket
- (cclio old, relayed) a failed `git add` on a vanished path (the deck dir) aborted the whole add, so the stash code never staged; the commit landed partial and a follow-up commit carried the code. same shape as the `git mv` hazard: stage only paths that exist
- (cclio old, relayed) `·` separators inside sentences printed again; reply-check logged 3. the 10-16 verdict decides the block
- 21:0x · 3rd sighting of the `d03f3da` conflict: this session's boot board named the hash again, following `cclio:init` step 1
