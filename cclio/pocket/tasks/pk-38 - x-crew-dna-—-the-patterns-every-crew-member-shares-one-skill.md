---
id: PK-38
title: 'x:crew-dna — the patterns every crew member shares, one skill'
status: done
assignee: []
created_date: '2026-10-09 12:08'
updated_date: '2026-10-09 12:43'
labels:
  - l
dependencies: []
priority: now
type: idea
ordinal: 2200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-07 (the recipes grill, logged only in docs/test-drive/memory-sweep.md — lost until 2026-10-09): analyze the whole crew-* skill set (crew-coder, crew-verifier, crew-designer, crew-designer-interview, crew-adviser, crew-cloud), extract the patterns that hold for every crew member, and shape them as one common skill, `x:crew-dna`, that every crew member loads. dima, 2026-10-09: «crew-* skills are crew members' DNA, the contract they function by».
- shape first (x:shape-idea, invariant 3): what belongs in the dna vs a role skill, how a role skill points at it, the load mechanism
- the audit numbers (.scratch/retro-audit.md) are the input: duplicates already sit across crew-coder and crew-verifier
- pk-25 (the crew-coder groom) follows it: the groom moves the shared lines out into the dna
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
grill r1 decided (dima 10-09): Q1 dna = holds for every member regardless of role, role skills keep only role steps · Q2 each role skill's step 0 reads crew-dna, the first reply names its version · Q3 the crew = coder, verifier, designer, adviser + the planned crew-lead; crew-designer-interview and crew-cloud are coordinator-side · Q4 audience decides, one home per lesson (dna = the member's side, craft-spawning = cclio's). map: .scratch/crew-dna-map.md. dima: «treat current skill/memory grooms as forced, mandatory because they bleed; still review/re-groom in scope of the memory sweep»

grill r2 decided (dima 10-09): Q5 dna ≤ 7k, each role skill ≤ 12k, the size test enforces · Q6 retro ≤12 lines for every member, most important first · one Agent: trailer per x:cmt · the verifier's round cap (medium+ findings, reset on scope growth) · cclio adds dima as reviewer after clean · the verifier writes no linear comment, the coder's done comment says «verified clean, round N» · Q7 the 15 single-sited rules go through the entry rule; deletions shown as count + one line · Q8 crew-designer's «cclio's side» moves to craft-spawning · Q9 no stored cloud copy: the cloud spawn pastes crew-dna into the brief

r3 (dima, 15:24, all as recommended): Q10 rules held by a subset → dna sections per subset, each headed with who reads it; all ~30 rules tagged with their members and counted before any edit. Q11 cloud paste → a script prints crew-dna byte for byte, mac-only lines tagged and dropped; proof = byte diff of one real cloud brief vs the file. shape step 3 (prior art) and step 7 (PRODUCT/FTR) skipped on his word; outputs = this body + the skill. critic folds: nonce + Read proof, key-term greps, 7k cap re-checked after the first draft.

cut v1 accepted (dima 15:26): tag ~30 rules with their members, then count · crew-dna = nonce version line + every-member core + subset sections headed with who reads them · coder, verifier, designer, adviser read it at step 0 and lose every moved line · 5 conflicts resolved in one place · designer's coordinator section → craft-spawning · crew-cloud: a script prints the dna byte for byte, mac-only lines dropped. out: crew-lead · renaming interview/cloud out of crew-* · the coder groom to 12k (pk-25) · the memory sweep's re-review. polish tier: works and clear.

done test accepted (dima 15:27): 1 nonce in the first reply + a Read of crew-dna, red on step-0 deletion · 2 one key term per rule lives only in crew-dna · 3 size test: dna ≤7k (re-checked after draft), verifier/designer/adviser ≤12k · 4 cloud brief byte diff vs dna minus mac-only lines is empty · 5 each conflict's term in exactly one place · 6 designer's coordinator section lives in craft-spawning. SHAPED. build: cclio on main, quick lane — tag map, dna draft, cuts one skill per commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
crew-dna v1 shipped in x 0.11.248: 4.6k dna, 4 role skills cut (62.7k → 54.2k total), conflicts settled once, designer's pick in craft-spawning, crew-dna-cloud paste script + 5 tests, per-skill size caps red-proven. done test 1 green on a fresh opus coder (Read of crew-dna + kelp-41 quoted); its red half (step-0 line deleted) not run. finding: the dna's «only SendMessage travels» misreads dima mode, where his chat is the channel.
<!-- SECTION:FINAL_SUMMARY:END -->
