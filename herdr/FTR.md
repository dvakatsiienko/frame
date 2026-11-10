# herdr — features

wish: PK-363

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are sixth sense's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## fleet-board — sessions

- ⬜ every live seat on one list
  - given seats run on this mac
  - when the board draws
  - then each live seat shows as one row by its session name, blocked first, then working, then the rest by name
  - decision: a seat whose process is gone draws no row, so no press goes to a dead seat
- ⬜ a seat's row reads its model and context
  - given a seat has run a turn
  - then its row shows its model and a context bar with its percent, red from 60 %
- ⬜ a seat's waiting-on line
  - given a seat's last reply ended with a 🔭 line
  - then its row shows that line under the name, selectable
- ⬜ a seat's phases fold open
  - given a seat has phases
  - when dima clicks its row
  - then its phases show under it, and a second click folds them

## fleet-board — orbit

- 🔎 a plain ask ticks from the board
  - makes: one press line in `~/.claude/shelf/orbit-ticks/<session id>.jsonl`
  - given a seat has an open ask
  - when dima clicks 🛎️ tick
  - then the seat's next turn reads it as ticked from herdr, and the ask leaves the board
- ⬜ replay with a steer
  - makes: one press line with the steer in the seat's ticks file
  - given a seat has an open ask
  - when dima types in its steer field and clicks 🔁 replay
  - then the seat's next turn reads another round with his steer
- ⬜ ask text keeps a literal `<word>`
  - given an ask, a pick or a waiting-on line holds `<target>` outside a code span
  - then the board draws it as written, never dropped as html
- ⬜ 🚦 tick in its pane, for a guarded ask
  - given an ask leading with ⚠️, a sign, a merge or a quoted command
  - when dima clicks 🚦 tick in its pane
  - then the seat's pane comes forward in its Terminal view with its own board open, where the ask's 🛎️ is his tick
  - and when the seat is mid-turn, the board opens at its turn end and a muted ⏳ line says so
  - and when its prompt box holds a draft, nothing is typed and a line says to send or clear it
  - decision: opening a board unlocks nothing; only his 🛎️ there does
- 🧭 one-click 🛎️ on a guarded ask, behind `GATED_TICK`
  - makes: one press line in the seat's ticks file, the same as a plain tick
  - given the guard's fence on the ticks folder is on main and the flag is on
  - when dima clicks 🛎️ on a sign, merge or ⚠️ ask
  - then the guard reads that press as his tick for that ask's targets, within 2 h, once
  - decision: the 🛎️ is click-only; a keyed mod command is any shell's (FRM-544)

## seats — tabs

- ⬜ a sidecar seat starts in its own named tab
  - given helga or crow starts in herdr
  - then it shows in the agents list in a tab named after it, never a number

## chat view

- ⬜ the effort shows the seat's live value
  - given a seat's last reply ran at an effort
  - then the chat box's effort reads that value, past the default in settings
- 🧭 the band and the asks in the chat view (FRM-561)
  - given a seat is selected in the Chat view
  - then its context percent, its waiting-on line, the weekly usage and its open asks with their 🛎️ show without a flip to the Terminal view
  - and the strip grows with its asks and shrinks back, the transcript below it kept
  - decision: fleet-board draws it as a second copy in `view: seat`, since a herdr mod imports nothing outside its folder; it shows once `layouts/zoo.json` places that block (his ⚠️ tick)
