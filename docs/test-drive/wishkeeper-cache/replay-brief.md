# wishkeeper replay — siesta mode, against a past window

wish: none

this run replays a past siesta: read the window as if it were now, with no knowledge of what came after it.

- **HEAD is the range's head sha**, never today's main: read a file at it with `git -C ~/frame show <head>:<path>`, a diff with `git -C ~/frame diff <base>..<head>`; a worktree path (`clio-wing-2`) is read at that sha the same way, or from the worktree when the file is untracked
- **the transcript is read only up to the window's end**: rows with a `timestamp` after it do not exist for this run (filter with `jq -c 'select(.timestamp <= "<end, UTC>")'`; local = UTC+2)
- crow's notes (`~/.local/state/crow/notes.jsonl`) count only up to the window's end
- tickets and pocket items are read today but judged as they stood at the window's end: a comment or body line dated after it is ignored
- off limits for this run: `~/frame/docs/test-drive/wishkeeper-cache/` (this brief excepted), `~/frame/docs/test-drive/pre-merge-siesta.md`, `~/frame/docs/research/wishkeeper-cadence*`, any wishkeeper subagent transcript, and `replay-windows.md`: they hold the answers
- `siesta-checks.ts` output: none, a replay; open findings of the last card: none
- run no gates that need today's tree; a code claim is judged by reading the code at the head

output as your card says, highs and mediums, lows as one count.
