# zoo inventory — what dima's herdr runs today (herdr-codie, 2026-11-10 16:24, read-only)

sources: `~/.config/herdr-app/installed.json` (what herdr ships and replaces on every start), each mod's `mod.json` (`cloned_from`), `layouts/zoo.json`, a word grep for «zoo» in each mod's js.

## the layout

- `layouts/zoo.json` is the shown layout (`herdr-app status` → `layout: zoo`); not in `installed.json`, so herdr never replaces it
- it places: `x-herdr-chatter` (was zoo's `claude-chat`, FRM-556), `x-herdr-chatter-header` (was zoo's `my-pane`), `x-herdr-status` (was zoo's `my-status`), `x-herdr-tabs` (was zoo's `my-tabs`), `x-herdr-terminal-header` (twice, was zoo's `quick-term`), `agents-list`, `x-herdr-deck`, plus herdr's own `changes`, `files`, `spaces`, `workspace-chrome` (twice)
- themes on disk: `atom-one-dark.json`, `win98.json`; the zoo layout names no theme of its own

## mods — zoo's (not shipped, no update path: nothing reinstalls them)

- `claude-chat` — the Chat view; patched by us twice (ps fix 11-09, the draft and Claude's-box fixes 11-10); writes shared `chat.look`, `chat.subs`, `chat.containers`
- `zoo` — agents drawn as creatures, with `packs/`, `sounds/`, `sprites.js`, `tiles/`; reads shared `zoo.packs`, `zoo.sounds`; not placed in the zoo layout
- `zoo-agents` — an agents list, a clone of herdr's `agents` 0.1.9; not placed since `agents-list` took its block
- `zoo-spaces` — a spaces bar for sidebar-less layouts; not placed in the zoo layout
- `agent-board` — agents as cards; not placed in the zoo layout

## mods — ours

- `x-herdr-deck` — in frame, landed by `pnpm herdr-mods:land`; one «zoo» word (the views stack name in 🚦)
- `x-herdr-chatter-header` — the pane header in the Terminal view (was zoo's `my-pane`, a clone of herdr's `pane` 0.1.10); its look is `chatter-header.js`, shared with `x-herdr-chatter`
- `x-herdr-terminal-header` — the tray's quick terminal header, placed twice (was zoo's `quick-term`); its kept terminals carry the label `x-herdr-terminal`
- `x-herdr-status` — the status bar (was zoo's `my-status`, a clone of `workspace-status` 0.1.10); reads `chat.*`

## mods — herdr's own (shipped, replaced on every start, never edited)

- `agents`, `changes`, `confirm`, `files`, `help`, `machine-add`, `menu`, `new-menu`, `pane`, `peek`, `picker`, `prompt`, `spaces`, `tabs`, `terminals-bar`, `terminals-pane`, `toast`, `win98`, `workspace-chrome`, `workspace-status`, `worktree`; layouts `main`, `terminals`, `win98`

## what an update overwrites

- a herdr update: only its shipped list above; our clones keep their 0.1.9/0.1.10 base and take no upstream fix (each clone's `cloned_from` names the base to diff against)
- a zoo update: none exists here; zoo's mods sit outside any installer, so nothing overwrites them, and nothing fixes them either

## in use vs idle (what a move must carry)

- in his window: `x-herdr-chatter`, `agents-list`, `x-herdr-chatter-header`, `x-herdr-status`, `x-herdr-tabs`, `x-herdr-terminal-header`, `x-herdr-deck`
- on disk, unused by the zoo layout: `zoo`, `zoo-spaces`, `agent-board`
