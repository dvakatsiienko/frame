---
id: PK-153
title: 'launchd jobs: is a specialised tool worth it to maintain and organise them'
status: done
assignee: []
created_date: '2026-10-16 10:24'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
labels:
  - xs
dependencies: []
priority: next
type: question
ordinal: 10101
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the pm2 trial (docs/test-drive/pm2.md, opened after the 10-16 checkpoint).
inbox 10-16, Q: our custom launchd jobs are plain and set up by hand. is there a good specialised tool, monitor or framework to maintain and organise them — ideally agent-friendly and free? worth a shot? home today: schedule/ (every job, AGENTS.md).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
answered 10-16 (researcher, cclio/.scratch/launchd-tools.md): no tool worth switching to — LaunchControl and Lingon are GUI-only, the cli wrappers are stale (lunchy 2021, lunchy-go 2015), mise's launchd generator forces dev.mise.* labels, process managers (pm2, process-compose) would run a second system and TCC-granted swift jobs must stay launchd. the fix is ours: a status verb over launchctl print (state, runs, last exit code — proven live), a log size cap in the daily cleanup, plists from a smaller file optional.

10-16 14:23: round 1's «TCC jobs must stay launchd» was unverified there; round 2 (exa + parallel + opus, cclio/.scratch/launchd-tools-r2/) backs it with this mac's tccd log (a child is checked under its parent) — still an inference for pm2 specifically. dima put free GUIs and pm2 in scope; his pick is the orbit ask.

10-16 14:31 probe, measured: under pm2 a never-granted probe read Input Monitoring «granted» (inherited from the chain that started pm2); under launchd «unknown» (its own identity). so pm2 judges children by its own chain — swift TCC jobs stay launchd, node/python servers can move. details: cclio/.scratch/launchd-tools-r2/opus.md § probe.

10-16 14:34: dima ticked the pm2 trial (o14) — this now waits on docs/test-drive/pm2.md (x-cc-otel under pm2); the o8 status verb + log cap are superseded if pm2 wins, revived if it loses.

2026-10-16 14:51 correction (wishkeeper, siesta 4): the 14:31 probe's launchd half DID run — «unknown», its own responsible process. only the pm2 half («granted») is inconclusive: that pm2 came from cclio's session. the at-login chain stays unproven; the reboot-shaped probe is on docs/test-drive/pm2.md's stress list. the GUI usage guide went out in the 14:48 reply.

2026-10-16 15:02: x-cc-otel runs on pm2 started by its own launchd job (pm2.dima.plist, fixed to stable paths, dima-owned); the reboot-shaped tcc probe read «unknown» = plain launchd, so the earlier «granted» was cclio's session. LaunchManager (brew, dima trusted the tap) and Launchyard (notarized, /Applications) are both installed for his A/B. rounds in docs/test-drive/pm2.md.

2026-10-16 15:23: dima picked Launchyard (docs/test-drive/launchyard.md, to 10-23); LaunchManager uninstalled with --zap on his word (sean10000/tap stays tapped + trusted, listed for the halt). pm2-logrotate installed (5M, keep 7, gzip) so the tap's per-export log line is capped. not proven yet: pm2 starting the tap at a real login — a login round is owed in pm2.md.
re-dated 2026-10-25 from 2026-10-23: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: done — answered 10-16; the trial lives in docs/test-drive/launchyard.md (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
