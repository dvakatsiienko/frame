---
id: PK-299
title: >-
  worth test: only useful work gets planned (cli, mods, wishes), then the
  dead-weight audit
status: open
assignee: []
created_date: '2026-11-02T15:29:00Z'
updated_date: '2026-11-02T16:13:00Z'
labels:
  - m
dependencies: []
priority: now
type: task
ordinal: 9998
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
main lane, 17:25 ask. W1239–W1253 in ~/.local/state/clio/grooms/2026-11-02-1725.groomed.md.
flow: grill (.scratch/worth-test/) → crow + wishkeeper review → resolve → audit of mods + cli for dead weight (W1251–W1253).
x pocket verb skipped on his yes (W1242).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1239 (2026-11-02 17:25, dima): what you wanted about xpocket was just that: it was not backed up by real need, right? ❓
W1240 (2026-11-02 17:25, dima): You freely can use pocket with your scripts, and there is no need to have a CLI version of it, right? ❓
W1241 (2026-11-02 17:25, dima): You can still measure it without the xstat CLI, right? ❓
W1242 (2026-11-02 17:25, dima): If so, then yes, skip pocket CLI.
W1243 (2026-11-02 17:25, dima): As for your protection against scope creep, let's actually grill on it to properly think about it from the different angles and then propose how to solve
W1244 (2026-11-02 17:25, dima): /mattpocock-skills:grill-me lets figure out how to avoid planning redundant work.
W1245 (2026-11-02 17:25, dima): only useful stuff for cli, mods and any other planned stuff should be actually planned.
W1246 (2026-11-02 17:25, dima): including my wants too.
W1247 (2026-11-02 17:25, dima): my wants should be treated critically — I think about my wants myself, but I also often ask you to do some stuff that I don't need in the outcome myself.
W1248 (2026-11-02 17:25, dima): Help me identify if I propose redundant stuff too.
W1249 (2026-11-02 17:25, dima): After we grill, consult with crow and do a wishkeeper to help us understand if we solved this problem properly.
W1250 (2026-11-02 17:25, dima): It is important because, based on how we solve it right now, we will have a totally different picture of what we planned and what we do.
W1251 (2026-11-02 17:25, dima): And after the Crow and Wishkeeper reviews are done and resolved, let's also see what we have currently in mods in CLI.
W1252 (2026-11-02 17:25, dima): Let's see what we already built.
W1253 (2026-11-02 17:25, dima): Did we actually build something that is not useful and a dead weight, or just useless? ❓

W1276 (2026-11-02 17:11, dima): fyi: cw thread may do some edits, i asked to review firelink from its side.
W1277 (2026-11-02 17:11, dima): x pocket.
W1278 (2026-11-02 17:11, dima): you confused me now.
W1279 (2026-11-02 17:11, dima): you just said that you want a verb because it's useful, and now you are saying that it is false.
W1280 (2026-11-02 17:11, dima): for the future, how are we to properly know if a thing is worth building? ❓
W1281 (2026-11-02 17:11, dima): especially what is related to CLI, because, as you remember, we have a CLI to streamline fleet work.
W1282 (2026-11-02 17:11, dima): it should have useful verbs that help fleet by automating frequently used operations, but not only that.
W1283 (2026-11-02 17:11, dima): as i just said, we shouldn't just blindly cover everything with another layer of abstraction, because it will just create unnecessary work and will create an additional maintenance burden.
W1284 (2026-11-02 17:11, dima): we actually have to create it first.
W1285 (2026-11-02 17:11, dima): this is actually a dangerous spot in the flow, a place where we can create unnecessary work upfront.
W1286 (2026-11-02 17:11, dima): heads up, we already coded quite a lot on both surfaces: mods and CLI.
W1287 (2026-11-02 17:11, dima): previously, i was accepting all your proposals, and now i see that you actually don't know yourself if you truly want these verbs for CLI or even mods or not.
W1288 (2026-11-02 17:11, dima): how to properly then identify if a thing is worth building? ❓
W1289 (2026-11-02 17:11, dima): let's find a proper way and settle it somewhere in a very visible and important place, maybe even in the shape idea skill.
W1290 (2026-11-02 17:11, dima): what's especially related to CLI and mods is scope creep.
W1291 (2026-11-02 17:11, dima): building a thing just for the sake of building is not allowed.
W1292 (2026-11-02 17:11, dima): we should only have useful stuff in mods and CLI.
W1293 (2026-11-02 17:11, dima): that's why i'm thinking of improving the shape idea skill, although this may not be the best place because this info will be only in shape idea but not in your memory.
W1294 (2026-11-02 17:11, dima): you still can create tickets avoiding shape idea, and some redundant stuff may creep in.
W1295 (2026-11-02 17:11, dima): propose how to solve it gracefully.
W1296 (2026-11-02 17:11, dima): as your xpocket verb proposal, i'm confused about this too because, from what i read from your previous reply, you have your scripts as helpers, and they help you.
W1297 (2026-11-02 17:11, dima): from what i read, but for you to confirm, they are actually useful.
W1298 (2026-11-02 17:11, dima): your second reply confused me because now you say that you don't actually need them, and xcli will create just another layer of abstraction.
W1299 (2026-11-02 17:11, dima): why have another layer of abstraction if you could just move your scripts to CLI, so everything is collocated via CLI, and you would just repoint where you were using your scripts (helpers from your local scripts to CLI)? ❓
W1300 (2026-11-02 17:11, dima): are you sure those verbs for pocket in CLI are truly useless? ❓
W1301 (2026-11-02 17:11, dima): most importantly, about xstats, measuring stuff is actually important because it allows you to see a lot of data about your usage.
W1302 (2026-11-02 17:11, dima): why do you treat xstats coverage as the weakest reason? ❓
W1303 (2026-11-02 17:11, dima): in my mind, it is one of the most important reasons to have it in a CLI to see actual usage and track it.
W1304 (2026-11-02 17:11, dima): if we won't have it in the CLI, how then to measure your activity? ❓
W1305 (2026-11-02 17:11, dima): coder have another o3 questions.
W1306 (2026-11-02 17:11, dima): i do not know what better there.
W1307 (2026-11-02 17:11, dima): propose.
W1308 (2026-11-02 17:37, dima): it actually would be a good idea to review what we planned because we could plan the redundant stuff, but let's do it a little bit later.
W1309 (2026-11-02 17:37, dima): plan:
W1310 (2026-11-02 17:37, dima): first, let's solve a grill to have this change — full implementation + wishkeeper and crow.
W1311 (2026-11-02 17:37, dima): then my side ask about rockstar acc, i have updates.
W1312 (2026-11-02 17:37, dima): then proceed with what we planned and planned scope verification against needed or not.
W1313 (2026-11-02 17:41, dima): tell when you can solve my rockstar acc question.

W1342 (2026-11-02 18:13, dima, o50 steer): actually, pick a good spot for it in a mods lane.
W1343 (2026-11-02 18:13, dima, o50 steer): it is quite important.
W1344 (2026-11-02 18:13, dima, o50 steer): maybe let's have it right after 478? ❓
<!-- SECTION:NOTES:END -->
