---
id: PK-158
title: >-
  a cclio fork: explore in a fork without confusing monitors, ccrow, composer or
  lanes
status: done
assignee: []
created_date: '2026-10-16 10:24'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: next
type: question
ordinal: 10106
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the next mods coder lane (PK-120) — a rider there (dima o88 + 19:32: «attach it as a rider ticket for next mods coder lane»; lanes spawn only when the weekly window has room).
inbox 10-16, Q (relates to the monitors wisp, PK-152): he wants to fork cclio to explore a few things, then stop the fork, so her context stays clean. how well does the setup allow it — duplicated monitors, confusion with ccrow, composer and live lanes, will they mix up the real cclio and a fork? how to fork so the fork knows it is a fork and doesn't rush to do everything, and cclio isn't surprised — without him re-explaining «this is a cclio fork» to everyone each time.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 14:42: dima's steer (o18): «Let's shape the idea on the nearest siesta then.» → cclio:shape-idea at the next siesta.

2026-10-16 15:20 grill round 1 (dima's ticks): Q1 a fork starts as a copy of cclio's whole thread · Q3 its findings come back as a handoff file + a one-line ping · Q4 it is invisible to ccrow, the watches and lanes · Q5 cclio prints «🍴 fork <topic> started» on her next turn · Q2 its own worktree, on his condition that archived work is never lost — his flow: «I would create a fork, ask you about some stuff, and maybe test some stuff … then archive it, and I could forget about the work tree … tell you in the main thread to peek into the work tree and merge out of that». fact: the app keeps a worktree with uncommitted changes on disk at archive, and a committed branch outlives its tree. round 2 asked: Q6 commit every step · Q7 the boot lists unmerged fork branches · Q8 «fork: <topic>» starts it · Q9 changes outside git listed in its handoff.

2026-10-16 15:23 the want, approved by dima (o25): «sometimes I want to fork you to explore a few things in the fork, then stop it, so your context doesn't fill with what a fork can solve. the fork must not get mixed up with the real you: no duplicated monitors, no confusion with ccrow, composer or live lanes. the fork knows it is a fork and doesn't rush to do everything. you aren't surprised by it, and I never re-explain «this is a cclio fork» to anyone.» · round 2 (dima's ticks): Q2 its own worktree · Q6 it commits every step on its branch, never pushed · Q7 unmerged fork branches are the halt's first gate, and the boot lists them too («better at the halt as a first gate, but boot check wouldn't hurt»). open: Q8 how it starts, Q9 changes outside git.

2026-10-16 15:36 grill done (Q8: /cclio:fork <topic>). step 3 prior art, three lanes in .scratch/fork-prior-art/ (exa, parallel, opus): cc already has /fork <prompt> (2.1.212+, a separate background session, the parent keeps working) and /branch (switches this process into the copy); SessionStart says source:"fork" (2.1.214+) but no parent id (claude-code#73053, open); a ← move to background also reports "fork"; ~/.claude/jobs/*/state.json carries forkParentSessionId for /fork (undocumented). lanes split on the worktree: opus says /fork gets its own worktree, exa says desktop «Fork from here» reuses the same folder (claude-code#49954). proposed call: reuse /fork, add only a fork registry + hook stand-down.

2026-10-16 15:44: no cclio skill (dima: «/cclio:fork … if it only leaves a note, rename … pick a better pattern»): he types cc's own /fork. the hook is fork-guard.sh (o46). his correction: «Yesterday, I tested /btw, and it actually produced a live-bg fork thread for you» — so the guard keys on the main session id, never on /fork's job field, and catches every copy. plan + done test: .scratch/fork-prior-art/plan.md; plan critic running. he tests it once cclio says the fork topic is fully solved.

2026-10-16 15:58: the plan critic said «revise» (5 findings, 3 high) — all folded into .scratch/fork-prior-art/plan.md, but folded without a check at the source, so each gets checked again at build time; ccrow's /clear catch (a /clear keeps the pid) folded as a pid match — still a premise until the /clear probe runs; the start line now prints the topic («🍴 fork <topic> started», dima's Q5); a /btw done line added (9 lines now). dima: «shaped» (o48). next: the build, then the probes, then his /btw test.

dima 10-16 18:47: «fork-guard: next boot, not today»

**waiting for:** the next boot (dima, 10-16 18:47: «fork-guard: next boot, not today»)

2026-10-18 boot: dima steers today to parse + answers + the viz-tool shape; the pocket gets solved after the weekly reset (10-19 07:00); fork-guard rides the first post-reset day

2026-10-19 19:18: build started (o85). the plan's open probes first: a passive hook, .claude/hooks/session-probe.sh, logs SessionStart + Stop (event, source, session id, cwd, the pid chain with each registry sessionId) to ~/.local/state/cclio/session-probe.log; one /fork by dima answers all four, and a /clear answers PK-152 too

2026-10-19 19:33 probe answered (session-probe.log, dima's desktop /fork at 19:26): (1) the fork fires SessionStart with source «resume», never «fork», and a new session id (7a7e6f11); (2) it runs in cclio's own folder (cwd ~/frame/cclio), so the plan's camp-into-a-worktree step is needed; (3) $PPID is the fork's own cc process (pid 34400, registry name «🦉 cclio (fork)»), separate from cclio's (19578), so the pid match in plan step 1 holds; (4) ccrow wrote no note from the fork's turn (last note 19:16). also seen: a «cclio-fb» claude started from bash+timeout in the cclio cwd at 19:26:45, origin not yet traced. the build rides the next mods lane; exit lines = plan.md's done test.

2026-10-19 19:47 dima: «composer should also not interact with a fork (only with you, main)» — the want grows: composer, like ccrow, hears from and answers only the main cclio; a fork's SendMessage to composer is refused or ignored, and composer's receipts go to the main session only. a done-test line: given a fork sends composer a chore, then composer does not run it and the fork learns why.

2026-10-19 19:50: the «cclio-fb» session traced — it is boot-prefetch.sh's barrel probe (a haiku claude -p, ~75k ctx, the d03f3da question), run because the fork's SessionStart (source resume) fires the full boot-prefetch hook. done-test line: given a fork starts, then boot-prefetch skips (no barrel probe, no watch arming, no ccrow start).

2026-10-21 13:56: due moved 10-20 → 10-24, the mods lane's date (PK-120), which it rides.

ticket: FRM-430
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved — FRM-430 carries this item (its body lists «pocket PK-158») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
