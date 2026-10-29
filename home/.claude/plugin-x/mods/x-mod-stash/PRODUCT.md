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

- why: 71 % of clio's replies ended with an ask block, he pasted 58 of 136 back unchanged, and the block broke whenever a second lane changed it mid-read (the comms ledger, `docs/knowledge/fleet-operator-comms.md`)
- the full want, the grill and the chunks: clio's pocket PK-20
- out: other sessions' asks in one list, a turn started by the mod, a new skill for the contract


## settings — the want (2026-10-11)

> a foldable mods settings gui replaces the breather. i want at least the stash parts to be toggleable — for example the auto-compact threshold, show/hide — essentially any mod part. make me a really solid mod settings view with good ux. the settings exist so an mvp like the enhancer can be shown or hidden until it earns its place.
> don't change the current 5h and ctx bars, they are fine — only animate them. … i'm sharp on an eye and notice low fps very clearly.

- why: the enhancer mvp sat on the board with no way to hide it, the few knobs lived in scattered places, and the breather spent a row the band already has
- the cut: slice 1 — the breather's breathing moves onto the 5h and ctx bars (with a spinner take and a live frame-rate A/B); slice 2 — a 🎛️ toggle in the band folds out a show/hide switch per mod part plus 7 knobs, saved on each keystroke into one global file. polish tier: an internal tool, «works and clear»
- the grill, the decisions and the exit lines: [FRM-391](https://linear.app/x-com/issue/FRM-391)
- out: a `/settings` command, per-session settings, mobile, knobs beyond the 7, knobs for holds and redact, a designer pass
