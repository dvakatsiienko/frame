---
id: PK-387
title: 'lanes-checkup reshaped: a pretty fixed reply for chosen lanes'
status: open
assignee: []
created_date: '2026-11-12T16:01:00Z'
updated_date: '2026-11-12T16:17:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 59000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
18:01 wish, dima 17:49 + 18:00 + o59 (raw: ~/.local/state/clio/prompts/2026-11-12.md:705, :739), folded:
PK-387:W1 (2026-11-12 17:49, dima) shape the lanes-checkup skill with me; the skill keeps a fixed reply shape.
PK-387:W2 (2026-11-12 17:49, dima) when i ask for a checkup i want an easy-to-read, clean report on a set of lanes i pick: one, two or three, by name.
PK-387:W3 (2026-11-12 17:49, dima) done chunks are not printed; they print only when i ask.
PK-387:W4 (2026-11-12 17:49, dima) print every pending chunk of the picked lane or lanes; only when i ask for a number of chunks, print just the ones i asked for.
PK-387:W5 (2026-11-12 17:49, dima) the shape: a mini-header per lane, then numbered lines: the ticket — one line on what it is about (not 3 words, not 10 lines), clear about what is under the hood.
PK-387:W6 (2026-11-12 17:49, dima) the done shape: a mini-header per lane, numbered: the ticket — an interesting detail line on what it buys us.
PK-387:W7 (2026-11-12 17:49, dima) you ran ahead of me; stop it. a pretty shape for lanes-checkup first.
PK-387:W8 (2026-11-12 18:00, dima) the output looks better but a little bare: slightly prettier, spacious, bold where it fits.
PK-387:W9 (2026-11-12 18:00, dima) the skill fix: «someday»-labelled stuff stays out.
PK-387:W10 (2026-11-12 18:00, dima) ❓ does this checkup skill overlap with low-tide or low-tide-triage?
PK-387:W11 (2026-11-12 18:00, dima) a ticket running now is visible (an emoji?), with what is left and an estimate of the time left, based on today's cadence.
PK-387:W12 (2026-11-12 18:00, dima) print each chunk's size: M, S, XS and so on.
PK-387:W13 (2026-11-12 18:00, dima) redo the skill: start shape-idea, then print the list another time.
PK-387:W14 (2026-11-12 18:01, dima, o59) ❓ what is a map file?

18:06 dima 18:06 (raw: ~/.local/state/clio/prompts/2026-11-12.md:764), folded:
PK-387:W15 (2026-11-12 18:06, dima) our plan now: 1. shape the checkup skill properly; 2. run the checkup so i cleanly understand the roadmap for the lanes; 3. fix your flyway; 4. then park for some time.
PK-387:W16 (2026-11-12 18:06, dima) ❓ maybe rename it to low-tide-lanes-checkup, since it is close to what low-tide does?
PK-387:W17 (2026-11-12 18:06, dima) ❓ what shapes or parts can we reuse across the set of skills?

18:17 dima 18:16 (raw: ~/.local/state/clio/prompts/2026-11-12.md:780), folded:
PK-387:W18 (2026-11-12 18:16, dima) q1: i do not agree. then we need to rebrand low tide: it is primarily meant to optimize our flows.
PK-387:W19 (2026-11-12 18:16, dima) i usually ask for low tide when i spot that your pocket is cluttered, or suspect linear has messy tickets, a lot of strays or unfinished tickets; also when i want to see the picture of lanes and chunks. it is all about proper planning and coordination, cleaning included.
PK-387:W20 (2026-11-12 18:16, dima) low tide itself is for hunting; low tide triage is the prep for flyways; low tide lane checkup is for seeing where we are in the chunk plan.
PK-387:W21 (2026-11-12 18:16, dima) what i want out of the lane checkup specifically: to see the plan and potentially reorder it.
PK-387:W22 (2026-11-12 18:16, dima) i still vote for low-tide-lane-checkup. propose how to have it: low tide is a skill set for hunting and fixing our plans' gaps and inefficiencies.
PK-387:W23 (2026-11-12 18:16, dima) q2 filter: ok, the checkup points to triage's filter, and let's reuse the shape efficiently (but is triage sharpened against the flyway?).
PK-387:W24 (2026-11-12 18:16, dima) idea: rename flyway-sync to low-tide-flyway-sync.
PK-387:W25 (2026-11-12 18:16, dima) q2 chunk line: can we have one unified shape that satisfies all cases? i do not like a lot of stuff pointing at each other in both directions.
PK-387:W26 (2026-11-12 18:16, dima) q2 lane list: ok, clio-lanes-radar.ts stays shared.
<!-- SECTION:NOTES:END -->
