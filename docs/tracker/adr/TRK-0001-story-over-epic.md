# TRK-0001 — «story» over «epic», projects split by domain

status: accepted (dima, 2026-08-17)
context: DOT-72 restructure. the «claude» project had become a 60+ ticket dump; grouping vocabulary was split between «epic» (DOT-3, DOT-4, DOT-28 titles) and ad-hoc story parents (DOT-104); three tickets collided on the word «harness» (DOT-116's motivating case).

decision:

- one grouping term: **story** = a ticket with sub-tickets. «epic» is retired — not in titles, not in speech. no title marker; structure, not naming, signals a story.
- «claude» dissolved into four domain projects: **pm** (tracker + pm skill), **mind** (memory/skills/rules/writing), **fleet** (surfaces + bridges: dispatch, cloud code, ipad), **cli** (the interface layer over the rest — unifies execution, not what's underneath).
- «handoff» project dissolved into mind (a skill, not an area); its bridge ticket (DOT-28) went to fleet.
- projectless stays legal for one-offs and idea pools.

consequences: sub-issue hierarchy carries batches (a story parent doubles as the batch id — DOT-104 precedent); the persistent/standing-ticket state question stays open (DOT-72 comments); tracker vocabulary is normative here, `clio:pm` holds recipes only.
