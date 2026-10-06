# tally — a counter cli

## the want

«i want to count things from the shell, one keystroke per count.»

## the build

- a go binary, state in one json file under `~/.local/state/tally/`
- `tally <name>` adds one, `tally` alone prints every counter

### the store

- writes go through a temp file and a rename

## what tally is not

- not a habit tracker: no streaks, no reminders

## the done test

- given a counter at 3, when `tally coffee` runs, then it prints 4
