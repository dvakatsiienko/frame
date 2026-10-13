---
id: PK-83
title: >-
  skills groom order: crew-coder + crew-verifier first, then the most used and
  the most bleeding
status: open
assignee: []
created_date: '2026-10-12 11:08'
updated_date: '2026-10-13 15:29'
due_date: '2026-10-16'
labels:
  - m
dependencies: []
priority: next
type: wish
ordinal: 10600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, boot 2026-10-12: when we switch to skills, the first to groom are crew-coder and crew-verifier — review their uncommitted drafts (from the two parked threads), review the skills myself, propose the final groomed and trimmed shape, commit only after that. then groom the most used skills and the most bleeding ones. also: print how far we are from finishing the memory slice of the sweep. the verifier's upgrade proposal (7 mechanisms, from the verifier-upgrade CST) is input for the crew-verifier groom.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: queued under the ≤5 open cap, 2026-10-12 — worked in ordinal order after PK-75–79

from the x domain-modeling coder's retro (2026-10-12): crew-coder has no line for empty args (`/x:crew-coder` with no ticket and no «dima» word) — the coder guessed dima mode; matt's domain-modeling is grill-first with no solo-audit mode — the coder ran it solo, open questions went to its report

15:27: crew-coder/SKILL.md's worktree carries one cclio line beside dima's draft — the impeccable-refine link now points at crew-lead/impeccable-refine.md (moved in cc048e1e); it rides the draft's commit at the groom; the plugin cache 0.11.285 already serves it

15:51 (wishkeeper): committed HEAD's crew-coder/SKILL.md:19 still points at the gone docs/knowledge/impeccable-refine.md until the draft's commit; writing-for-humans/SKILL.md never names references/sources.md — add the pointer at the groom

dima 18:01: when the memory sweep reaches skills, shape and run the skills recipe (never run yet) as the groom's engine.

dima o76/o77 19:55, don't forget: fleet-models moves into x:crew-lead (models knowledge serves only the spawner, cclio + dima — the one-home test) and merges with crew-lead/models.md, one copy; the shelf drops it.

dima o79–o81 19:57, don't forget: spawning-mechanics moves into x:crew-lead too (its references), with its drafted core (~/frame/cclio/.scratch/knowledge-79/core-6-7.md § 7); crew-lead keeps its procedure, the facts live in its references, delivered on load.

dima 19:59 on o81: spawning-mechanics was kept out of resident memory and skills on purpose, fat and of questionable shape — find the balance of volume, size and use. at the groom: measure crew-lead's loaded bytes (SKILL.md body + what a spawn reads) before and after; the moved files sit in references/, read on demand, and only a ≤4 KB core is ever delivered.

wishkeeper 21:44 → step 9: 7 app skills still say next dev rewrites AGENTS.md (settled false by bytes cc4ffe9a, agentRules: false): x-com-chat-run:61,71 · x-com-chat-verify:33 · cv-run:58,72 · cv-verify:49 · figmentation-run:73 · figmentation-verify:51 · financial-run:108

retro fold 10-12 (x domain-modeling coder): crew-coder has no line for empty args (a mid-turn `/x:crew-coder` with no ticket was read as dima mode) — one line in the skill groom

dima 22:07: before any skill groom, the skills recipe gets its x:shape-recipe pass (step 0 groom: it is old) and a real run (its research lanes); only then the groom order below

18:30 folded from PK-84 (o157): the verifier upgrades — the CST's 7 mechanisms, ranked, become tickets on dima's pick — land in the crew-verifier groom

19:25 (o161): the skills recipe is merged into recipes/nurture-memory as its step 9 (9.1 the skills research, 9.2 census, 9.3 conflict hunt, 9.4 this groom order, 9.5 the fire loop); the 18:01 and 22:07 asks above now mean that step
<!-- SECTION:NOTES:END -->
