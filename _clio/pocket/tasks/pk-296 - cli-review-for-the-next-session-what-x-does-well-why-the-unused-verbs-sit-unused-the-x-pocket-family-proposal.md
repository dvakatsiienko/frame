---
id: PK-296
title: >-
  cli review for the next session: what x does well, why the unused verbs sit
  unused, the x pocket family proposal
status: open
assignee: []
created_date: '2026-11-01T16:36:00Z'
updated_date: '2026-11-02T16:13:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1033 (2026-11-01 18:34, dima): we reached 98%, so let's seal everything for today and then hold.
W1034 (2026-11-01 18:34, dima): before that, remember to print CLI usage stats into a handoff so we open the next session with this data.
W1035 (2026-11-01 18:34, dima): that's not today.
W1036 (2026-11-01 18:34, dima): your proposals go to the next session, to about x pocket.
W1037 (2026-11-01 18:34, dima): let's review what currently works well via CLI.
W1038 (2026-11-01 18:34, dima): what is that? ❓
W1039 (2026-11-01 18:34, dima): what do you propose about x pocket and other stuff? ❓
W1040 (2026-11-01 18:34, dima): let's review full coverage.
W1041 (2026-11-01 18:34, dima): for stuff that isn't used, first identify why.
W1042 (2026-11-01 18:34, dima): possibly it's because of missing habits, so you just don't remember that we created verbs.
W1043 (2026-11-01 18:34, dima): as for the proposal, it's for shaping after today.
W1044 (2026-11-01 18:34, dima): hold it for the next session.
W1045 (2026-11-01 18:34, dima): i assume that all tails are already done because i've asked it a lot of times, so ensure that everything is closed and do a halt wire+.

data: _clio/.scratch/cli-census-2026-11-01.txt (x stats, 14 days, 9,023 calls); clio's draft read: linear and lane carry the load (read 2,747, body 1,200, commit 797, push 373); 9 verbs at 0 calls, most habit gaps; the top uncovered raw heads python3 1,176, git diff 387, backlog 324 → an x pocket family over the backlog calls; shape it after today
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
maintenance ideas, 17:45 (done today: the review wave, the drift census; left for this item: the memory review via x:author-memory, the refresh-cc-mods recipe):
W1014 (2026-11-01 17:45, dima): then do some maintenance.
W1015 (2026-11-01 17:45, dima): maybe you can go review your memories.
W1016 (2026-11-01 17:45, dima): for example, are your memories in good shape? ❓
W1017 (2026-11-01 17:45, dima): use the x:author-memory skill to maintain your memories.
W1018 (2026-11-01 17:45, dima): or spawn another wave of wisphunters and Wishkeepers against everything we did today and against maybe a Fleet Flow blueprint.
W1019 (2026-11-01 17:45, dima): we have, e.g., PM/tickets to find inconsistencies and issues.
W1020 (2026-11-01 17:45, dima): another idea is to run that CLI script that checks if cli moves in the right direction.
W1021 (2026-11-01 17:45, dima): or run the refresh-cc-mods recipe.
W1022 (2026-11-01 17:45, dima): we didn't run it for a while.

W1266 (2026-11-02 17:01, dima): so you already have some helper scripts for backlog? ❓
W1267 (2026-11-02 17:01, dima): a question.
W1268 (2026-11-02 17:01, dima): will the CLI verb for pocket truly help you? ❓
W1269 (2026-11-02 17:01, dima): i'm mostly concerned about creating wrappers over wrappers.
W1270 (2026-11-02 17:01, dima): we have all this CLI stuff with the wrappers, and i was thinking about whether it is truly useful and not dead weight, especially for backlog.
W1271 (2026-11-02 17:01, dima): i saw it's your mainstream tool and you use it a lot, but what is actually easier: for you to write backlog CLI arcs by hand, or truly automated via CLI? ❓
W1272 (2026-11-02 17:01, dima): each abstraction is not free, and we need to build it and maintain it.
W1273 (2026-11-02 17:01, dima): is it worth it? ❓
W1274 (2026-11-02 17:01, dima): if it is truly useful, i agree, but tell me if it is actually truly useful.
W1275 (2026-11-02 17:01, dima): if it is, then shape it, but if it is not, then let's rethink and maybe discard this idea.
<!-- SECTION:NOTES:END -->
