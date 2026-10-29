---
id: PK-90
title: >-
  refresh-crew-coordinator run: re-verify spawning-mechanics, right after the
  memory sweep
status: done
assignee: []
created_date: '2026-10-12 11:23'
updated_date: '2026-10-21T15:49:00Z'
due_date: '2026-10-22'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 10700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the next 5+ screenshot batch, read through helper-lite — the path still has no first real run
dima, 2026-10-12 (o3): postpone the spawning-mechanics refresh to right after the memory sweep (FRM-267) is fully resolved. moved here from _reminders.md, whole line kept:
⏰ 🦉📜 spawning-mechanics artifact freshness — `docs/knowledge/spawning-mechanics.md` verified against cc 2.1.283 (2026-09-27, run #3 of `refresh-crew-coordinator`: no row flipped; the compaction hooks proven end to end); re-run the procedure when the cc version changes, or when a spawn behaves against a [verified] row. the subagent stack row is [volatile] — the first thing run #3 probes — set 2026-08-30 · input for the refresh (dima, 2026-10-12): theo's «finally a good small model» on the shelf, `~/.claude/shelf/yt-transcripts/theo-t3gg-finally-a-good-small-model-38_6C0dkKmU/` · due: 2026-10-12
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: waits for the memory sweep (FRM-267) to close; dima, 2026-10-12

dima o94 ✓ 20:54: this run also measures the auto-compact threshold — exercise CLAUDE_AUTOCOMPACT_PCT_OVERRIDE / autoCompactWindow / --autocompact (spawning-mechanics.md:325-329), and where quality drops; the 600–700k manual checkpoint stays until then

19:08: spawning-mechanics now lives at home/.claude/plugin-x/skills/crew-lead/references/spawn-mechanics.md (o75), fleet-models at references/model-cards.md

unparked 2026-10-15 by dima's inbox steering: this run goes FIRST, inside the memory sweep. his want, folded: sharpen my spawning mechanics before composer — haiku 5.5 now holds real roles (composer, helper-lite), so refresh its knowledge thoroughly (best use cases, baseline effort, as subagent and sidecar), and fully sharpen how I and the fleet use subagents (when to spawn x10 or x100, how to cut chunks for them, which work fits them, how to shape an agent card and its frontmatter so it runs lean too). he brings two haiku 5.5 youtube videos and many screenshots. asks inside: which questions to hunt in the research · the subagent kinds I use (generic, arm A/B, ours, --bg) explained in one table with stats and capabilities · how to ingest many screenshots with true data and away from my context. then the findings update my habits and skills. today's ⏰ haiku 5.5 research (due 10-15) folds in here. the 10-14 lesson: 12 generic subagents, each carrying fleet memory, nearly filled a ~700k window.

2026-10-15, wishkeeper's catch on the parse: his order is shape, then run — reshape recipes/refresh-crew-coordinator via cclio:shape-recipe first (a grill focused on subagent optimization and the haiku 5.5 research; today it only re-verifies spawn mechanics against a cc version), then run it. his depth bar: «i want you to know this knowledge very well». and PK-141 (composer's sharpen) runs right after, in the same context with the research still loaded — he wants both «at once, with all data in context»; his /compact goes before PK-90, never between the two.

2026-10-15, dima's adds:
- research vector, screenshots: what is the best way to bulk-read images with agents, keeping image reads out of the main thread while the data from the shots stays precise? if haiku 5.5 is good at it, a habit: 5+ images always go through helper-lite (Haiku 5.5), with a spot-check of 2-3 shots in the main thread.
- the 12 generic subagents of 10-14 cost ~1.6M tokens of fleet memory (~137k each) — that must not happen again. his read: never use generic subagents for research, maybe not at all while our custom cards (researcher, helper-lite, helper) exist; the researcher card was the right door. the fix is a mechanism, not a firmer intention (habit-cto) — candidate: an x-mod-guard rule that refuses a parallel fan-out of generic Agent calls and names the card. review deeper here.
- claude-code#88822 (our issue: a subagent's final report comes back as a bare pointer, body lost) was auto-closed as stale 10-15 — check whether it still reproduces in this run; if yes, refile with a fresh repro.

