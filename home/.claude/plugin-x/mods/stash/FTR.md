# stash — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## the row

- 🔎 one row: asks on the left, the afk switch on the right
- 🔎 asks: every live session's open asks, «no open asks» when empty
- 🔎 copy all, per thread
  - decision: no per-item copy, no prompt injection — injection destroyed dima's typed prompt
- ⬜ afk switch: only the emoji changes (☕ / 🌙), accent background when on
- 🧭 holds chip: `🔒 n` counts other sessions' holds in this repo
  - given session A holds 2 files in this repo
  - when session B's row draws
  - then B shows `🔒 2`; at zero the chip is hidden
- 🧭 holder warning: the holder's chip turns ⚠ after someone was refused
  - given A holds `x.ts`
  - when B's edit of `x.ts` is refused
  - then A's chip shows ⚠, and A gets no message

## edits — holds

two sessions, A and B, in one checkout.

- 🧭 holds run in a Code-tab session
  - given a Code-tab session
  - when holds checks a file's git state
  - then the check returns; if it cannot, the build stops before any other line
- 🧭 a first edit takes the hold
  - given A edited `x.ts`
  - when B edits `x.ts`
  - then B is refused, and the message names A and when A took the hold
  - decision: no override in v0 — the deny names who to ask
- 🧭 the holder keeps editing
  - given A holds `x.ts`
  - when A edits it again
  - then the edit goes through
- 🧭 other files stay free
  - given A holds `x.ts`
  - when B edits `y.ts`
  - then the edit goes through
- 🧭 a commit releases
  - given A committed `x.ts`
  - when B edits it
  - then the edit goes through and A's hold is gone
- 🧭 a new file stays held until committed
  - given A created a new file and left it uncommitted
  - when B edits it
  - then B is refused
- 🧭 a dead holder releases
  - given A's process was killed
  - when B edits A's file
  - then the edit goes through
- 🧭 an idle holder releases
  - given A's last turn ended over 30 minutes ago
  - when B edits A's file
  - then the edit goes through
  - decision: 30 min — prior art ranged 5–120, and 5 min dropped long turns
- 🧭 one winner in a race
  - given A and B edit the same new file in the same second
  - then exactly one of them holds it
- 🧭 a broken store never blocks work
  - given the store file is unreadable
  - when B edits
  - then the edit goes through and the error is logged
