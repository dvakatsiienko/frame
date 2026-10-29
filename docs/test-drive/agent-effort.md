---
status: adopted
until: 2026-10-24
dies-when: the verdict line below is written (2026-10-22)
---

Ticket: none

# per-call effort on one-off subagents — does `high` pay over `medium`?

the `Agent` tool takes `effort` per call since cc 2.1.292; the harness lets clio pass it only where a
memory line names the effort — `craft-spawning`'s 🎚️ line (dima's yes, 2026-10-08). a one-off
`general-purpose` agent otherwise inherits the session's effort.

## stress list

- the same 3 one-off asks run twice, `medium` and `high`, on fresh `general-purpose` agents:
  - a lookup with one right answer (a cc docs fact, checkable by a grep)
  - a cross-file diagnosis (why a guard fired, read from the hook and the log)
  - a source-reading research question (one doc + one repo)
- each round records: seconds, total tokens (the agent's usage line), hit or miss against a known answer,
  and what `high` found that `medium` missed
- `low` is out: medium is the baseline (dima, 2026-10-01)

## rounds

- 2026-10-15 · extended once to 10-22 on dima's tick (0 rounds by the first end): its rounds are logged by PK-90, the spawning refresh, whose subagent research passes effort per call and records it
- 2026-10-15 18:25 · round 1, card calls: wishkeeper's siesta at `effort: high` over a card set to `medium` — 225k tokens, 10 min, 17 findings (3 high, all checked true at their spots) · the question this trial now owns: does a per-call `high` on a card catch what its `medium` default would miss? revert rule (dima's o34): a later pass catches what a medium siesta missed → the card goes back to high. the generic-agent half is gone (generic denied fleet-wide)
- 2026-10-22 · three wishkeeper calls at `effort: high` over its `medium` card: boot (11 findings, 2 high, both true at their spots), the pm issue list (16 findings, 3 high, 1 wrong — the «no such channel» claim, caught by ccrow), the siesta (running) · ~55–63k tokens and 2–2.5 min each

## verdict

- 2026-10-22 · **adopted** (dima's o33): `medium` on every card, `high` passed per call for a hard review — 4 wishkeeper rounds at high, 46 findings, 1 wrong; the per-call value holds on resume
