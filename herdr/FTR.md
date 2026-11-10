# herdr — features

wish: PK-363

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are sixth sense's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## the setup — x-herdr

- 🧭 the setup is `x-herdr`, and «zoo» appears nowhere he looks
  - given the takeover of zoo's parts is done
  - then the layout is `layouts/x-herdr.json`, and a grep for «zoo» in his layout, the mod names, the shared keys and every label he sees prints nothing
  - decision: the name is his pick, «it is plain but clean» (17:17); each mod keeps its own name (fleet-board, x-herdr-chatter, agents-list)
  - decision: the right column becomes `x-herdr-deck` (his tick, 17:46), renamed last, after the mods lane's tick work: x-mod-guard and x-mod-stash read fleet-board's press path and name, so it is one change across both mods, the layout, the manifest and every doc; done = a grep for `fleet-board` prints nothing
  - decision: the layout rename lands last, as its own ⚠️ ask, after a throwaway herdr home shows what a rename restarts (W416)

## fleet-board — sessions

- ⬜ the deck reads at one type scale, each section under one head
  - given the deck draws
  - then names and ask text are 15 px, secondary lines 13 px, nothing under 12 px, and no secondary text is the theme's `dim` (2.95:1 on white; `muted` is 5.48:1, 5.07:1 on a card)
  - and the three heads read «🧵 sessions: N, M working», «🪐 orbit: N asks waiting on you», «🛼 glide: N lanes», semibold 13 px under a hairline
  - and each ask is a card led by its bold id, its tick a filled button and replay a quiet one, each 28 px tall; past 60 % a seat's ctx turns red and semibold (shot 1953, before and after)
  - not checked: the glide cards (below the fold in the shot), the focus ring by keyboard, the dark theme
- ⬜ the deck's sessions and orbit sections follow the agents list's order
  - given dima drags a thread in the agents list
  - then the deck's sessions rows and its orbit sections move to the same order at once, and an ask arriving never reorders them (shot 2024)
  - decision: the agents list publishes the pids it shows as shared `x-herdr-agents.order`, the deck reads that one key (dima, 20:20: «The order in the agents list is the true source for the order in Orbit for threads»); this replaces blocked-first for the listed seats, their state still shows by the dot
  - decision: a `claude --bg` seat shows in herdr as `claude attach <job id>`, so the list finds its session by the registry file's `jobId`
  - not checked: a drag by his hand
- ✅ every live seat on one list
  - given seats run on this mac
  - when the board draws
  - then each live seat shows as one row by its session name, in the agents list's order; a seat the list does not show goes last, blocked first, then working, then by name
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

- ⬜ a plain ask's tick is a toggle: 🛎️ → ✅ → 🔒
  - given dima ticked a plain ask and its seat has not taken the press yet
  - when he clicks its ✅ ticked
  - then the press leaves the ticks file and 🛎️ tick shows again; once the seat takes it, the ask reads «🔒 ticked, the session took it» (shot 1936)
  - and a press waiting on an idle seat stays ✅ however long it waits: the board reads it from the ticks file
  - decision: a gated ask keeps its one-way press until the mods lane's tick fixes settle (clio, 19:34)
  - not checked: the click itself, by his hand
- ✅ each ask leads with its id, so dima can name it
  - given a seat has an open ask with an id
  - then the board reads «🪐 **o36**: <text>», under a head «🪐 orbit: N asks waiting on you», each asker's name bold at the name size (shot 1929)
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
- ⬜ one-click 🛎️ on a guarded ask
  - makes: one press line in the seat's ticks file, the same as a plain tick
  - given the stash marks the ask `isGated` (a sign, a merge, a ⚠️ or a quoted command)
  - when dima clicks its 🛎️ on the deck
  - then the guard reads that press as his tick for that ask's targets, within 2 h, once
  - decision: the 🛎️ is click-only; a keyed mod command is any shell's (FRM-544)
  - decision: the «🚦 tick in its pane» door and fleet-board's own copy of the gated pattern are gone (live 18:51:40), after the guard's fences went clean at a14bca4b; his own click on a real gated ask is the last proof, set up by clio
- 🧭 a standing override button on the board, behind slice 2 of FRM-544
  - given the operator override is off
  - when dima clicks its button on fleet-board
  - then the override turns on with `by: press`, and a second click turns it off
  - decision: click-only, never a keyed command: any shell can reach a keyed command (FRM-524:W53)
