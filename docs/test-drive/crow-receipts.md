---
status: live
until: 2026-11-17
dies-when: the verdict line below is written
---

# crow receipts — measuring crow before and after FRM-502

Ticket: FRM-502

crow is adopted (`docs/test-drive/crow.md`); this trial adopts nothing. it is the reminder to measure what FRM-502 changes (dima, 2026-11-03: «just for measurement, not for adoption … just as a reminder for measuring it»).

**test card:** we believe the receipt slice and the claim and risk wakes make crow catch slips it misses today · we test it by the replay set (today's known slips, packets built old and new) and two weeks of live wakes · we measure per slip caught or missed, the share of `#dima-caught` flawlog lines crow flagged first (read at every halt), what each vetted note changed (`--changed`), dima's weekly 5-note grade, and the cost per wake · we're right if the new packets catch more replay slips than the old and the `#dima-caught` share crow flagged first rises over the two weeks
**kill rule:** none; a measurement runs its two weeks. clio's own ok verdicts never count as proof (one model family)

## stress list
- receipt slice — a claim wake after a «fixed» with no exit-0 call — caught or missed
- risk wake — a paid submit, a public post, a ticket close — wakes, holds, timed-out rows
- grading — `--changed` on every verdict — the acted-on share
- baseline — the replay set, before FRM-502 lands — slips caught per packet

## rounds

## verdict
