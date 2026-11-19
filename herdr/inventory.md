# inventory — what dima's herdr runs today

sources: `~/.config/herdr-app/installed.json` (what herdr ships and replaces on every start), each mod's `mod.json` (`cloned_from`), `layouts/itrout.json`.

## the layout

- `layouts/itrout.json` (iTrout) is the shown layout (`herdr-app status` → `layout: itrout`); not in `installed.json`, so herdr never replaces it. it was egg-basket, renamed at FRM-638's end step; zoo's `x-herdr-layout` left then
- it places: `x-herdr-chat`, `x-herdr-chat-header` (above the chat and on each Terminal pane), `x-herdr-status`, `x-herdr-tab-pills`, `x-herdr-terminal-header`, `x-herdr-agents`, `x-herdr-deck`, plus herdr's own `changes`, `files`
- themes on disk: `atom-one-dark.json`, `win98.json`; the layout names no theme of its own

## mods — ours (in frame, landed by `pnpm herdr-mods:land`)

- `x-herdr-chat` — the Chat view, built new (FRM-638)
- `x-herdr-chat-header` — a thread's top row, above the chat and on each Terminal pane
- `x-herdr-chat-settings` — chat settings, the popover the header's gear opens
- `x-herdr-agents` — the agents list in the sidebar, a clone of herdr's `agents` 0.1.9
- `x-herdr-tabs` — the tab bar, a clone of herdr's `tabs` 0.1.9; its + opens herdr's `new-menu`
- `x-herdr-deck` — the deck, the right column
- `x-herdr-status` — the status bar, a clone of `workspace-status` 0.1.10; reads `chat.*`
- `x-herdr-terminal-header` — the tray's quick terminal header, placed twice; its kept terminals carry the label `x-herdr-terminal`

## mods — herdr's own (shipped, replaced on every start, never edited)

- `agents`, `changes`, `confirm`, `files`, `help`, `machine-add`, `menu`, `new-menu`, `pane`, `peek`, `picker`, `prompt`, `spaces`, `tabs`, `terminals-bar`, `terminals-pane`, `toast`, `win98`, `workspace-chrome`, `workspace-status`, `worktree`; layouts `main`, `terminals`, `win98`

## what an update overwrites

- a herdr update: only its shipped list above; our clones keep their 0.1.9/0.1.10 base and take no upstream fix (each clone's `cloned_from` names the base to diff against)

## set aside

- `~/.config/herdr-app/data/backups/layouts-before-itrout-20261118/`: egg-basket as it was before it became iTrout
- zoo is gone from his system (dima, 2026-11-18: «clean all zoo's crap»): `~/.local/state/herdr-aside/` (the zoo-era mods and layout copies), `x-herdr-layout`, `x-herdr-chatter`, `x-herdr-chatter-header` and their data dirs sit in the macOS Trash; the mods also in git history
