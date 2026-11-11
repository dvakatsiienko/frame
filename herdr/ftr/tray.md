# herdr — tray — quick terminal

wish: PK-363 · legend and the other areas: [FTR.md](../FTR.md)

- ⬜ ctrl-j opens and closes the quick-terminal tray
  - given any view shows
  - when dima presses ctrl-j
  - then the tray with its quick terminal opens, and a second press closes it
  - decision: herdr ships no tray: zoo's `quick-term` is the tray's head row and its whole logic (a kept terminal per space, found again after a restart, local or dev container, the keyboard on open); the terminal in it is herdr's own. it stays and becomes `x-herdr-terminal` (dima, 18:11)
  - decision: the tray stays and is rebranded as ours, after my-tabs (dima, 16:41); bound in `keys.json` `global` by clio on his word, backup `~/.local/state/herdr-mod-backups/keys-1641.json`
  - decision: a `global` ctrl+letter is taken from the terminal (herdr's guide, § Keys), so in a thread's Terminal view cc's ctrl+j new line no longer reaches cc (read from the guide, not probed by a keypress)
