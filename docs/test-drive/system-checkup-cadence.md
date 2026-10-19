---
status: live
until: 2026-11-16
dies-when: the verdict line below is written
---

# system-checkup cadence — one check per halt, rotating, or back to manual

Ticket: none (pocket PK-203)

**test card:** we believe one check per halt, rotating (dima's o59 tick: «a rotating slice at each halt, the whole wheel every ~2 weeks»), keeps the plate turning without a dedicated session · we test it by `cclio:halt` phase 3.3 running the check longest since its log line, every halt; the boot's weekly `DUE` line is only the fallback · we measure per halt: the check run, minutes, 🔴 found, fixed in place or asked, and whether a halt skipped it · we're right if 4 of 5 halts run their slice and the wheel completes within 3 weeks
**kill rule:** two halts in a row skip the slice — the cadence goes, the checkup stays manual (dima, 2026-10-19: «if it's not, I'll just switch it to a manual system checkup invocation»)

## stress list
- the halt slice — phase 3.3 — picks the oldest check, minutes per slice
- the due line — the boot digest — prints on day 7, never before (the fallback)
- a targeted run — `checkup <id>` on one check — minutes vs a whole run
- a whole run — every check — minutes, 🔴 count, fixed vs asked

## rounds

## verdict
