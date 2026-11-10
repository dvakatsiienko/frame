# herdr — features

wish: PK-363

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are sixth sense's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## fleet-board — sessions

- ✅ every live seat on one list
  - given seats run on this mac
  - when the board draws
  - then each live seat shows as one row by its session name, blocked first, then working, then the rest by name
  - decision: a seat whose process is gone draws no row, so no press goes to a dead seat
  - decision: the name sorts by its words, past a leading badge, so 🦉 and 🎀 never decide the order
- ✅ a seat's row reads its model and context
  - given a seat has run a turn
  - then its row shows its model and a context bar with its percent, red from 60 %
- ✅ a seat's waiting-on line
  - given a seat's last reply ended with a 🔭 line
  - then its row shows that line under the name, selectable
- ⬜ a seat's phases fold open
  - given a seat has phases
  - when dima clicks its row
  - then its phases show under it, and a second click folds them

## fleet-board — orbit

- ⬜ a plain ask ticks from the board
  - makes: one press line in `~/.claude/shelf/orbit-ticks/<session id>.jsonl`
  - given a seat has an open ask
  - when dima clicks 🛎️ tick
  - then the seat's next turn reads it as ticked from herdr, and the ask leaves the board
  - decision: ⬜, not 🔎: nobody has his own word yet that a plain tick held
- ⬜ replay with a steer
  - makes: one press line with the steer in the seat's ticks file
  - given a seat has an open ask
  - when dima types in its steer field and clicks 🔁 replay
  - then the seat's next turn reads another round with his steer
- ✅ ask text keeps a literal `<word>`
  - given an ask, a pick or a waiting-on line holds `<target>` outside a code span
  - then the board draws it as written, never dropped as html
- ⬜ 🚦 tick in its pane, for a guarded ask
  - given an ask leading with ⚠️, a sign, a merge or a quoted command
  - when dima clicks 🚦 tick in its pane
  - then the seat's pane comes forward in its Terminal view with its own board open, where the ask's 🛎️ is his tick
  - and when the seat is mid-turn, the board opens at its turn end and a muted ⏳ line says so
  - and when its prompt box holds a draft, nothing is typed and a line says to send or clear it
  - decision: opening a board unlocks nothing; only his 🛎️ there does
  - decision: a stopgap he dislikes until the one-click 🛎️ lands — «I don't like this tick-in-the-pane feature» (dima, 15:19)
- 🧭 one-click 🛎️ on a guarded ask, behind `GATED_TICK`
  - makes: one press line in the seat's ticks file, the same as a plain tick
  - given the guard's fence on the ticks folder is on main and the flag is on
  - when dima clicks 🛎️ on a sign, merge or ⚠️ ask
  - then the guard reads that press as his tick for that ask's targets, within 2 h, once
  - decision: the 🛎️ is click-only; a keyed mod command is any shell's (FRM-544)

## seats — tabs

- ✅ a sidecar seat starts in its own named tab
  - given helga or crow starts in herdr
  - then it shows in the agents list in a tab named after it, never a number

## tray — quick terminal

- ⬜ ctrl-j opens and closes the quick-terminal tray
  - given any view shows
  - when dima presses ctrl-j
  - then the tray with its quick terminal opens, and a second press closes it
  - decision: the tray stays and is rebranded as ours, after my-tabs (dima, 16:41); bound in `keys.json` `global` by clio on his word, backup `~/.local/state/herdr-mod-backups/keys-1641.json`
  - decision: a `global` ctrl+letter is taken from the terminal (herdr's guide, § Keys), so in a seat's Terminal view cc's ctrl+j new line no longer reaches cc (read from the guide, not probed by a keypress)

## chat view

- ⬜ the effort shows the seat's live value
  - given a seat's last reply ran at an effort
  - then the chat box's effort reads that value, past the default in settings
  - decision: it lives in the chat mod `~/.config/herdr-app/mods/claude-chat`, outside frame and outside git until FRM-556 moves it in
- 🧭 the band and the asks in the chat view (FRM-561)
  - given a seat is selected in the Chat view
  - then its context percent, its waiting-on line, the weekly usage and its open asks with their 🛎️ show without a flip to the Terminal view
  - and the strip keeps one fixed height: a long ask list scrolls inside it, its head counts the asks, and the transcript below never moves
  - and a guarded ask shows there with no 🚦, which would flip his view: its tick waits for the one-click 🛎️
  - and it shows the seat that chat view shows, by the chat mod's own rule, so two views show their own seats
  - decision: the strip writes nothing but the ticks file and calls no `layout.*` command, since herdr saves those into his personal layout
  - decision: the seat comes from the chat mod's own rule, so when zoo's chat block names no terminal, both follow the shown tab together
  - decision: fleet-board draws it as a second copy in `view: seat`, since a herdr mod imports nothing outside its folder; it shows once `layouts/zoo.json` places that block (his ⚠️ tick)
- 🧭 the strip shows the seat's phases when no ask is open
  - given the seat in the Chat view has no open ask
  - then the strip lists its phases where the asks would sit
  - decision: not in his day-one pick; built once and cut, waiting for his word
- ⬜ a steer being typed survives a board reload
  - given dima has typed into an ask's steer field
  - when fleet-board reloads
  - then the field shows his text again

## scripts

- ✅ `pnpm herdr-mods:land <mod>` lands a mod from frame into herdr
  - makes: the mod's changed files in `~/.config/herdr-app/mods/<mod>`, a real folder
  - given a mod in `home/.config/herdr-app/mods/<mod>`
  - when the command runs
  - then herdr reloads that mod live, with no restart (proven on fleet-board, 16:20:39)
  - decision: a real folder, not a link: herdr reloads a real folder on save and never a link
- ✅ `pnpm herdr-mods:land --watch` lands every save in frame
  - given the watcher runs (it prints its pid; stop it by that pid)
  - when a mod file in frame is saved and `herdr-app check` passes on it
  - then its changed files land in one write once the check passes (~7 s: `herdr-app check` runs through the window), and herdr reloads it live
  - and a save the file watch misses still lands: a sweep by mtime each second catches it
  - and when the check fails, nothing lands and the watcher prints why (live: a half-built fleet-board save held, 16:30:09)