- 🧭 🛎️ on every gated ask, from the stash's `isGated`
  - given an ask the guard gated (the merge brake, the override, a merge hold, a held file, a raw `gh pr merge`, a sign)
  - when dima clicks its 🛎️ on fleet-board
  - then that one action passes once, and fleet-board's own guarded-ask pattern is gone

## seats — tabs

- ⬜ the agents list is one flat list in dima's own order
  - given seats come, go and change state
  - then no Unread or Working section shows, a new seat joins at the end, and a row never moves when its state changes; the dot, the tick and the spinner stay (shot 1932)
  - and dima drags a row to set its place, the order kept across restarts
  - not checked: the drag itself, by his hand
- ⬜ each tab shows its seat's emoji and session name, with no zoo creature (x-herdr-tabs, FRM-567)
  - given x-herdr-tabs is placed in the layout
  - then every agent tab reads as that seat's row in the agents list and on the deck, a long name cut with an ellipsis and whole on hover; the dot, the tick and the spinner match the agents list's
  - and the tab drops the member word after the badges, «⚡ 🔧 codie: herdr lane | PK-363» → «⚡ 🔧 herdr lane | PK-363», so a cut tab keeps what tells it apart (shot 2025)
  - and an inactive tab shrinks to 110 px at least, so its badge and a readable name both stay; past that the bar scrolls sideways (dima's tick, 20:28; shot 2028)
  - and a click, the ×, the + menu and a right-click do what they did under zoo's tabs
  - decision: the agents list reads each session name once and publishes it (`x-herdr-agents.names`); the tab bar reads that, never a second naming rule
  - not checked: in his tab bar, until the layout switch his tick allows (shots 1942 before and after, drawn as an overlay)
- ✅ a sidecar seat starts in its own named tab
  - given helga or crow starts in herdr
  - then it shows in the agents list in a tab named after it, never a number

## tray — quick terminal

- ⬜ ctrl-j opens and closes the quick-terminal tray
  - given any view shows
  - when dima presses ctrl-j
  - then the tray with its quick terminal opens, and a second press closes it
  - decision: herdr ships no tray: zoo's `quick-term` is the tray's head row and its whole logic (a kept terminal per space, found again after a restart, local or dev container, the keyboard on open); the terminal in it is herdr's own. it stays and becomes `x-herdr-terminal` (dima, 18:11)
  - decision: the tray stays and is rebranded as ours, after my-tabs (dima, 16:41); bound in `keys.json` `global` by clio on his word, backup `~/.local/state/herdr-mod-backups/keys-1641.json`
  - decision: a `global` ctrl+letter is taken from the terminal (herdr's guide, § Keys), so in a seat's Terminal view cc's ctrl+j new line no longer reaches cc (read from the guide, not probed by a keypress)

## chat view — x-herdr-chatter

- ✅ **bold** and *italic* in replies draw bold and italic
  - given the chat's font is Sans
  - then a reply's markdown bold reads bold (shot 1928)
  - decision: Sans is the system font: herdr's own UI font, Geist, ships one face and drew bold flat
- ✅ the chat is ours by name: `x-herdr-chatter`
  - makes: `home/.config/herdr-app/mods/x-herdr-chatter`, landed into `~/.config/herdr-app/mods/x-herdr-chatter` by `herdr-mods:land`
  - given `layouts/zoo.json` places `x-herdr-chatter`
  - then herdr opens no file of zoo's `claude-chat`, and every name dima sees reads x-herdr-chatter
  - proof: the layout's mods read with jq name `x-herdr-chatter` and no `claude-chat` (17:35:34, status errors [])
  - decision: copied from zoo's `claude-chat` (FRM-556, 11-10), whose folder stays on disk unplaced; the shared keys `chat.look/subs/containers` keep their names until zoo's other mods are ours
- ✅ drafts typed under the old name come along
  - given dima typed a draft in a seat's box while the chat was `claude-chat`
  - when `x-herdr-chatter` first starts
  - then that seat's box shows the draft, and a draft typed in `x-herdr-chatter` is never overwritten
  - proof: a throwaway mod with the same `drafts.js` took a draft from a fixture store, left other keys, set its flag (17:17); the live switch ran it and found the old store empty (17:35:34)
  - decision: herdr keeps a mod's storage per mod name, so `drafts.js` reads `data/claude-chat/store-*.json` once
- ⬜ a pasted image survives a chat reload
  - given dima pasted a screenshot into a seat's box and has not sent it
  - when the chat reloads
  - then the image is still waiting with the next message, shown by its chip
  - decision: not built in FRM-556; his words: «same for screenshots attached in chatter» (PK-363:W355)
- ⬜ the shared keys carry the x-herdr name
  - given the chat, the status bar and the agents list share `chat.look`, `chat.subs`, `chat.containers`
  - then each key is `x-herdr-chatter.*`, read by every mod under its new name, and «zoo» appears nowhere
  - decision: left for after zoo's other mods are ours (my-status reads them), FRM-556
- ⬜ the chat mod passes its own type check
  - given `pnpm exec tsc -p home/.config/herdr-app/mods/x-herdr-chatter/jsconfig.json`
  - then it exits 0; today 468 errors carried from zoo's copy, and `pnpm typecheck` does not cover the mod
- ⬜ the chat mod has tests
  - given its pure helpers (`drafts.js`, the turn fold, the `hc send` reading)
  - then each has a vitest file beside it, run by the commit gate

- ⬜ the effort shows the seat's live value
  - given a seat's last reply ran at an effort
  - then the chat box's effort reads that value, past the default in settings
- ⬜ no seat strip above the chat: a seat's facts live in the band, its asks on the deck
  - given a seat's tab is open in the Chat view
  - then the chat starts right under the tab bar, with no strip of asks above it (shot 2021-strip-hidden)
  - decision: the strip is gone (dima, 20:12: «can i have this dupe orbit killed? it eats UI»), lifting his 18:11 «keep for now»; its block is hidden by one `layout.hide` click, zoo.json untouched, and fleet-board's `view: seat` copy draws and reads nothing
- ⬜ the band sits right above the chat's text box, slice 1 ([FRM-565](https://linear.app/x-com/issue/FRM-565))
  - given a seat's tab is open in the Chat view
  - then three rows above his box read its «waiting on» line, the weekly usage and its context, as in his shot `~/.local/state/looks/PK-363/1811-dima-band-in-desktop-app.jpg`
  - and a seat mid-turn or waiting on nothing shows an empty waiting-on row, a long one is cut with … and whole in its tooltip, and the rows keep one height so nothing moves
  - and facts the deck has not published for over 2 min 15 s draw dimmed
  - and the 5h line is off for now, back if he moves to the $100 plan (on $200 it is not shown)
  - decision: the deck's mod reads the facts once and publishes them to herdr's shared state `x-herdr-deck.seats`, at once on a change and every 60 s; the chat reads only that key for its own seat
- 🧭 the band's buttons and its redesign, slice 2 (FRM-565)
  - decision: shaped with dima before a line is built
- ✅ the chat box's draft survives a chat reload
  - given dima has typed into a seat's Chat box
  - when the chat mod reloads
  - then the box shows his text again (proven in wing 1's tab, 16:57:57)
- ✅ the chat box's draft survives a seat switch
  - given dima has typed into a seat's Chat box
  - when he goes to another seat's tab and comes back
  - then the box shows his text, the caret at its end
  - decision: a seat switch never writes a draft; only typing, a quote, a completion and a send write it, under the seat the box shows (live 19:17:58)
  - cause, proven: the switch ran inside render, and herdr refuses the caret set there, so the render failed midway: the box took the new seat's draft while it kept the old seat's address, and the next switch wrote that under the old seat (the caret line came with FRM-556, the write with zoo's copy). the switch now runs in a task (live 19:21:41)
  - proof: `herdr-app do tab.next` before the fix drew «This view could not be re-rendered… set_selected_range cannot run during render»; after it, no error, herdr-codie's band and transcript showed, and back on wing 1 its draft «t» was in the box (shots 1921, 1922)
- ✅ every reply of an earlier turn stays open
  - given a seat sent several replies between two of dima's messages (a peer's ping starts no turn)
  - when that turn is no longer the last
  - then each reply still shows in full; only the tools and notes between them fold into «▸ N tools»
  - proof: a probe seat's turn with three reports and two tools, before «▸ 2 tools · 2 messages» and the last report only, after all three reports (shots 17:45); clio's session: 83 more replies drawn across its 32 turns, 18 at most in one
  - decision: one settings row, «Earlier replies: Open / Folded», default Open (clio's ok on dima's «i see no list», 17:41); the old «Earlier turns: Fold / Show» row goes
- ✅ a resize keeps the chat on its newest message
  - given the chat shows its newest message, or within 40 px of it
  - when the tray or a panel opens or closes
  - then the newest message stays in view and no «↓ Newest» shows (shots 17:39, tray and Files open and closed)
- ⬜ after a reload the caret sits at the draft's end
  - given a draft came back after a reload
  - when dima types on
  - then his text goes after the draft, never in front of it
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
