---
status: live
until: 2026-11-16
dies-when: the verdict line below is written
---

# system-checkup cadence — a weekly «due» line on the boot board, or back to manual

Ticket: none (pocket PK-203)

**test card:** we believe a weekly due line on the boot board gets `cclio:system-checkup` run often enough to catch drift, without becoming a chore dima skips · we test it by the boot digest printing `checkup: … DUE` 7 days after the last run (`cclio/checkup/log.md`), cclio offering it on the board · we measure per due: offered, run or skipped, minutes, 🔴 found, fixed in place · we're right if at least 3 of 4 dues get run and each run fixes or asks at least one real finding
**kill rule:** dima skips two dues in a row, or two runs in a row find nothing — the cadence goes, the checkup stays manual (dima, 2026-10-19: «if it's not, I'll just switch it to a manual system checkup invocation»)

## stress list
- the due line — the boot digest — prints on day 7, never before
- a targeted run — `checkup <id>` on one check — minutes vs a whole run
- a whole run — every check — minutes, 🔴 count, fixed vs asked

## rounds

## verdict
