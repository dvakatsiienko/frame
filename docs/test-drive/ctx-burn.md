---
dies-when: the pattern is understood and its answer lives in x:crew-coder or craft-spawning; until then one dated entry per case
---

# ctx-burn — coder context growth and window burn, one case per entry

dima's call (2026-09-12): no context ceilings, no turn caps, auto-compact stays at the max
(~970k) so a coder never compacts mid-task. trace the cases here instead; when the pattern
repeats, dig in. numbers come from the session jsonl (`.message.usage` per assistant turn),
never from recall. the summing script: `jq` over `~/.claude/projects/<dir>/<session>.jsonl`,
bucketed by 15 min.

## 2026-09-12 15:40–16:55Z · BYT-84 coder · ~85 % of a 5-hour window in 75 min

- **who**: `e850b92c`, opus-5 high, bytes worktree, one pr (#84 deploy hooks)
- **numbers**: 638 turns in 75 min (8.5/min) · context 250k → 459k · cache reads 180.6M ·
  cache writes 1.2M · output 567k opus tokens. this session (cclio) in the same window: 161
  turns, 48.9M reads, 86k out. eight forks: ~27M reads total. four eval runs: ~$30 api-equiv,
  a minor line
- **buckets**: 15:45 172 turns/26.9M · 16:00 236/62.7M · 16:15 153/57.3M · 16:30 77/33.7M
- **what filled the turns** (its own retro + the pings): ~20 min blaming github for its own
  commit body, six diagnostic scripts; four attempts at the turbo `globalDependencies`
  measurement; two reviewer rounds (ci reviewer + greptile app) answered thread by thread;
  long pr body and long replies; the retro. dima's peek mid-run: «it told me github
  ping-ponging»
- **why it costs what it costs**: every turn re-reads the whole context; at 400k that is the
  bill even at cache-read rates. adversarial ci review doubles the read-respond loop (two
  reviewers, both opus-verbose; greptile short); the coder's own novel-length bodies feed the
  reviewers' novel-length answers
- **not the cause**: the eval runs (dima's first guess) — separate sandboxes, ~$30
- **candidates, not applied**: pr body + reviewer replies capped in `x:crew-coder`; the ci
  reviewer's prompt in `claude.yml` asked for terse findings; diagnostics run in a subagent so
  the spiral dies with it; review payloads read filtered (`jq` fields), never raw; one ci
  adversary at a time (the greptile-ci decision, 09-16)

## 2026-09-25 · BYT-103 atelier coder (opus 5.5, medium → high mid-run)

- **size**: 352 api calls, ~323k output, 168M cache reads, context ended at ~755k — about 75 min of wall clock for a new app + 9 kit components + 15 commits
- **the loop around it**: a verifier (113 calls, ~78k out, 19M reads, ~16 min of its own work over 3 rounds) + the ci reviewer (2 rounds) + local matt code-review + coderabbit, each read in a subagent
- **github replies**: 3 thread answers, sent late (the brief had a hole in verifier mode, fixed in x 0.11.108). dima: keep the replies, and watch whether they move the burn — this job's replies were 3 short ones, not a measurable share
- **watch next**: whether the reply rule grows the context on a pr with many threads; a coder at 700k+ is past half the window — the next assignment in the same session starts heavy
