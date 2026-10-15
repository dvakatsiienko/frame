---
id: PK-90
title: >-
  refresh-crew-coordinator run: re-verify spawning-mechanics, right after the
  memory sweep
status: open
assignee: []
created_date: '2026-10-12 11:23'
updated_date: '2026-10-15 12:40'
due_date: '2026-10-15'
labels:
  - m
dependencies: []
priority: now
type: task
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-12 (o3): postpone the spawning-mechanics refresh to right after the memory sweep (FRM-267) is fully resolved. moved here from _reminders.md, whole line kept:
⏰ 🦉📜 spawning-mechanics artifact freshness — `docs/knowledge/spawning-mechanics.md` verified against cc 2.1.283 (2026-09-27, run #3 of `refresh-crew-coordinator`: no row flipped; the compaction hooks proven end to end); re-run the procedure when the cc version changes, or when a spawn behaves against a [verified] row. the subagent stack row is [volatile] — the first thing run #3 probes — set 2026-08-30 · input for the refresh (dima, 2026-10-12): theo's «finally a good small model» on the shelf, `~/.claude/shelf/yt-transcripts/theo-t3gg-finally-a-good-small-model-38_6C0dkKmU/` · due: 2026-10-12
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: waits for the memory sweep (FRM-267) to close; dima, 2026-10-12

dima o94 ✓ 20:54: this run also measures the auto-compact threshold — exercise CLAUDE_AUTOCOMPACT_PCT_OVERRIDE / autoCompactWindow / --autocompact (spawning-mechanics.md:325-329), and where quality drops; the 600–700k manual checkpoint stays until then

19:08: spawning-mechanics now lives at home/.claude/plugin-x/skills/crew-lead/references/spawn-mechanics.md (o75), fleet-models at references/model-cards.md

unparked 2026-10-15 by dima's inbox steering: this run goes FIRST, inside the memory sweep. his want, folded: sharpen my spawning mechanics before composer — haiku 5.5 now holds real roles (composer, sifter), so refresh its knowledge thoroughly (best use cases, baseline effort, as subagent and sidecar), and fully sharpen how I and the fleet use subagents (when to spawn x10 or x100, how to cut chunks for them, which work fits them, how to shape an agent card and its frontmatter so it runs lean too). he brings two haiku 5.5 youtube videos and many screenshots. asks inside: which questions to hunt in the research · the subagent kinds I use (generic, arm A/B, ours, --bg) explained in one table with stats and capabilities · how to ingest many screenshots with true data and away from my context. then the findings update my habits and skills. today's ⏰ haiku 5.5 research (due 10-15) folds in here. the 10-14 lesson: 12 generic subagents, each carrying fleet memory, nearly filled a ~700k window.

2026-10-15, wishkeeper's catch on the parse: his order is shape, then run — reshape recipes/refresh-crew-coordinator via cclio:shape-recipe first (a grill focused on subagent optimization and the haiku 5.5 research; today it only re-verifies spawn mechanics against a cc version), then run it. his depth bar: «i want you to know this knowledge very well». and PK-141 (composer's sharpen) runs right after, in the same context with the research still loaded — he wants both «at once, with all data in context»; his /compact goes before PK-90, never between the two.

2026-10-15, dima's adds:
- research vector, screenshots: what is the best way to bulk-read images with agents, keeping image reads out of the main thread while the data from the shots stays precise? if haiku 5.5 is good at it, a habit: 5+ images always go through sifter (Haiku 5.5), with a spot-check of 2-3 shots in the main thread.
- the 12 generic subagents of 10-14 cost ~1.6M tokens of fleet memory (~137k each) — that must not happen again. his read: never use generic subagents for research, maybe not at all while our custom cards (researcher, sifter, helper) exist; the researcher card was the right door. the fix is a mechanism, not a firmer intention (habit-cto) — candidate: an x-mod-guard rule that refuses a parallel fan-out of generic Agent calls and names the card. review deeper here.
- claude-code#88822 (our issue: a subagent's final report comes back as a bare pointer, body lost) was auto-closed as stale 10-15 — check whether it still reproduces in this run; if yes, refile with a fresh repro.

2026-10-15, the first real screenshot case (dima, o4): sill (installed today, a mac window on the iphone/ipad) works very well; he drops ~8 settings screenshots with his questions once the screenshot-reading habit is set, and I suggest good settings for the app.

2026-10-15, dima: after the haiku 5.5 refresh, measure whether a keep-warm ping for composer pays: a cold restart's cache write vs a ping's reads over an idle hour (composer went cold after 1h32m today).
<!-- SECTION:NOTES:END -->
