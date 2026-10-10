# x-mod-stash — dima's command center above the prompt

one row over every live session: orbit's and the plan's counts, the meters, the afk switch, keep-hot 🔥, and
the `/board` fleet board, where orbit 🪐 holds the session's asks. what each does, and every decision behind it: `FTR.md`.
the words: `GLOSSARY.md`.

## keep-hot — the want (2026-10-04)

> sometimes i spend too much of the 5h window by accident: a few % left, and ~3-4 h before the reset.
> so i need a «keep-session-hot» feature, likely a minimal auto-ping every ~50 min.

- why: a cold cache makes the first prompt after the reset re-write the whole context at the 1h
  price (2×); a warm ping reads it at 0.05× — four pings over a 3.5 h wait cost about a tenth of
  one cold write (pricing from the claude-api skill; how the 5h meter counts cache reads is unmeasured)
- out: pinging a busy session, auto-on without dima's click, any window but the 5h one

## orbit — the want (2026-10-10)

> the main thread is chaotic and multi-lane, so i often miss data in your messages that i don't want to miss. … each of your asks is a checkbox line; checked means i agree and accept your proposal … this way i do not need to copy-paste.

- why: 71 % of cclio's replies ended with an ask block, he pasted 58 of 136 back unchanged, and the block broke whenever a second lane changed it mid-read (the comms ledger, `docs/knowledge/operator-agent-comms-optimization.md`)
- the full want, the grill and the chunks: cclio's pocket PK-20
- out: other sessions' asks in one list, a turn started by the mod, a new skill for the contract

