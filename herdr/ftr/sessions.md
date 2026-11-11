# herdr — x-herdr-deck — sessions

wish: PK-363 · legend and the other areas: [FTR.md](../FTR.md)

- ⬜ the deck reads at one type scale, each section under one head
  - given the deck draws
  - then names and ask text are 15 px, secondary lines 13 px, nothing under 12 px, and no secondary text is the theme's `dim` (2.95:1 on white; `muted` is 5.48:1, 5.07:1 on a card)
  - and the three heads read «🧵 sessions: N, M working», «🪐 orbit: N asks waiting on you», «🛼 glide: N lanes», semibold 13 px under a hairline
  - and each ask is a card led by its bold id, its tick a filled button and replay a quiet one, each 28 px tall; past 60 % a thread's ctx turns red and semibold (shot 1953, before and after)
  - not checked: the glide cards (below the fold in the shot), the focus ring by keyboard, the dark theme
- ⬜ the deck's sessions and orbit sections follow the agents list's order
  - given dima drags a thread in the agents list
  - then the deck's sessions rows and its orbit sections move to the same order at once, and an ask arriving never reorders them (shot 2024)
  - decision: the agents list publishes the pids it shows as shared `x-herdr-agents.order`, the deck reads that one key (dima, 20:20: «The order in the agents list is the true source for the order in Orbit for threads»); this replaces blocked-first for the listed threads, their state still shows by the dot
  - decision: a `claude --bg` thread shows in herdr as `claude attach <job id>`, so the list finds its session by the registry file's `jobId`
  - not checked: a drag by his hand
- ✅ every live thread on one list
  - given threads run on this mac
  - when the board draws
  - then each live thread shows as one row by its session name, in the agents list's order; a thread the list does not show goes last, blocked first, then working, then by name
  - decision: a thread whose process is gone draws no row, so no press goes to a dead thread
  - decision: the name sorts by its words, past a leading badge, so 🦉 and 🎀 never decide the order
- ✅ a thread's row reads its model and context
  - given a thread has run a turn
  - then its row shows its model and a context bar with its percent, red from 60 %
- ✅ a thread's waiting-on line
  - given a thread's last reply ended with a 🔭 line
  - then its row shows that line under the name, selectable
- ⬜ a thread's phases fold open
  - given a thread has phases
  - when dima clicks its row
  - then its phases show under it, and a second click folds them
- ⬜ the deck draws from the state files on the shelf, never the stash's private store
  - given x-mod-stash writes each thread's `~/.claude/shelf/herdr-state/<sid>.json`
  - then every thread's asks, phases, waiting-on line, context and model draw from it, a thread after `/clear` included, and `rg x-mod-stash_inline` over x-herdr-deck prints nothing
  - decision: a thread's file is found by its pid, the newest `at` winning, since the registry keeps the old id after a `/clear` (FRM-568)
