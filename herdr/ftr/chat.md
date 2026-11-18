# herdr — chat view — x-herdr-chat

wish: PK-363 · legend and the other areas: [FTR.md](../FTR.md)

regroomed 2026-11-18 to the new chat, after zoo's x-herdr-chatter retired (FRM-638 end step); a line the new chat does not do yet stays ⬜ and names what is missing; a want blocked by an upstream (herdr-app, gpui-kit) lives in [FRM-655](https://linear.app/x-com/issue/FRM-655), herdr wishes: blocked upstream

## the mod

- ✅ the chat is ours by name: `x-herdr-chat`
  - makes: `home/.config/herdr-app/mods/x-herdr-chat`, landed into `~/.config/herdr-app/mods/x-herdr-chat` by `herdr-mods:land`
  - given `layouts/itrout.json` places `x-herdr-chat`
  - then herdr places no zoo chat: `x-herdr-chatter` and `x-herdr-chatter-header` retired at FRM-638's end step (2026-11-18)
  - decision: a new mod beside the old chat, moved in file by file under a strict type check, swapped in once at the end (dima, 2026-11-16 16:36: «pull only clean, decided features»)
- ✅ the chat mod passes its own type check
  - given `pnpm herdr-mods:typecheck`
  - then x-herdr-chat exits 0, its test files included
- ⬜ the chat mod has tests
  - given its pure modules (the reader, the row model, the quill, joins, find, the fold)
  - then each has a vitest file beside it, run by the commit gate
- ⬜ a transcript past 64 MB draws
  - then the chat reads it a slice at a time with `tail | head`, since herdr's readFile refuses a bigger file (a 93 MB thread drew empty under the old chat, 21:02)

## the list — reading a thread

