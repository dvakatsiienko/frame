# workarounds — what dima wanted, what the api gave, what to undo

read on demand when cc's mods api moves; nothing points here from a resident file. each entry: the want, the issue,
the workaround in place, the undo.

## orbit's note: a wide, roomy text field

- want: a note field as wide as its row, ideally several lines (dima, 2026-10-10, FRM-381)
- issue: [claude-code#101089](https://github.com/anthropics/claude-code/issues/101089) — on the desktop a mod `Input`
  keeps its own short width (a `width='100%'` box and a stretching column both left it short; it does shrink to a
  smaller box); `Input` is one line, no textarea
- workaround: the note shares a row with the ask's buttons and takes what is left
- undo when fixed: give the note its own full-width row under the ask (multi-line if the api grows one)

## orbit's text: selectable, for F4

- want: select an ask's text in the board and press F4, as anywhere else (dima, 2026-10-10)
- issue: [claude-code#101090](https://github.com/anthropics/claude-code/issues/101090) — text a mod draws can't be
  selected on the desktop; `$.ui.selection()` reads only transcript rows
- workaround: each ask carries 🔊 ⏯ ⏹, which send `read` / `pause` / `stop` to x-speak's control socket
  (`x-mod-stash/hooks/register.tsx`, `speak`; the `read` op in `schedule/jobs/x-speak/control.swift`)
- undo when fixed: drop the three buttons and the `speak` call; keep the socket's `read` op only if another reader
  uses it

## the board's first click

- issue: [claude-code#99395](https://github.com/anthropics/claude-code/issues/99395) — on the desktop, the first
  click on a pane button only moves focus; `$.ui.open({ focus: true })` helps until the next turn
- workaround: none in the code; the FTR's 🐞 line tracks it
- undo when fixed: flip that line
