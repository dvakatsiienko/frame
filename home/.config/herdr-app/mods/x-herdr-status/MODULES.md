# x-herdr-status — which module owns what

read this before a change: find the one module that owns the state you touch, and change it there. a view module is a factory, `create<View>(deps)`, that owns its state and takes the rest as getters and named setters in one `deps` object, each read at use; no module imports `main.js`, types included, and the shared typedefs live in `status-types.js`.

## main.js — the view herdr loads

- `main.js` — the class herdr loads, the bar itself or one of its popups by its props: reads the bar's folder and its PR (`readGit`, `lookup`), syncs a repo (`sync`), holds what the bar and a popup share (the PRs, the folders being synced, the last usage read, the new branch's name box), opens a folder, and draws the bar in `render`

## views — each owns its state

- `repo-page.js` — a repo's page, the popup above the git item: its status, PR and Sync, its branches, «New branch…»; owns the statuses it reads, the branch being switched to, git's refusal, whether a name is being typed
- `usage.js` — plan usage: the saved file, each limit's words, the popup; owns the last drawn numbers, so a redraw waits for a change

## rules and reads, no view

- `git.js` — a repo's status, its sync, its branches, its forge and the PR of a branch; keeps each folder's origin, read once
- `commands.js`, `blocks.js` — the x-herdr keys that land here, the block they toggle
- `statusline.cjs` — claude's status line command: it saves the usage file `usage.js` reads; `azure-prs.ps1` — Azure's PRs