- ⬜ the chat reads a thread, in a list that never moves without him (FRM-638, FRM-562:W18, W19)
  - given the Chat view shows a thread
  - then its transcript is drawn from its tail: his messages as bubbles on the right, replies as bubbles on the left with rich text and code blocks, a run of tool calls as one line that counts them by name (shot `~/.local/state/looks/FRM-638/1901-new-chat-overlay.png`)
  - and it opens at the newest and follows it only while he sits at the end; a wheel step up stops following, and a small «↓» at the bottom right goes back
  - and the end is the list's last line, read from the list itself: a step down that reaches it follows again, under a newest reply taller than the view too; a step that stops above it keeps him reading
  - and a reply, a tool line, a peer or plugin line, a turn end, a resize or a reload of the mod never moves the text he reads; only his scroll to the end or the «↓» brings him back to following
  - and a new line in the transcript changes only its own row; a long transcript opens at its last 4 MB
  - and after a reload of the mod the message he was reading is on screen again, read in from above when it must be
  - and a resize while following (the tray or a panel opening) keeps the newest message in view
  - and while it finds the thread it says «Opening the thread…», then «Reading the thread…»; a transcript it cannot read shows why
  - decision: herdr's lazy list with each row's height measured out of sight (after shepherdr's chat): the zoo chat drew all 60 rows every frame; a list row may hold no handler (a link handler inside one blanks the whole list), so a press acts by the row it landed on
  - decision: a row's height comes from the measurer, never from the row drawn in the list: drawing far rows as empty boxes once looped a long message between 12 px and 1285 px and nearly froze herdr (15:26 probe)
  - not checked: a fling by his hand
- ✅ older history loads as he scrolls up (FRM-638 slice 6b)
  - given a thread longer than its first 4 MiB
  - when he scrolls to within a screen of the top, then the next older page draws above, and the row he reads stays at its spot on screen, no jump, no blank frame (dima, 19:19: pages loaded back to the boot prompt, his line held)
  - and scrolling on loads page after page, one read at a time however fast he scrolls, until the thread's start
  - and once the first line is read a quiet «Start of thread» row sits at the top and no more is asked; a thread shorter than one page shows it at once
  - and a page still read when he switches threads is dropped, never drawn into the other thread
  - decision: read on his ask, never all on open: the read of every slice, not the parse or the draw, took the time (2.1 s of 2.3 s, clio's 56 MB thread)
- ⬜ his messages sit in bubbles on the right, Claude's on the left (FRM-562)
  - then his words sit in an accent-tinted bubble on the right, Claude's in a quiet bubble on the left
  - decision: their bubbles, after shepherdr's chat (dima, 21:13)
  - missing in the new chat: «Your messages» Box, Tint and Bar; the row left the look popover until the chat draws them (dima's o5, 2026-11-18)
- ⬜ **bold** and *italic* in replies draw bold and italic
  - given the chat's font is Sans
  - then a reply's markdown bold reads bold; seen only in the old chat (shot 1928), not yet in the new one
  - decision: Sans is the system font: herdr's own UI font, Geist, ships one face and drew bold flat
- 🐞 a triple click selects a reply's whole paragraph
  - given a reply's paragraph holds inline code and wraps
  - when he triple clicks a word in it
  - then the whole paragraph is selected; today only the clicked row is, since gpui-kit lays such a paragraph out a row at a time
  - decision: inline code keeps its chips, and the fix waits on gpui-kit (his tick, 18:35): [gpui-kit#3933](https://github.com/longbridge/gpui-kit/issues/3933)
- 🔎 the tool-call fold shows each call (FRM-638 slice 6, PK-432)
  - given a reply turn ran tool calls in a row
  - then one row reads «▸ 🛠️ N tool calls: Read 2, Bash 1», folded
  - when he clicks it, then one row a call follows, its name and what it did (a path, a command, a pattern)
  - and a click on one call opens it alone to its input, a second click closes it; every fold opens, whatever its count
- ⬜ a long reply of an earlier turn folds behind «Show more» (FRM-638 slice 7, FRM-607)
  - given «show more» on in the chat's settings window, then a reply past ~40 lines in an earlier turn shows its first ~24 and «▾ Show more · N more lines»; a click on it opens it whole where it is
  - and the turn he reads now never folds, nor a search hit; off, every reply reads whole, and on again the same reply folds at once
  - and every reply of an earlier turn still shows; only the tools between them fold
  - decision: the fold waits for his next message, so a reply never collapses while he reads it (review, 00:54)
  - decision: no «Show less» yet: a press inside a row blanks herdr's list (herdr-app#894), so the reply's own click opens it, and a second click would fold it under a text selection
- ⬜ lines he never typed fold out of his way (FRM-562:W17)
  - given a thread's transcript holds a plugin's message (an orbit tick), a task notice, a synthetic «No response requested.», a command's output or the compact boundary
  - then each draws as one dim line that opens to its whole text on a click, and «System lines: Folded / Hidden / Shown» picks the look, Folded by default
  - and a prompt a plugin sends in his place, or a command it runs for him, draws no bubble of his (dima, 18:28)
  - and a message he pasted reads as his own words, the wrapper Claude Code puts around a paste gone; a tag he typed, or one inside what he pasted, stays (FRM-628)
  - decision: told apart by the entry (its `origin.kind`, a `<synthetic>` model, a `compact_boundary` row), never by a tag found inside his text
  - missing in the new chat: the dim fold and its «System lines» pick; the row left the look popover until the chat draws them (dima's o5, 2026-11-18)
- ⬜ a message between threads reads as who sent it (FRM-562)
  - given another thread sends this one a message
  - then it reads «↪ who: words», the sender's name whole (🐦‍⬛ crow, never «🐦 ⬛»)
  - decision: read from Claude Code's own record of the sender (`origin.kind: peer`), never from the message's text
  - missing in the new chat: the one tinted folding line with a click to open, which the zoo chat drew
- ✅ a message tells when it was sent and when Claude read it
  - given a message in the chat
  - then a small dim line under it holds one state and its own time, on his clock: his own message reads «sent 14:45» while Claude Code holds it, «read 14:46» once it took it off its queue; a reply reads its time alone (his shot, 2026-11-18 20:40: «read 20:38»)
  - decision: one state, one time (his 17:16 shot: «only one state — sent or read. sent turns to read once reached an agent»)
  - decision: always shown, not on hover: a row's renderer takes no handlers ([herdr-app#598](https://github.com/herdrdev/herdr-app/issues/598))
- ⬜ a code block copies its command
  - makes: the fence's exact text on the clipboard, no trailing newline
  - given a reply holds a closed fence
  - when dima clicks copy at the code block's top right
  - then a paste gives the command; a fence under a 📋 ribbon is a copy block too
  - decision: the prompt card that filled his quill is gone; a copy block carries anything he moves elsewhere (his o147 tick, 22:22)
- ⬜ a right-click on a message copies it (FRM-638 slice 7)
  - when he right-clicks a message, then a menu opens at the pointer with «Copy message»; a row with no message shows it dim; a click beside it or a scroll closes it
  - when he picks it, then the message as written is on the clipboard and «Message copied» shows under the quill
- 🧭 the right-click copies only the words he selected, the whole message when none (dima, 20:35; waits on herdr-app#1110: a mod cannot read a TextView's selection)
- 🧭 Reply quotes only the words he selected, never a whole message (dima, 20:35; waits on herdr-app#1110)
  - decision: Reply left the menu (dima, 20:35: «whole message quoting isn't useful»)

## pictures and files

- ⬜ a pasted image goes the way a dropped one does, by its path (FRM-613)
  - makes: the clipboard's image as `~/.config/herdr-app/data/x-herdr-chat/shots/shot-<ms>.png`
  - and that file is his shot: the chat never deletes it, sent or taken out of the box; only a scaled copy the chat made of a dropped picture is removed
  - decision: no cleanup at load. the one that removed every unclaimed shot older than an hour took five of his shots on 2026-11-16 (clio, his word relayed 20:53: a shot he took is his file, kept until his word)
  - given dima pastes an image with cmd+v
  - then its preview waits over the quill and nothing is typed into Claude Code's own prompt
  - and its × takes it at once, mid-turn too, and the next send carries no image
  - and a send puts its path after his text, and Claude reads it
  - and files copied in Finder paste as their paths, the way a drop does, never as the file's icon; a text paste stays text
  - and a picture waiting over the quill is still there after the chat reloads
  - and a click on a picture's square, over the quill, under his message or in a reply's file row, opens the viewer over the chat on the whole picture: zoom out, its level (a click fits), zoom in, copy, open, Show in Finder, ← → with «n / N» among its siblings, ✕; keys ← → + − 0 ⌘C Esc (FRM-638 slice 5, W33/W35)
  - and the viewer's open, or a ⌘-click on any picture square, starts CleanShot X annotate on the file, or Preview, as «open pictures in» says in the chat's settings window (FRM-587 W1, dima 16:59)
  - and every square is sharp and fills its frame: a 288 px cut of the picture's middle (dima 17:00, «too blurry»)
  - and a message he sent draws its pictures under his words as squares, and its other files as «📎 name» chips, never as their paths or «[Image #N]» tokens; a reload brings them back (FRM-638 slice 5, his 16:35 shot)
  - decision: an inline picture is written once as `~/.config/herdr-app/data/x-herdr-chat/sent/<row>-<n>.<ext>` from the transcript's bytes, a joined one by path gets a scaled copy; no «🖼 N images» caption, the squares say it
  - decision: the clipboard is read, never written (FRM-612)
  - decision: the preview row holds the previews alone, no caption and no Remove: each × takes its own (FRM-609, his 16:40 shot: «delete description, i know what it does»)
- ⬜ files attach to the next message
  - when dima presses + at the left of the lower card and picks files, or drops files on the quill
  - then each shows as a «📎 name» chip above the quill, its path on hover, × takes it off; a picture shows in the preview row instead
  - and a send puts each path on its own line after the text, spaces escaped the way a terminal drop types them
  - decision: a drop looks like a paste, one preview row (dima, 14:09: «dnd does not shows preview»)
- ⬜ a reply's files open in one click from rows under it (FRM-587)
  - given a reply names a file by a bare path, a `~` path, a quoted or backslash-escaped path, a `file://` link or a markdown link to one
  - then each file gets one row under the reply, «🖼️ <name>» for a picture and «📂 <name>» for any other file, its whole path on hover, and a click opens it in its app (a png in Preview, a folder in Finder)
  - and a path inside a fenced block gets no row, a sentence's period or comma is not part of the path, and the same file twice is one row
  - and a reply's pictures draw together as squares under it, the way his own do, and a click opens them in the viewer (FRM-638 slice 5, dima 16:59)
  - decision: each file is its own row in the list, opened through the list's item click: a handler inside a row blanked the whole list; a link click inside the text waits on [herdr-app#894](https://github.com/herdrdev/herdr-app/issues/894)

## the quill and send

- ✅ the quill: he types, sends and joins a turn from it (FRM-638 slice 2, FRM-564)
  - given the chat open on a thread, then the quill, a text box, sits under the list in its column and grows with his lines up to eight
  - when he types, then his draft is kept for that thread: it is back after a reload of the chat and after a switch to another thread and back, the caret at its end (his look, 22:42)
  - when he presses Enter or clicks the send button, then his words are marked to join the thread's turn and stay in the quill, the caret where it was, the button reading 🍕; a second press takes the mark off; once a turn took them they leave the quill and the button reads 😋 for a moment, then 🛎️ again
  - and each thread keeps its own mark, settled from its thread's state whether that thread is open or not
  - when he holds the send button or Enter, then after a 100 ms pause a disc fills the button over 1 s and the words go now: a turn starts; a release after the disc shows sends nothing; the chat's settings window sets both timings
  - when he presses cmd+Enter in the focused quill, then the words go now, no disc (dima, 20:41: «cmd+enter — sends immediately»)
  - and a slash command, or a thread that takes no joins, is sent that way on a plain press, and a line over the quill says why
  - when a send is refused, or the thread does not run in herdr, then his words are back in the quill and a line over it says so
  - and a message waiting in Claude Code's queue is his last row, an outline of his bubble with dim words, reading «sent HH:MM» under it, until the turn takes it; words that joined a turn are drawn as his messages
  - and a picture waiting over the quill joins as its path and stays, as the words do, until a turn takes it
  - and with the quill empty the button keeps its face: a click, Enter or a hold there does nothing, no disc (dima, 20:30)
  - Shift+Enter breaks the line
  - and one press of Enter acts once: a held Enter, or one press herdr reports twice, marks once (FRM-628)
  - 🧭 and Enter never scrolls the quill: with the caret past the quill's view, Enter marks and the view stays where he left it (dima, 13:14: «enter only does 🍕 and does not scroll quill»)
  - and while a model, effort or permission pick types into the thread, a push or a send waits: a line over the quill says «A switch is typing into this thread: send again in a moment» (FRM-628 step 93)
  - and his words, their 🍕 mark and his draft have one owner (`quill.js`) (FRM-628 step 88, his ✓ 12:39)
  - decision: a let-go after the disc starts sends nothing, a started hold he aborts being a changed mind (his o127 tick, 21:23)
  - decision: no Queued strip and no «Send now» over the quill (dima, 19:37: «queued messages go to a Queued section I don't want»)
- ⬜ joins a thread never took come back to the quill when the thread ends
  - given his words marked to join a thread's turn
  - when the thread ends before any turn took them
  - then they are back in the quill, in the order he sent them
  - missing in the new chat: `joins.js` `backTexts` has no caller, so the hand-back is not wired (FRM-638 slice 12c round 1)
- 🧭 a queued message comes back to the quill with its × (FRM-563)
  - given a thread mid-turn holds his queued messages
  - when dima clicks × on one before it joins
  - then the thread never receives it and its text is back in his quill, before anything he had typed there
  - and the others queued with it are sent again in their order
  - decision: FRM-563 builds the undo on his waiting row, after his 01:39 «looks ugly, and half baked»
  - decision: Claude Code's vim normal mode: the chat presses `i` before ↑ (probed 2026-11-12)
- ✅ the quill is a stacked card with send in its corner
  - then the text card rests on a narrower card holding + and the band's buttons; a round 🛎️ send sits in the text card's bottom right, the model and effort picker just left of it (shots 2026-11-18, the quill crops)
  - and the quill shows no placeholder
- 🔎 the / menu lists commands and every skill (FRM-638 slice 6, FRM-593)
  - given the quill holds «/» at its start, or after a space or a line break, and part of a name
  - then a list over the quill shows Claude Code's commands, the thread's skills and its plugins' skills, filtered as he types, a match on the part after the colon too
  - and ↑ ↓ move the pick, Enter or Tab fills «/name » with the caret after it, Esc closes it for this word, a click on a row fills it too
- ⬜ a slash command he sends is his message (FRM-638 slice 6)
  - given he sends «/name args» from the quill
  - then it shows as his bubble, as he typed it, waiting while the thread works and in history once it ran; no «Sent:» note (dima, 18:00, 18:01)
- ⬜ inline code in the quill turns into a chip
  - given dima types «use `ls` here»
  - then `ls` draws as one monospace chip the caret skips and one delete removes, and the sent message reads «use `ls` here»
  - missing in the new chat: not built yet
- ⬜ Claude Code's suggestion shows as ghost text
  - given a thread done with its turn, Claude Code's own box holding its dim suggestion, his quill empty
  - then a dim «Tab <suggestion>» line sits above the quill; Tab or a click fills his quill with it
  - missing in the new chat: not built yet

## model, effort and permissions

- ⬜ ⌘⇧E picks the effort, the picker switches model and effort
  - given the Chat view shows a thread
  - when dima presses ⌘⇧E, or clicks «Opus 5.5 · Medium ⌄» left of send
  - then the picker opens: the «Model» list over the «Effort» slider, one thumb on five stops, Low to Max, resting on the thread's live level
  - and ⌘⇧E again, Enter or a click on a stop applies; ← → slide the thumb; Esc closes with nothing changed
  - and a pick mid-turn applies for this session at once and reads in the accent until a reply runs at it, then flashes solid for 2 s (FRM-588:W7)
  - and a thread asking him something gets no picker, a note says to answer first
  - decision: a popover, not a cycle: one press to look, arrows to pick, the key again to apply (dima's sketch, 2026-11-13 14:01)
- ⬜ a model switch mid-conversation asks first
  - when dima picks another model in a thread whose chat holds messages
  - then a card above the quill says the cache is lost, with «Switch to <model>» and «Keep the cache»; a new thread switches at once
- ⬜ Claude asking for a permission, answered in the chat (FRM-638 slice 7)
  - given the thread blocked on a permission prompt, then a «Claude is asking» panel over the band shows its screen with 1 2 3 4, Enter, Esc and Open terminal
  - decision: no question card: AskUserQuestion is denied in his settings.json, so none ever shows (the probe, 20:28)

## the band and the status bar

- ✅ a thread's status sits in the quill's bottom bar (FRM-610)
  - given a thread working, then between + and the band's buttons a spinner, what it does, its turn clock in whole minutes («<1 min», «4 min») and Stop
  - given a thread idle, then the bar reads «○ Idle» (shots 2026-11-18, the quill crops)
  - decision: whole minutes, never seconds: each redraw drops a text selection in progress
- ⬜ the meters sit right above the quill (FRM-565)
  - then 🧠 context and 🫙 week bars sit over the quill, from the deck's shared `x-herdr-deck.threads`; facts older than 2 min 15 s draw dimmed
  - and each bar turns amber at his level, set in the chat's settings window (60 % and 80 % by default)
- ⬜ the band's buttons (FRM-565, FRM-568, FRM-625)
  - makes: one line `{at, button, on, sid?}` per press in `~/.claude/shelf/band-presses/band.jsonl`
  - then 🐦‍🔥 🍃 🔥 ⏰ 💨 🔓 🎛️ 🚦 sit on the lower card, emoji only, each word leading its tooltip; filled when on, 🔓 red when on
  - and 🐦‍🔥 or 🔥 is taken by that thread alone; ⏰ and 💨 set every thread; the button draws the state the stash wrote back, never its last press
  - and 🍃 flips the thread's `second-wind-auto` through x-mod-stash's own door, and is gone with «auto second wind» off
  - and 🚦 shows and hides the deck by herdr's `layout.toggle`

## the header row

- ✅ the thread's top row (x-herdr-chat-header, FRM-638:W134–W137)
  - given the Chat view or a Terminal pane, then one row reads the thread's name and folder on the left, then + (new tab), Files, Changes, search, ⚙ and the Chat | Terminal switch (shot `~/.local/state/looks/FRM-638/2110-chat-header.png`)
  - and the ⚙ opens the chat look popover; search opens find, and a press anywhere outside an open find closes it
  - and on a Terminal pane, hover adds split right, split down, zoom and close for that pane (his o2 tick)
  - and a blocked thread shows «Needs you»; a working one shows no spinner (dima, 20:56: «i already have enough spinners»)
  - and a chat with no thread yet keeps + Files Changes and the way to Terminal
  - decision: built new, never copied from zoo's header (dima, 20:45); forking left out (dima: «forking … out of scope»)

## find

- 🔎 find in the chat (FRM-638 slice 6)
  - given the chat shows a thread
  - when he presses ⌘F anywhere in the window, or the header's search, then a find bar floats at the chat's top right with the keyboard in it, and no message moves (dima, 17:58, 18:39)
  - and ⌘F over an open settings window, dialog or popup does nothing (dima, 18:28)
  - and his query settles 150 ms, then «n / N» counts each match, any case, and the newest hit's row scrolls to the view's top
  - and Enter or ↓ steps to the next older match, ⇧Enter or ↑ to the newer, wrapping
  - and Esc, ✕ or a press anywhere outside the bar closes it and gives the keyboard back to the quill; a thread switch closes it (dima, 18:11, 18:18, 21:04)
  - and an open find re-counts when an older page lands, and its «n / N» says on hover that it counts the history loaded so far
  - decision: it searches the rows loaded so far, never pages further up
- ✅ the stepped reply reads as plain words, its markdown marks dropped (FRM-638:W131, dima's o14)
  - given find steps onto a reply holding bold, code, a fence, a heading or a link
  - then that reply shows its words with no `**`, backticks, fence lines, `#` or link addresses, its matches marked
  - decision: plain words, not rendered marks: rendered bold with word marks waits on herdr-app TextView highlight ranges
- ⬜ wanted: find marks words inside the rendered reply, no flicker, its markdown kept, once [herdr-app#1231](https://github.com/herdrdev/herdr-app/issues/1231) ships (FRM-638:W131: plain words are accepted, not wanted)

## settings

- ✅ the chat look popover (x-herdr-chat-settings, FRM-641)
  - makes: the chat look in herdr's shared store, `chat.look`; «Text (all of herdr)» also writes `colors.foreground` in herdr's `settings.json`
  - given the header's ⚙ pressed, then a popover opens over the chat: a «Chat» heading with Reset, then text size, font, width, tool calls, «Text (all of herdr)» and spacing
  - when he changes a row, then the chat redraws in it at once: Narrow keeps rows and the quill in an 820 px column; tool calls hidden leave the list; the message he was reading stays on the same line
  - when he picks a colour for «Text (all of herdr)», then herdr's whole text takes it; Reset puts back the colour herdr had before his first pick
  - decision: only the rows the chat acts on show (dima's o5, 2026-11-18); accent, his messages, background, system lines and earlier replies come back with their slices
  - decision: the popover is its own mod, its rows as data (`rows.js`) and one typed reader of the store (`look.js`), copied into the chat and held equal by a test
- ⬜ the chat's settings window (FRM-638 slice 7, W42, FRM-566)
  - makes: `~/.claude/shelf/herdr-settings/settings.json`, `{v, rows}`
  - when he presses 🎛️ on the band
  - then the settings window opens in herdr's middle, shaped like shepherdr's: a page list on the left (chat, claude Code mods, keys), each row a title, one dim line and its control
  - and a change lands in the file at once and the chat applies it; a value off its row's range reads as the default; a key no row reads is kept through every write
  - and Esc, ✕ or a click beside the card closes it
  - decision: the window lives in the chat: a herdr mod cannot import a sibling mod's file (clio, 19:28)
- ⬜ a «🐦‍🔥 second wind» group on the claude Code mods page (FRM-625)
  - makes: the rows `stash.second-wind`, `stash.second-wind-auto`, `stash.wind.notice`, `stash.wind.must` and the five note rows `stash.wind.text.notice`, `.at`, `.at.coordinator`, `.propose`, `.press`, which x-mod-stash reads
  - given the group, then it holds the two switches, «heads-up at» and «second wind at» as steppers, and five note boxes titled by when a thread reads them, with the live number of its line
  - when he sets the heads-up at or above the wind line, then the row says it was not saved
  - when he edits a note and presses Save, then the text lands in its row; «Reset to default» empties it; a note that lost `second-wind` or `handoff` gets a red line and still saves
  - decision: a note saves on its button, never per key: a half-typed note must not reach a thread
- ⬜ a «🪐 orbit» group of three note boxes on the claude Code mods page (FRM-640)
  - makes: the rows `stash.orbit.text.tick`, `stash.orbit.text.plan-stale`, `stash.orbit.text.lane-stale`, which x-mod-stash reads at each nudge
  - given a row empty, then its box shows the stash's built-in line; Save lands an edit, «Reset to default» empties it
  - 📌 the built-in line is a copy kept in `settings-model.js`; an empty row always means the mod's text
- ⬜ a «lane idle alarm after» row on the claude Code mods page (FRM-605 rider)
  - makes: `stash.park.after` in `settings.json`, minutes, 10 by default, 5 to 60
- ⬜ Apple's Metal HUD from the settings window
  - when he turns «metal hud» on, then herdr's bundle default `MetalForceHudEnabled` turns on and macOS draws its frame-rate meter over herdr; off turns it off
  - decision: herdr's own gpui-fps meter is refused in his window, Apple's HUD is the meter (dima, o1)

## keys

- ✅ x-herdr's keys (FRM-577)
  - makes: our entries in herdr's `keys.json` `global`, told apart by an `x-herdr-*` action; the file before each change kept in `data/x-herdr-chat/keys-before/`
  - given herdr focused, when dima presses ⌘K, then the Chat view comes forward and the caret sits in the quill
  - given herdr focused, when he presses ⌘E, then the deck shows or hides
  - given a key of ours that herdr already binds, then the keys page marks ours refused and herdr's key keeps working
  - and the settings window's keys page lists ours, then herdr's own, each rebindable: a click on a key's cap takes the next chord, Esc gives up; cmd-enter is listed, never written into his keys.json
  - decision: our keys go to x-herdr-status, always placed: herdr calls a command of a mod it does not draw «unknown»

## the deck's steers (x-herdr-deck)

- ⬜ a steer being typed survives a deck reload
  - given dima has typed into an ask's steer field
  - when x-herdr-deck reloads
  - then the field shows his text again
- ⬜ a sent steer stays in sight until the thread takes it
  - given dima typed a steer on an ask
  - when he presses 🛎️ tick or 🔁 replay
  - then the steer stays under the ask as «↳ his text», selectable, and leaves once the thread's turn takes the press
  - decision: his word, 22:54: «when i tick my steer text is hidden. do not hide it. instead, hide it when it slipstreamed»
