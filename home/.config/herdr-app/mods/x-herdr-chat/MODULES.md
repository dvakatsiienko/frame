# x-herdr-chat — which module owns what

read this before a change: find the one module that owns the state you touch, and change it there. a view module is a factory, `create<View>(deps)`, that owns its state and takes the rest as getters in one `deps` object; no module imports `main.js`, and the shared typedefs live in `chat-types.js`.

## main.js — the view herdr loads

- `main.js` — the class herdr loads: builds each module below with its deps, starts them in `init`, composes them in `render`, and keeps only what no single view owns: his look, the note under the quill, the settings rows, the ⌘K ⌘F ⌘⇧E Esc asks, `clearShown()` on a thread switch

## views — each owns its state and binds its own keys in `start`

- `thread-feed.js` — which thread shows (the focused tab's Claude), its transcript read and watched, its state file, both telling the notes, earlier pages, his place brought back after a reload
- `message-list.js` — the list on screen, his reading place in it (scroll, sizes, width, the column), the measurer, the right-click menu
- `message-body.js` — a nested view for each message and row of pictures near the screen, the one place herdr takes a selection, link or press handler in a list (until herdr-app#942)
- `quill-mini.js` — the box he writes a note in, over the list: which note is open, where it sits, its keys
- `mini-motion.js` — how that box comes and goes: its fade and slide, the shut box drawn as it goes
- `note-links.js` — a note's words drawn as a link that opens it, and every offset moved between the markdown as written and as drawn
- `message-row.js` — each row as drawn (his bubble, a reply and its fold, tool calls, files), the rows shown of the model's, which replies and tool calls he opened
- `quill-view.js` — the quill: the text box, each thread's draft, the files over it, the + picker, the / menu
- `send-path.js` — a send: a note's own, the magic send's marks, the hold, a push, a send that did not go coming back
- `band-view.js` — the band over the quill and the bar under it: meters, 🍃 auto wind, the deck button, Stop
- `pickers.js` — the model, effort and permission pickers under the quill
- `picture-viewer.js` — the full-window picture viewer
- `find-bar.js` — the ⌘F bar
- `blocked-panel.js` — a blocked thread's ask and the keys that answer it
- `settings-window.js` — x-herdr-settings, which the band's 🎛️ and ⌘⇧, open; `settings-page.js` keeps its page through the reload a Keys save starts

## rules — pure steps, each with its test, no herdr

- reading: `reader.js` (new lines of a file), `pages.js` (older pages), `row-model.js` (lines in, rows out), `thread.js`, `shown.js`
- the list: `place.js` (his reading place), `follow.js`, `heights.js`, `fold.js`, `tool-folds.js`, `files.js`, `disk.js` (is a path there, asked of the shell), `path-links.js` (the paths a reply names, links once found on disk), `details.js`, `blocks.js`, `drawn.js` (the markdown each row draws, which find reads too), `relay.js`
- the quill and sending: `quill.js`, `send.js`, `magic.js`, `joins.js`, `queued.js`, `attach.js`, `attachments.js`, `shots.js`, `sent-pictures.js`, `paste.js`, `lists.js` (a paste reads plain, its lists keep their markers), `typed.js`, `slash.js`, `commands.js`, `skills.js`
- notes: `notes.js` (every note, its join row and its record), `note-states.js` (a note's states, what each event makes of it), `join-io.js` (the join files' doors in herdr), `note-marks.js` (where a note's words stand in its message as drawn now), `note-rows.js` (the row a message has for each), `note-text.js` (the one line a thread gets of a note: the quote cut short, the message's id, the note)
- the rest: `band.js`, `blocked.js`, `picker.js`, `effort.js`, `find.js`, `menu.js`, `selection.js` (the words he selected and when, read at a right press and at F6), `trace.js` (a probe's log of his selection and presses, FRM-585, goes once read), `viewer.js`, `look.js`, `hotkeys.js`, `settings-model.js`, `settings-store.js`, `settings-io.js`, `icons.js`, `tint.js`, `contrast.js` (a background he can read on, whatever the theme), `chat-types.js`
- shared with the other mods: each file in `mod.json`'s `shared` (`band-press.js`, `chat-asks.js`, `joined.js`, …) lives in `../_shared/` and lands beside the mod; vitest resolves the same import through `vitest.config.ts`'s `herdr-shared` resolver
