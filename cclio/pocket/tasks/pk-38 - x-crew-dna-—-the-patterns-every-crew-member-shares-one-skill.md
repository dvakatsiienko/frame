---
id: PK-38
title: 'x:crew-dna — the patterns every crew member shares, one skill'
status: open
assignee: []
created_date: '2026-10-09 12:08'
updated_date: '2026-10-09 12:24'
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
<!-- SECTION:NOTES:END -->
