# zoo inventory — what dima's herdr runs today (herdr-codie, 2026-11-10 16:24, read-only)

sources: `~/.config/herdr-app/installed.json` (what herdr ships and replaces on every start), each mod's `mod.json` (`cloned_from`), `layouts/zoo.json`, a word grep for «zoo» in each mod's js.

## the layout

- `layouts/zoo.json` is the shown layout (`herdr-app status` → `layout: zoo`); not in `installed.json`, so herdr never replaces it
- it places: `claude-chat`, `my-pane`, `my-status`, `my-tabs`, `quick-term` (twice), `zoo-agents`, `fleet-board`, plus herdr's own `changes`, `files`, `spaces`, `workspace-chrome` (twice)
- themes on disk: `atom-one-dark.json`, `win98.json`; the zoo layout names no theme of its own

## mods — zoo's (not shipped, no update path: nothing reinstalls them)

- `claude-chat` — the Chat view; patched by us twice (ps fix 11-09, the draft and Claude's-box fixes 11-10); writes shared `chat.look`, `chat.subs`, `chat.containers`
- `zoo` — agents drawn as creatures, with `packs/`, `sounds/`, `sprites.js`, `tiles/`; reads shared `zoo.packs`, `zoo.sounds`; not placed in the zoo layout
- `zoo-agents` — the agents list in the layout; a clone of herdr's `agents` 0.1.9; 55 «zoo» words
- `zoo-spaces` — a spaces bar for sidebar-less layouts; not placed in the zoo layout
- `agent-board` — agents as cards; not placed in the zoo layout
- `quick-term` — the tray's quick terminal header, placed twice
- `my-pane` — the pane header; a clone of herdr's `pane` 0.1.10
- `my-status` — the status bar; a clone of `workspace-status` 0.1.10; reads `chat.*`
- `my-tabs` — the tab bar; a clone of `tabs` 0.1.9; 29 «zoo» words
- `my-new-menu` — the + menu; a clone of `new-menu` 0.1.9

## mods — ours

- `fleet-board` — in frame, landed by `pnpm herdr-mods:land`; one «zoo» word (the views stack name in 🚦)

## mods — herdr's own (shipped, replaced on every start, never edited)

- `agents`, `changes`, `confirm`, `files`, `help`, `machine-add`, `menu`, `new-menu`, `pane`, `peek`, `picker`, `prompt`, `spaces`, `tabs`, `terminals-bar`, `terminals-pane`, `toast`, `win98`, `workspace-chrome`, `workspace-status`, `worktree`; layouts `main`, `terminals`, `win98`

## what an update overwrites

- a herdr update: only its shipped list above; our clones keep their 0.1.9/0.1.10 base and take no upstream fix (each clone's `cloned_from` names the base to diff against)
- a zoo update: none exists here; zoo's mods sit outside any installer, so nothing overwrites them, and nothing fixes them either

## in use vs idle (what a move must carry)

- in his window: `claude-chat`, `zoo-agents`, `my-pane`, `my-status`, `my-tabs`, `quick-term`, `fleet-board`
- on disk, unused by the zoo layout: `zoo`, `zoo-spaces`, `agent-board`, `my-new-menu` (my-tabs opens it, so it is reached)
