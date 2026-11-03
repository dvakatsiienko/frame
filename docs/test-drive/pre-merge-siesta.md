---
status: live
until: 2026-11-17
dies-when: the verdict line below is written
fits: clio
---

# pre-merge siesta — a siesta and a wishkeeper read over each chunk before its merge

Ticket: none

**test card:** we believe a wishkeeper read of a finished chunk against dima's W-lines and clio's promises catches what sixth sense's exit-line grade misses, cheaper before the merge than after · we test it by running `clio:siesta` with a wishkeeper over every lane chunk the moment codie's «final» lands, before sixth sense's verdict turns into a merge; its retros fold in the same siesta · we measure per chunk: wishkeeper findings by severity, highs that were real (checked at the cited spot), the extra lane round each high cost in minutes, and highs found after the merge on chunks that skipped it · we're right if over 2 weeks at least 1 in 3 chunks gets a real high fixed before merge, and the extra round averages ≤ 20 min
**kill rule:** 5 chunks in a row with no real high, or one extra round over 45 min without a real high behind it
**the rules:** a real high buys the lane one more fix round; the ci code review stays at one round; retros of the chunk fold at this siesta, never piled to the lane's end (dima, 2026-11-03 13:10)

## stress list
- a mods quick-lane chunk (mods lane 4, FRM-472 first) — wishkeeper over the base..final range — findings, minutes
- a chunk whose rider clio built herself (FRM-472 07c (b), fork-guard) — does the read cover clio's own commits
- a side-lane pr chunk (the next cli or bytes lane) — the same read over a pr diff
- the retro fold per chunk — retros folded at the siesta, lines moved, minutes

## rounds
- 2026-11-03 · FRM-472 (mods quick lane, 50c3f7db → ff02e946, after sixth sense's clean on round 5) · wishkeeper 13 min, 12 findings: 2 high real (o83 only partly met, 6 unwarned variants with no fixing ticket → pk-309; fork-guard's pocket pass let a tab split a non-pocket path → fixed 052c6e0e, red-proven), 5 medium (the done test says «refused» while the code warns; a stale replay count; an exponential `$((` cost) · hit: both highs were invisible to sixth sense's exit-line grade, one was in clio's own rider
- 2026-11-03 · FRM-496 (clio-lean quick lane, 1a92c8cd → 3e532a0b, after sixth sense's round 1) · the first siesta behind `siesta-checks.ts` (5 sections pre-run, 4 green, blueprint drift known) · wishkeeper 5 min, 119,951 tokens, 33 tool calls, 13 findings: 1 high real (FRM-499 left an idle member cold) → already fixed by the 19:25 re-sign (o102); 5 medium, 7 low · no earlier round carries a token count, so this is the baseline, not a saving

## verdict
