# x-herdr-chat — which module owns what

read this before a change: find the one module that owns the state you touch, and change it there. a view module is a factory, `create<View>(deps)`, that owns its state and takes the rest as getters in one `deps` object; no module imports `main.js`, and the shared typedefs live in `chat-types.js`.

## main.js — the view herdr loads

- `main.js` — the class herdr loads: builds each module below with its deps, starts them in `init`, composes them in `render`, and keeps only what no single view owns: his look, the note under the quill, the settings rows, the ⌘K ⌘F ⌘⇧E Esc asks, `clearShown()` on a thread switch

## views — each owns its state and binds its own keys in `start`

- `thread-feed.js` — which thread shows (the focused tab's Claude), its transcript read and watched, its state file, earlier pages, his place brought back after a reload
- `message-list.js` — the list on screen, his reading place in it (scroll, sizes, width, the column), the measurer, the right-click menu
- `message-row.js` — each row as drawn (his bubble, a reply and its fold, tool calls, files), the rows shown of the model's, which replies and tool calls he opened
- `quill-view.js` — the quill: the text box, each thread's draft, the files over it, the + picker, the / menu
- `send-path.js` — a send: the magic send's marks, the hold, a push, a send that did not go coming back
- `band-view.js` — the band over the quill and the bar under it: meters, 🍃 auto wind, the deck button, Stop
- `pickers.js` — the model, effort and permission pickers under the quill
- `picture-viewer.js` — the full-window picture viewer
- `find-bar.js` — the ⌘F bar
- `blocked-panel.js` — a blocked thread's ask and the keys that answer it
- `settings-window.js` — the settings window the gear opens

## rules — pure steps, each with its test, no herdr

- reading: `reader.js` (new lines of a file), `pages.js` (older pages), `row-model.js` (lines in, rows out), `thread.js`, `shown.js`
- the list: `place.js` (his reading place), `follow.js`, `heights.js`, `fold.js`, `tool-folds.js`, `files.js`, `details.js`, `blocks.js`, `relay.js`
- the quill and sending: `quill.js`, `send.js`, `magic.js`, `joins.js`, `queued.js`, `attach.js`, `attachments.js`, `shots.js`, `sent-pictures.js`, `paste.js`, `lists.js` (a paste reads plain, its lists keep their markers), `typed.js`, `slash.js`, `commands.js`, `skills.js`
- the rest: `band.js`, `blocked.js`, `picker.js`, `effort.js`, `find.js`, `menu.js`, `viewer.js`, `look.js`, `hotkeys.js`, `joined.js`, `settings-model.js`, `settings-store.js`, `settings-io.js`, `icons.js`, `tint.js`, `contrast.js` (a background he can read on, whatever the theme), `chat-types.js`
- shared with the other mods: `chat-asks.js` lives in `../_shared/` and lands beside the mod, listed in `mod.json`'s `shared`
