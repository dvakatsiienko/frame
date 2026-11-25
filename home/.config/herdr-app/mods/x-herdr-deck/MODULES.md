# x-herdr-deck — which module owns what

read this before a change: find the one module that owns the state you touch, and change it there. a view module is a factory that owns its state; `orbit-view.js` and `phases-view.js` take the rest as getters and named setters in one `deps` object, each read at use; no module imports `main.js`, types included, and the shared typedefs live in `deck-types.js`.

## main.js — the view herdr loads

- `main.js` — the class herdr loads: reads and watches the shelf (`init`, `reload`, `read`), holds what two views share (the rows, the steer boxes and their keys, the Tab stops, the presses and their writes, 🔥 and ⌘⇧K among them), publishes the threads, builds each view with its deps and composes them in `render`

## views — each owns its state

- `orbit-view.js` — orbit as drawn: an ask's card, its link line, the pinned cards, a section per thread; owns the id labels' widths
- `phases-view.js` — the phases pinned at the deck's bottom, their header with «tick», the press that ticks a plan; owns the lines' widths and the presses being written
- `glide-view.js` — glide, a `view: 'glide'` copy of the deck: each running lane's card, its block sized to them
- `card-files.js` — an orbit card's pictures and file rows

## state, not drawn

- `steer-files.js` — the files each steer box carries

## drawing parts, no state

- `steer-kit.js` — the press button and the steer box every card draws
- `look.js` — the font, the type scale, a meter bar, a one-line row, selectable prose

## rules — pure steps, each with its test

- `orbit.js` — a session's asks, phases and facts, the ticks file's lines, the order of sections and Tab stops
- `press.js` — an ask's press, one record per ask, moved by named events
- `lanes.js`, `glide-size.js` — the lanes shown, glide's block height
- `deck-parts.js`, `deck-commands.js` — what the deck draws, its key commands
- `pictures.js` — the files an ask names

## reads

- `shelf.js` — the shelf's paths, the json reader, the watch of a shelf file, the live sessions as rows
- shared with the other mods: each file in `mod.json`'s `shared` (`tab-loop.js`, `thread-keys.js`, …) lives in `../_shared/` and lands beside the mod
