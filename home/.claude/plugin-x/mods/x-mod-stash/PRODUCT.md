# x-mod-stash — dima's command center above the prompt

one folded row over every live session: its open ⏳ asks, the afk switch, keep-hot 🔥, and the `/board`
fleet board. what each does, and every decision behind it: `FTR.md`.
the words: `GLOSSARY.md`.

## keep-hot — the want (2026-10-04)

> sometimes i spend too much of the 5h window by accident: a few % left, and ~3-4 h before the reset.
> so i need a «keep-session-hot» feature, likely a minimal auto-ping every ~50 min.

- why: a cold cache makes the first prompt after the reset re-write the whole context at the 1h
  price (2×); a warm ping reads it at 0.05× — four pings over a 3.5 h wait cost about a tenth of
  one cold write (pricing from the claude-api skill; how the 5h meter counts cache reads is unmeasured)
- out: pinging a busy session, auto-on without dima's click, any window but the 5h one
