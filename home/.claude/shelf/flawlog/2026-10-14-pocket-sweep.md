# flawlog · 2026-10-14 · pocket sweep

run: cc·20261010·pocket-sweep

- 14:46 · both watches down at boot, armed one-shot — by design: a project-scope plugin starts no monitors, the boot arming them IS the mechanism (PK-109, done 10-13). not a flaw; my first line here was false (ccrow caught it)
- 14:47 · the evergreen fork was refused by x-mod-guard (a fork carries ~220k parent ctx); a helper with a self-contained brief ran it in 28 s. the boot skill's «fire the evergreen digest as a fork» line is stale against the guard
- 14:48 · pocket creates went red three ways (ordinal band, type, due) — `backlog task create` takes none of them by default; a create wrapper with the gate's fields would kill it — automation candidate, unfiled (the evergreen boot line took today's slot: PK-130)
- 14:48 · ccrow: a 10-13 20:28 wake packet reached the fresh ccrow 18 h later (stop used a stale id) → PK-129
- 15:08 · #dima-caught evergreen ran without the skill: I never loaded `cclio:evergreen`, briefed a helper from the boot line with «apps-lane section, under 1,500 chars» — that cut the brew lane, the full-range read (§2) and the artifact; dima got a skim. the fork refusal was the door I tripped through. fix → PK-130 widened
- 16:28 · #dima-caught the second wind nearly ran with wishkeeper batch C still in the background: cclio:checkpoint has no «my own background work» step. fix → orbit (skill step 0 rule + a required `pending:` field on the second-wind op)

- 16:49 #dima-caught shape-idea loaded but not followed: step 1 want never put to him, grilling + domain-modeling never loaded, 5 questions batched. fix: back on the steps, want ask in orbit, grilling loaded next round
- 16:48 #dima-caught grill drift: the reply had 5 numbered questions, orbit had Q1–Q6 — the chore list was orbit Q3 but reply prose. cause: orbit asks written first, reply restructured after. fix: one grill list, orbit copies its numbers (o41)

- 17:07 #ccrow neuroarxiv reads ran as 14 general-purpose agents, ~115k each (~1.6M) to read one abstract apiece. fix: shape-idea step 4 names sifter/researcher for the reads
