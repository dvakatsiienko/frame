---
id: PK-466
title: 'fleet stories: a structure and a framework for growing them'
status: done
assignee: []
created_date: '2026-11-23T16:53:00Z'
updated_date: '2026-11-24T11:48:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-11-23 18:53: create a pocket item for wing 1: reorg fleet stories, create a good structure and a framework for growing fleet stories. this area ideally should not grow, but it does grow, so it should have a proper structure. his 18:43: remind how many story types we have, i feel we need a proper structure for them now. his renames, as typed: cpu-overload → cpu-roast-go-tests; mods-tests-cpu → cpu-roast-go-tests (❓ both to one name: one merged story, or the second meant cpu-roast-mods-tests). today: 8 stories, one type (fed-by: incidents), told apart by tags only; comms-log is a running log in a story's shape; the index calls cpu-overload sealed, its file says open. clio brings three shapes to pick from; nothing renamed before his pick.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
19:01 his tick (o2, 19:00): cpu-overload → cpu-roast-go-tests, mods-tests-cpu → cpu-roast-mods-tests, done in wing 1's reorg

PK-466:W1 (2026-11-24 13:14, dima): Let's go Fleet Stories and quickly note what I want out of it.

PK-466:W2 (2026-11-24 13:14, dima): We recently started to fold incidents that happen in our flows: the bad ones, the CPU roasting when Codie gets hung for 40 min, for example, and wastes time by staying parked for no reason or something like this.

PK-466:W3 (2026-11-24 13:14, dima): We also have a comms log with communications issues.

PK-466:W4 (2026-11-24 13:14, dima): Currently everything is scattered around and I want to collocate everything similar into one area so all our incidents are folded into a well-organized place that can scale.

PK-466:W5 (2026-11-24 13:14, dima): It is easy to query, read, analyze, and act on because, essentially, I save those incidents for us to process, solve them.

PK-466:W6 (2026-11-24 13:14, dima): If we don't save those stories, they just happen, continue happening, and are not getting solved.

PK-466:W7 (2026-11-24 13:14, dima): I want a good structure for Fleet Stories.

PK-466:W8 (2026-11-24 13:14, dima): I also spotted that file names and story names are messy.

PK-466:W9 (2026-11-24 13:14, dima): I want good clear file names and story names.

PK-466:W10 (2026-11-24 13:14, dima): You should have a proposal pending to rename a few of the CPU roasting stories.

PK-466:W11 (2026-11-24 13:14, dima): What I want from you now: list me all areas that are currently getting their stories, like CPU roasting, comms log, and other stuff, what we already load, what we already folded there? ❓

PK-466:W12 (2026-11-24 13:14, dima): Tell where all of that stuff is parked on the FS.

PK-466:W13 (2026-11-24 13:14, dima): I will pick with Cursor and propose a good structure for how to make them well organized.

PK-466:W14 (2026-11-24 13:14, dima): Note: no big builds now.

PK-466:W15 (2026-11-24 13:14, dima): I just want good organization and easy querying with DuckDB maybe or just by reads, and for this shape to be scalable.

PK-466:W16 (2026-11-24 13:14, dima): so it can grow.

PK-466:W17 (2026-11-24 13:14, dima): Optionally add agents.md with the naming convention asks.

PK-466:W18 (2026-11-24 13:14, dima): I will read a file after you print me the path and tell you what renames I want.

PK-466:W19 (2026-11-24 13:14, dima): Based on their names you should update agents.md with the naming convention I want for these files.

PK-466:W20 (2026-11-24 13:24, dima): [cpu-overload] can you organize it? ❓

PK-466:W21 (2026-11-24 13:24, dima): [cpu-overload] i think three full researches can be distilled into the verdict we picked? ❓

PK-466:W22 (2026-11-24 13:24, dima): [cpu-overload] it is currently being fixed on mods lane or already applied (consult with main).

