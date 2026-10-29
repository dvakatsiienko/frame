---
id: PK-198
title: >-
  mod panes: confirm #99395's first-click bug is fixed natively, then clear
  every workaround for it
status: done
assignee: []
created_date: '2026-10-19 12:39'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 120500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120) — it rides that lane's next chunk.
the job (dima, 2026-10-23 13:43: «the mods double-clicking issue is fixed already natively … change the rider … from a fix into investigation, confirmation, and clearing out all workarounds … keep a watch for now. We'll remove the watch once confirmed by a coder»): the coder investigates and confirms the first click lands on the desktop build we run; confirmed → it removes every #99395 workaround in our mods (`plugin-x/mods/workarounds.md` line, any ui.focus re-press or dedupe code), and the watch dies after its confirmation; not confirmed → back to dima with the repro. the old fix plan below stays only as history.
upstream https://github.com/anthropics/claude-code/issues/99395 (desktop: the first click on a plugin pane button only moves focus). beatwiz's workaround (comment 10-19): a dropped click still raises ui.focus with origin person and the Button's key; call that Button's press from the ui.focus hook after ~150 ms if no real press came, drop a duplicate real press within ~500 ms; $.ui.focus right after $.ui.open gives the pane the keyboard. ours: x-mod-stash routes every press through one ui.press handler (hooks/register.tsx ~3508), so the fix is one ui.focus hook + a dedupe, plus tests. size s, not a freebie: a mods change with tests.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 14:14 dima: «continue the watch and fold workarounds for mods lane as another rider». 2 new workarounds on #99395 since 10-18: beatwiz 10-19 (the dropped click still raises ui.focus with origin person + the Button key → the plugin presses that Button itself, wrap els.Button in ui.render to keep each key); skrinjarf 10-20 (Linux, same bug; the desktop renderer builds each mod Button as a <button>, names the mechanism, links #99211 #103030 #101639). read both whole when the mods lane opens; the watch stays.

dima 2026-10-23 12:30: orbit's buttons click on the first press, so the first-click bug may be fixed natively; he observes more. confirmed → this rider changes to: the mods coder removes every #99395 workaround, then the #99395 watch and its workarounds.md line go.

ticket: FRM-426

close: moved — FRM-426 carries this item (its body lists «pocket PK-198») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
