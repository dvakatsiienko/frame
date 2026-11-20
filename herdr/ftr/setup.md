# herdr — the setup — x-herdr

wish: PK-363 · legend and the other areas: [FTR.md](../FTR.md)

- 🧭 the setup is `x-herdr`, and «zoo» appears nowhere he looks
  - given the takeover of zoo's parts is done
  - then the layout is `layouts/itrout.json` (iTrout, FRM-633), and a grep for «zoo» in his layout, the mod names, the shared keys and every label he sees prints nothing
  - decision: the name is his pick, «it is plain but clean» (17:17); each mod keeps its own name (x-herdr-deck, x-herdr-chat, x-herdr-agents)
  - decision: the right column is `x-herdr-deck` (his tick, 17:46), renamed on every layer: the herdr mod, its folder, data dir and press path, the layout, the manifest and the docs; the cc board pane is `x-cc-deck`. `fleet-board` stays only in dated history, the stash's `OLD_BOARD` that closes a pane opened under the old id, and a trigger word in `x:herdr-customize`
  - decision: the layout rename lands last, as its own ⚠️ ask, after a throwaway herdr home shows what a rename restarts (W416)
- ⬜ Tab walks one loop across our mods, each joining by itself
  - given the quill and orbit's steer boxes in his window
  - when dima presses Tab in the quill, then in each steer box
  - then focus walks quill → each steer box → quill, shift-Tab back, the mods in the layout's order, never one of herdr's own hidden stops
  - and a mod moved out of the layout, or renamed, drops out of the loop with no error
  - and a keys reload (`keys-change.ts`) leaves the keyboard in the stop that held it and a half-typed steer as it was; every hotkey a mod binds has its handler and is reloaded
  - decision: a mod joins by its own Tab member, no list of mods to edit (FRM-673:W2, W3: antenna threads join next)
