---
status: live
until: 2026-11-04
dies-when: the verdict line below is written
---

# verifier-break-pass — the verifier also tries to break what it checks

Ticket: none

**born:** 2026-10-21 from `refresh-crew-coordinator` run #6 ([the findings](https://claude.ai/artifact/UQDHgn3qcntgD2UCShxpfv), `recipes/refresh-crew-coordinator/last/run6/research-craft.md` § 1, `neuroarxiv.md`). dima, o107: «let's try. what I didn't like is the noise part, but let's test drive this verifier extension. make it easy to undo if it doesn't work, and most importantly, measure it on all PRs the verifier runs.»

**test card:** we believe a capped break pass makes the verifier catch real breaks the exit lines miss · we test it by every PR a verifier checks until `until:` (the cli lane first), round 1 only · we measure per PR: probes run, breaks found, false alarms (a break dima or the coder shows is not one), refutes it caused, extra minutes · we're right if over all trial PRs at least 1 real break the exit lines missed turns up and false alarms stay at or below real breaks
**kill rule:** false alarms beat real breaks over 3 PRs in a row, or the pass adds more than 20 min to a round twice

**undo:** delete the «break pass» bullet in `x:crew-verifier` step 1.4 and the `break:` line of its verdict object; both name this file.

## stress list
- the contract written from the ticket before the diff (the neuroarxiv open thread: does it drift toward what was built?) — every PR — contract lines that the diff later contradicted
- concurrent action — a PR with a write path — broke or held
- slow or failed network — a PR with a fetch — broke or held
- hostile input — a PR with a form, an arg or a parser — broke or held
- a cli PR (no browser) — the cli lane — does the menu fit a cli at all

## rounds

## verdict