PK-466:W23 (2026-11-24 13:24, dima): [cpu-overload] name «cpu-overload» → «cpu-overload-ftonze-the-fleet»

PK-466:W24 (2026-11-24 13:24, dima): [guard-lockout] «guard-lockout» → «guard-locksout-fleet»

PK-466:W25 (2026-11-24 13:24, dima): [herdr-band-drift] remind what was the story? ❓

PK-466:W26 (2026-11-24 13:24, dima): [lane-member-idle] «lane-member-idle» → «lane-member-idles-wastes-time»

PK-466:W27 (2026-11-24 13:24, dima): [mods-tests-cpu] i already proposed rename? ❓

PK-466:W28 (2026-11-24 13:24, dima): [x-live-on-commit] remind what is it? ❓

PK-466:W29 (2026-11-24 13:24, dima): [zoo-base] «herdr-zoo-layout-poor-pick» or something like this.

PK-466:W30 (2026-11-24 13:25, dima): I think the structure is not so bad.

PK-466:W31 (2026-11-24 13:25, dima): I just want clearer names for files because I can forget what they do and that's why I want clearer file names on the top level.

PK-466:W32 (2026-11-24 13:25, dima): When I open the FS in Cursor, for the files I see, I know what they are about.

PK-466:W33 (2026-11-24 13:25, dima): As for comms log, if you can propose a better clearer way to store them currently, then propose.

PK-466:W34 (2026-11-24 13:25, dima): From what I remember previously we agreed to keep it like this because I asked to make comms log entries queryable with DuckDB so they probably duped slightly because of that.

PK-466:W35 (2026-11-24 13:25, dima): Overall the structure is not so bad in my view because everything is collocated in Fleet Stories so maybe it is not so bad.

PK-466:W36 (2026-11-24 13:25, dima): Either way propose your own ideas for how to improve the structure.

PK-466:W37 (2026-11-24 13:25, dima): If you agree with my naming fixes, tell me how to name other stuff that I forgot what it does.

PK-466:W38 (2026-11-24 13:31, dima): [herdr-band-drift] drop? ❓

PK-466:W39 (2026-11-24 13:31, dima): [herdr-band-drift] can you remember if i asked for it or you created? ❓

PK-466:W40 (2026-11-24 13:31, dima): [x-live-on-commit] i also cannot recall i asked for this.

PK-466:W41 (2026-11-24 13:31, dima): drop both? ❓

PK-466:W42 (2026-11-24 13:31, dima): I want these incidents to be only created on my requests because I want these fleet stories to be hand-picked by me (because I evaluate differently than you).

PK-466:W43 (2026-11-24 13:31, dima): (your name proposals are OK but i want only to keep ones created by my request)

close: 13:44 done on dima's word («close the fleet stories revamp item»): five dirs renamed, the two cpu stories as one family, the cpu go story sorted with fixes-applied-and-open.md, two unasked stories trashed, stories only on his request (habit-cto, halt, fleet-stories/AGENTS.md); the duckdb query line (W14) not built, his «maybe»

close: W1 done, W2 done, W3 done, W4 done, W5 done, W6 done, W7 done, W8 done, W9 done, W10 done, W11 done, W12 done, W13 done, W14 done, W15 done (the reads half; its duckdb half dropped as not built, dima 13:44, his tick on the close ask), W16 done, W17 done, W18 done, W19 done, W20 done, W21 done, W22 done, W23 done, W24 done, W25 done, W26 done, W27 done, W28 done, W29 done, W30 done, W31 done, W32 done, W33 done, W34 done, W35 done, W36 done, W37 done, W38 done, W39 done, W40 done, W41 done, W42 done, W43 done

13:46 the close line above corrected in place: W14 now cites his 13:44 tick in its own clause

13:50 wishkeeper's catch: the close line named W14 as the duckdb line; W14 is «no big builds now» (kept), the duckdb want is W15, corrected in place
<!-- SECTION:NOTES:END -->
