# workarounds — what dima wanted, what the api gave, what to undo

read on demand when cc's mods api moves; nothing points here from a resident file. each entry: the want, the issue,
the workaround in place, the undo. checked against the changelog through 2.1.314 (refresh-cc-mods run #5, 2026-10-30): «orbit's description» is undone; 2.1.301's `Input rows` is terminal-only, so «orbit's note» stands on the desktop until probed; «an argv prompt's enqueue row» is undone (2.1.312 writes it with no text).

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

## hover cards in the board

- want: a board row's count names itself on hover, «1 open ask for you», as the band's chips do (dima, 2026-10-10)
- issue: no upstream issue — a hover card in a `Pane` is an absolute box that wraps in a narrow row and draws over
  its neighbours (two rounds, FRM-306); the recipe holds on the one-row band only
- workaround: none; the band's `🪐 n` chip carries the card
- undo when fixed: give the row's `🪐 n` the band's hover card

## mods on mobile and in remote control

- want: the band and the board where dima is — the phone, a `--remote-control` view (dima, 2026-10-10)
- issue: [claude-code#99217](https://github.com/anthropics/claude-code/issues/99217) — mods draw only on the host
  surface; a remote-control view and the phone draw nothing
- workaround: `/mobile-mode` swaps the orbit reminder for the asks fence, so the asks reach him in the reply
- undo when fixed: retire the asks fence and the mobile flag; orbit alone again

## no flicker when the board redraws

- want: the breathing bars' svg in the band stays still while the board is open (dima, 2026-10-09)
- issue: [claude-code#100797](https://github.com/anthropics/claude-code/issues/100797) — on the desktop a pane
  redraw rebuilds every svg on the screen, so the bars' embers restart about every 30 s while the board is open
- workaround: none; the board redraws only on its poll and on a press
- undo when fixed: nothing to undo; drop the decision line in `x-mod-stash/FTR.md` that names the blink

## the board in the desktop's empty space

- want: the board uses the free bottom half of the left sidebar and the chat column's side margins (dima, 2026-10-13, three shots)
- issue: [claude-code#101759](https://github.com/anthropics/claude-code/issues/101759) — a mod draws only in `AbovePrompt`, a `Pane` and the engine's rows (2.1.296); related [#101525](https://github.com/anthropics/claude-code/issues/101525), several panes at once
- workaround: none drawn; the board stays one `Pane` with folds, and dima refines its layout himself (o155: no split for now)
- undo when a sidebar or margin site ships: move the asks list there first

## a sync clock read

- want: every clock read in a mod goes through `$.clock`, so tests control time (the date-bomb class, mods todo 25)
- issue: none filed — `$.clock.now()` is async only, so a sync path cannot use it
- workaround: a sync read carries `// clock-ok: <why>` on the line above, and `mods:test` lets it pass
- undo when fixed: swap each `clock-ok` read for the sync api, drop the exemption in `test.ts` `clockReads`