2026-10-15, the first real screenshot case (dima, o4): sill (installed today, a mac window on the iphone/ipad) works very well; he drops ~8 settings screenshots with his questions once the screenshot-reading habit is set, and I suggest good settings for the app.

2026-10-15, dima: after the haiku 5.5 refresh, measure whether a keep-warm ping for composer pays: a cold restart's cache write vs a ping's reads over an idle hour (composer went cold after 1h32m today).

2026-10-15 18:40: run #5 shipped (recipe log line, spawn-mechanics on 2.1.299, model-cards reshaped, 6 cards sharpened, generic agents denied fleet-wide, helper-lite renamed and editing). left: dima's sill settings screenshots — the first real case for the 5+ screenshot rule, read through helper-lite when he drops them.

2026-10-15 20:17: run #5's last leftover came — dima's Sill screenshots — but cclio read all 6 by hand against the 5+ rule (#dima-caught); the rule was rewritten (fleet-tooling.md) and a helper-lite nudge pocketed (PK-148); the helper-lite path still waits for its first real batch (wishkeeper, 20:2x)

2026-10-18: priority now → next — it is waiting, and the now cap holds today's three items (viz tool, shape-idea top-7, firecrawl).

2026-10-21 inbox, dima, folded — a research vector for this run, not fixed in the recipe: the «breaker» agent role. is it our verifier, or a different angle? its own role beside crew-verifier, or an alias for what the verifier does? does our verifier actually try to break an app on purpose? worth extending its instructions to also try breaking the app while verifying? the research lanes search this too; if it holds, also the degree: how much effort a verifier spends on breaking, and where it stops so it doesn't overextend. if we adopt a verifier/breaker shared role, the recipe carries it, and each rerun sharpens the verifier as a verifier/breaker.

2026-10-21 15:32 the breaker idea's source, read: Rauch's tip 5 (the PK-232 video) — a breaker agent stress-tests on purpose (concurrent conflicting actions, slowness, comparison with rivals), works on copies of real data, and loops with the fixer. tip 6 adds a «first-time user» agent: it may only RUN the app in a browser, a hook blocks every other Bash use, so it can't read the code — a vector for the verifier and x:browser-headless. tip 2: a «direction» command checks built work against the plan folder for drift.

2026-10-21 18:28, dima on the board's questions, folded:
W1 the breaker is an exploration area: does the approach work at all, does anyone else use breaker-like patterns, and is it a good idea to extend the verifier with breaker habits
W2 a verifier is essentially a breaker, but ours does not try to break an app today; it only checks it works as intended. acting as a breaker would likely just make it a better verifier
W3 ❓ open: do we extend it or not? we want the verifier to catch and ensure the coder built the right thing, without overloading it with needless actions; an extension must be worth it and prove useful, which is why we search
W4 fresh-eyes keeps its own trial life and its measures in its test drive; this research may still borrow something new for it
raw: «Treat Breaker as an exploration area. The idea is to explore if this approach works at all, if anyone else uses patterns like Breaker, and if it is a good idea to extend the verifier role with Breaker habits. This is because a verifier is essentially a breaker, but currently it doesn't try to break an app. It just tries to ensure it works as intended. For a verifier, acting as a breaker would probably just make him a better verifier. It is still an open question: should we do that or not? What we want out of the verifier is to catch and ensure that the coder implemented the right thing, but we also don't want to overload the verifier with unnecessary actions. If we ever extend the verifier's set of actions with the Breaker idea, then it should be worth it and prove to be useful. That's why we search and explore.» · q3: «yes, Fresh Eyes has its own test trial life and measures in test drive, but in research, we could probably borrow something new.»

2026-10-21 18:35 groomed (round 1: want kept, breaker stays a run vector not a want; both halves; x:crew-verifier listed; pm research kept). dima's «go» = run it. Q5 on trial this run: deep-or-skip, at most 3 files changed deep, the findings on a page and a ≤5-line reply; dima: «let's try this approach, and if it is good, settle it as a correction to the recipe body for the next run»

2026-10-21 18:50 run #6 done: https://claude.ai/artifact/UQDHgn3qcntgD2UCShxpfv — spawn-mechanics + crew-subagent landed; the break-pass trial, the fresh-eyes patience budget and the scout identity line wait in orbit; the deep-or-skip trial is judged by dima on this run
<!-- SECTION:NOTES:END -->
