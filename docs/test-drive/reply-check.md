---
status: adopted
until: 2026-10-20
---

# reply-check — test drive, 2026-10-02 → 2026-10-16

the log-only Stop hook `home/.claude/shelf/hooks/reply-check.py`: pure regex, no jev, never blocks.
the drive answers one question per rule — does it fire, how often, and is a hit a real break?

## stress list

- bare ticket id · table · middot chain · circled digits · commit hash in prose — each rule: count over
  two weeks, and 5 hits read by hand for false positives
- sessions it runs in: clio and codies (user scope) — which members break which rule
- latency: stays under 100 ms per stop

## the rule for the verdict (dima, 2026-10-02)

a rule that fires often gets its root fixed (a sharper positive rule, a template, a tool), never a
blocking gate; blocking is only for a rule that stays rare and costly. a rule with zero real hits in
two weeks is dropped from the hook. the jev `reply-shape` flow (a dropped ⏳ ask, verdict first) is
added only if the regex log shows the gap.

## log — date · window · `pnpm reply-check:report` per rule · false positives read · action

## verdict

_(2026-10-16)_
- 2026-10-19 · **adopted, warn-only** (dima o93): 2,317 hits all-time, a 1-in-60 sample all real. the three unread rules each showed hits (`~/.local/state/reply-check.tsv`): table 1, middot 156 (all 10-04 → 10-08, then none: the habit took), circled digits 5 (already gone from the hook source), so none is dropped. the kill rule stays: a rule with zero hits in two weeks leaves the hook.
- 2026-10-04 · live probe · the hook fires live (one bare-ticket line logged this session), but a deliberate «alpha · beta» in the final reply of a turn was never logged · guess, unproven: at Stop the final text block is not yet in the transcript, so the hook reads an earlier block of the turn · fix candidate: read the Stop input's last-message field if cc passes one, else re-read the transcript after a short settle
- 2026-10-04 evening · 8 live hits today, so the hook fires · false positives: commit-hash fires on job ids (d848735b) and on the barrel-probe hash d03f3da at session resumes (the resume turn, not a reply of mine) · fix candidate: skip hex in a `job`/`probe` context, skip resume turns
- 2026-10-11 16:52 · new log-only rule `dead-link` (o125): a markdown link with no scheme that does not resolve from the session's cwd (a :line suffix stripped); red-proven test then 16/16, the live hook replay of the 16:47 groom-list link logs it, the absolute twin passes · promote to blocking if it fires again (dima's warn-first pick)

## the reminder, moved here (2026-10-11, o139)

⏰ 🔬 reply-check test drive, two weeks to 2026-10-18 — the log-only Stop hook (pure regex, no jev); at each halt read `pnpm reply-check:report`, one log line in `docs/test-drive/reply-check.md`. on 10-18: per rule — fix the root, block, or drop (the rule is in the file). dima 2026-10-02: «let's vet it for 2 weeks» — set 2026-10-02
- 2026-10-16 14:47 · bare-ticket sample (siesta freebie, owed before the verdict) · 2,317 hits all-time: frame-cwd sessions 1,588, cclio 135, ccrow 78, verifier worktrees ~60, bytes 28 · cclio's last hit 2026-10-12 21:46 (FRM-224), none in 4 days · a 1-in-60 spread sample: every hit a real unlinked id, no misfire seen · verdict input: the check is right, the volume is member traffic (coders, ccrow) — scope it to dima-facing sessions, or teach the members the link rule
- 2026-10-15 20:27 · 7-day report (siesta freebie) · 2,028 findings: bare-ticket 1,507 in 674 replies, commit-hash 249, unglossed-id 215 (cclio drew 6 tonight, all PK ids), wait-without-dima 21, dead-link 11 · inference: the bare-ticket count may be a check misfiring rather than 1,500 real misses — the 10-18 round reads a sample before the verdict (`nurture-memory`'s standing call: a check firing often is a root to fix)
