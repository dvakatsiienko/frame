# notes-stack bench — DOT-228

one synthetic suite, run per contender lane, so the numbers compare. results and method live in
`docs/research/notes-stack.md`.

```bash
export BENCH_DIR=/tmp/notes-stack-bench        # scratch, never inside the repo
./seed.sh "$BENCH_DIR/pristine" 300            # 306 notes, 1.5 MB
BENCH_DIR="$BENCH_DIR" ./run.sh fs             # lane: plain filesystem edits
BENCH_DIR="$BENCH_DIR" NOTESMD_CLI=/path/to/notesmd-cli ./run.sh cli   # lane: headless cli
```

`BENCH_DIR` is required — the runner refuses to start without it, so the throwaway vault can never
land in the repo.

`run.sh` resets from `pristine/` before each lane, so lanes are independent. the `cli` lane runs
under an isolated `HOME` so it never writes the real `~/Library/Application Support/obsidian/obsidian.json`.

deps: bash, `python3` (millisecond timestamps only). obsidian does **not** need to be running.
