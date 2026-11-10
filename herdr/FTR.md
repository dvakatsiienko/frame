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
- ⬜ the deck draws from the state files on the shelf, never the stash's private store
  - given x-mod-stash writes each thread's `~/.claude/shelf/herdr-state/<sid>.json`
  - then every thread's asks, phases, waiting-on line, context and model draw from it, a thread after `/clear` included, and `rg x-mod-stash_inline` over fleet-board prints nothing
  - decision: a thread's file is found by its pid, the newest `at` winning, since the registry keeps the old id after a `/clear` (FRM-568)

## fleet-board — orbit

- ⬜ a plain ask's tick is a toggle: 🛎️ → ✅ → 🔒
  - given dima ticked a plain ask and its seat has not taken the press yet
  - when he clicks its ✅ ticked
  - then the press leaves the ticks file and 🛎️ tick shows again; once the seat takes it, the ask reads «🔒 ticked, the session took it» (shot 1936)
  - and a press waiting on an idle seat stays ✅ however long it waits; 🔒 shows only once the published ask is locked, which a turn does, never the stash's 4 s read of the press (his hand-test, 20:52)
  - and his second click takes a tick back until a turn takes it, gated asks too: a press the stash has not read leaves the ticks file, one it has read gets an untick line (`{id, verdict: "untick", at}`) the stash answers by dropping the mark; «↩︎ unticking» shows until it has (dima: «ticked and able to untick until you actually receive them»)
  - not checked: the stash's side of the untick line, the mods codie's, not landed yet
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
  - and an inactive tab shrinks to 110 px at least, so its badge and a readable name both stay (dima's tick, 20:28; shot 2028)
  - and past the bar's width a sideways swipe moves it one tab, and a newly active tab is brought into view (his word, 20:52: the scroll was too fast)
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

- ⬜ lines he never typed fold out of his way (FRM-562:W17)
  - given a seat's transcript holds a plugin's message (an orbit tick), a task notice or a synthetic «No response requested.»
  - then each draws as one dim line that opens to its whole text on a click, and «System lines: Folded / Hidden / Shown» in ⚙ picks the look, Folded by default
  - and a message he pasted reads as his plain text, the `<pasted_content>` tags gone; a system-reminder with an id attribute goes too
  - decision: told apart by the entry (its `origin.kind`, a `<synthetic>` model), never by guessing at text
  - not checked: the after shot of his paste in clio's chat, which waits for his view on that tab
- ⬜ a prompt he types while a turn runs draws in the chat
  - given dima sends a seat a prompt while its turn is still running
  - then it draws as his message at the place he sent it, a shot or a paste in it too, marked no differently
  - and a peer's message or a task notice queued the same way does not draw as his
  - decision: Claude Code writes such a prompt as a `queued_command` attachment with `origin.kind` human, never a user entry; the chat reads it as one
- ⬜ a big thread opens at once on its newest part
  - given a seat whose transcript is past 4 MB (clio's 56 MB, wing 1's 23 MB)
  - when dima opens its tab
  - then the newest messages draw within a moment (clio's: 3.9 s → 0.6 s to the first frame), and «Show earlier» at the top reads the next older part in above, his scroll place kept
  - decision: read on his ask, never all on open: the read of every slice, not the parse or the draw, took the time (2.1 s of 2.3 s)
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
- ⬜ the band's buttons, slice 2 (FRM-565)
  - given a seat's tab in the Chat view
  - then right of «wait» sit 🐦‍🔥 🔥 ⏰ 💨 🔓 🎛️ 🚦, emoji only, each word leading its tooltip (dima, 21:02); filled when on, 🔓 red when on
  - and 🚦 shows and hides the deck by herdr's `layout.toggle` on its block, no layout file write (proof 2102: 9 seats before, hidden and after; his click «board confirmed to work»)
  - and 🔓 reads the override store `x` reads; its click waits on the mods codie's proof row; 🐦‍🔥 🔥 ⏰ 💨 wait on FRM-568's press file, 🎛️ on the settings view: greyed, the reason on hover
  - and ctx sits above week (dima, 21:00)
  - decision: his crop (2054) approved at 20:59
- ✅ a transcript past 64 MB draws: the chat reads it a slice at a time with `tail | head`, since herdr's readFile refuses a bigger file (a 93 MB seat drew empty, 21:02)
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
- ⬜ once he scrolls up, nothing but his own hand moves his view (FRM-562:W18, W19)
  - given he scrolled up in a seat's chat
  - when a reply, a tool line, a peer or plugin line, a turn end, a store change, a resize or a reload of the mod arrives
  - then the text he reads stays where it is; only his scroll to the end or a click on «↓ Newest» brings him back to following
  - and each seat keeps its place across a tab switch, and across a reload of the mod
  - decision: «following» is a state he enters and leaves by his own scroll or click, never set by a redraw (scroll.js, one rule)
  - not checked: by his hand in his window
- ✅ a resize keeps the chat on its newest message
  - given the chat is following, his own scroll at the end
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
