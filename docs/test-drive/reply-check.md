# reply-check — test drive, 2026-10-02 → 2026-10-16

the log-only Stop hook `home/.claude/shelf/hooks/reply-check.py`: pure regex, no jev, never blocks.
the drive answers one question per rule — does it fire, how often, and is a hit a real break?

## stress list

- bare ticket id · table · middot chain · circled digits · commit hash in prose — each rule: count over
  two weeks, and 5 hits read by hand for false positives
- sessions it runs in: cclio and coders (user scope) — which members break which rule
- latency: stays under 100 ms per stop

## the rule for the verdict (dima, 2026-10-02)

a rule that fires often gets its root fixed (a sharper positive rule, a template, a tool), never a
blocking gate; blocking is only for a rule that stays rare and costly. a rule with zero real hits in
two weeks is dropped from the hook. the jev `reply-shape` flow (a dropped ⏳ ask, verdict first) is
added only if the regex log shows the gap.

## log — date · window · `pnpm reply-check:report` per rule · false positives read · action

## verdict

_(2026-10-16)_
- 2026-10-04 · live probe · the hook fires live (one bare-ticket line logged this session), but a deliberate «alpha · beta» in the final reply of a turn was never logged · guess, unproven: at Stop the final text block is not yet in the transcript, so the hook reads an earlier block of the turn · fix candidate: read the Stop input's last-message field if cc passes one, else re-read the transcript after a short settle
