# inventory — what dima's herdr runs today

sources: `~/.config/herdr-app/installed.json` (what herdr ships and replaces on every start), each mod's `mod.json` (`cloned_from`), `layouts/x-herdr-layout.json`.

## the layout

- `layouts/x-herdr-layout.json` is the shown layout (`herdr-app status` → `layout: x-herdr-layout`); not in `installed.json`, so herdr never replaces it. it began as a clone of the third-party zoo layout
- it places: `x-herdr-chatter`, `x-herdr-chatter-header`, `x-herdr-status`, `x-herdr-tabs`, `x-herdr-terminal-header` (twice), `x-herdr-agents`, `x-herdr-deck`, plus herdr's own `changes`, `files`, `spaces`, `workspace-chrome` (twice)
- themes on disk: `atom-one-dark.json`, `win98.json`; the layout names no theme of its own

## mods — ours (in frame, landed by `pnpm herdr-mods:land`)

- `x-herdr-chatter` — the Chat view
- `x-herdr-chatter-header` — the pane header in the Terminal view, a clone of herdr's `pane` 0.1.10; its look is `chatter-header.js`, shared with `x-herdr-chatter`
- `x-herdr-agents` — the agents list in the sidebar, a clone of herdr's `agents` 0.1.9
- `x-herdr-tabs` — the tab bar, a clone of herdr's `tabs` 0.1.9; its + opens herdr's `new-menu`
- `x-herdr-deck` — the deck, the right column
- `x-herdr-status` — the status bar, a clone of `workspace-status` 0.1.10; reads `chat.*`
- `x-herdr-terminal-header` — the tray's quick terminal header, placed twice; its kept terminals carry the label `x-herdr-terminal`

## mods — herdr's own (shipped, replaced on every start, never edited)

- `agents`, `changes`, `confirm`, `files`, `help`, `machine-add`, `menu`, `new-menu`, `pane`, `peek`, `picker`, `prompt`, `spaces`, `tabs`, `terminals-bar`, `terminals-pane`, `toast`, `win98`, `workspace-chrome`, `workspace-status`, `worktree`; layouts `main`, `terminals`, `win98`

## what an update overwrites

- a herdr update: only its shipped list above; our clones keep their 0.1.9/0.1.10 base and take no upstream fix (each clone's `cloned_from` names the base to diff against)

## set aside, never deleted

- `~/.local/state/herdr-aside/`: the zoo-era mods (`zoo`, `my-pane`, `quick-term`, `my-status`, `my-new-menu`, `agents-list`, `zoo-agents`, `claude-chat`, `zoo-spaces`, `agent-board`) and each layout file as it was before a rename
