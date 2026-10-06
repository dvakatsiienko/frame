# arm c — go + full charm

Ticket: FRM-284. The same `x` as arms a and b: the 9 v1 verbs plus `completion`, the one registry
(`x/fixtures/registry.json`, embedded), the one envelope, the 35 calls in `x/fixtures/calls.json`.
Source: `x/go/`. Shots: `~/.local/state/looks/FRM-284/c/20261006T125600Z/` (20 tty calls, each a
`.tape`, a `.gif` and a `.png`; a keyed call adds `-keyN.png` per step and `-vhs.png` for the end).

## numbers

Measured on this mac (M-series, macOS 27), median of 30–50 runs, stdin closed, stdout a pipe.

- startup, bare `x` → **10.9 ms** (p90 11.3); `x schema lane push` → **11.6 ms**
  - the TS v0 on bun, same machine and harness: **14.0 ms**
  - before one dependency bump it was **23.7 ms**: `go-runewidth` v0.0.27 (pinned by bubbles
    v2.2.1) fills two 1.1 MB tables at init; v0.0.30 builds them lazily
  - what is left at init is chroma (~5.4 ms), which glamour imports whether it renders code or not
- `handoffs list` → **72 ms**, of which **60 ms** is node starting the store bridge (`store.ts`)
- `lane push` dry run → **83 ms**, almost all of it `git ls-remote` and `rev-list`
- a tty view adds one terminal round trip: lipgloss asks the terminal for its background (OSC 11);
  pipe and `--json` never ask (inference: ~1 ms in iTerm, not measured there)
- binary: **18.9 MB** (`go build`), **14.2 MB** stripped (`-trimpath -ldflags "-s -w"`)
  - the source lane's 3.4 MB was go + lipgloss alone; huh, glamour + chroma, cobra + fang make the rest
- install: one static binary; the build pulls 48 modules (4.6 MB of charm sources in the module cache)
- lines of code: **2 276** go across 8 files + **88** TS for the store bridge, **179** of go test
  - `lane.go` 605 · `main.go` 488 · `handoffs.go` 270 · `boards.go` 249 · `view.go` 227 · `run.go` 178 · `registry.go` 137 · `forms.go` 122

## test + lint story

- `go test ./...` — 4 tests, 16 fixture calls among them, in 9 s
  - every pipe-mode call of `calls.json` (15) and the agent-env tty call runs against the built binary in a fresh `setup.sh` world:
    exit code, one json line, `ok`, `status`, `next`, the named `data` fields
  - the embedded registry is byte-equal to `x/fixtures/registry.json`
  - every registry verb has a go implementation and no implementation lacks a verb
  - every purpose passes the purpose lint (ported from `registry.ts`)
  - red-proved: usage exit 2 → 3 turned 3 calls red; restored → all green
- `go vet` and `staticcheck` (0.8.1, through `go run`: the installed one is built with go 1.25 and
  cannot read 1.27) — clean; `gofmt -l` — clean
- `store.ts` joins the root `tsconfig.json` include (`x/go/*.ts`), proved by a planted type error
- the cost dima named holds: none of this sits in biome / tsc / vitest — `go test` and `staticcheck`
  are a second gate the TS hooks never run (no lefthook job added here)

## matrix — every item built

- bare `x` overview board → `overview-120`, `json-by-agent-env`
- family help → `family-help-lane`, `verb-help`, `schema-tty`
- a run view with step states → `commit-run`, `push-apply`, `merge-main`
- failed and dry-run states → `commit-failed`, `push-dry-run-tty`, `unknown-verb`
- the 80-col fold → `overview-80`, `family-help-lane-80`, `handoffs-peek-80`
- a markdown report view → `handoffs-peek` (glamour, retuned to the T2 tokens)
- a picker → `handoffs-ingest-picker` (huh select)
- a form → `pr-open-form` (missing args become inputs, then a confirm), `push-confirm-form`
- completion → `completion-zsh`; `x __complete handoffs peek ''` lists the live slugs from the store
- json mode → the 16 envelope calls in `go test`

## library features used, and skipped on purpose

- **lipgloss** — styles, `Wrap`, width math, `LightDark` palette from the comp's tokens; the T2
  frame (a titled top and bottom rule) is hand-drawn, because no lipgloss border carries a title
- **bubbletea** — one inline program per run step: a still `●` while it works, then the `✓`/`✗`
  line; no ticking timer, no spinner (the design says nothing repaints)
- **huh** — select (the picker), input with validation (missing args), confirm (approve); a theme
  in the T2 tokens with `●` as the selector
- **glamour** — the CST META and body, the full schema as a highlighted json block
- **cobra + fang** — parsing, the command tree from the registry, completion for zsh / bash / fish
  with dynamic slugs and flag values; fang adds the hidden `man` page, `--version`, signals
- **log** — debug tracing of every spawned command under `X_DEBUG=1`, to stderr
- **bubbles** — only through huh; no bubbles component of our own
- **harmonica** — skipped: it animates springs, and the design forbids motion — «a still `●`,
  nothing repaints» — and so does dima's rule against repainting animation
- **fang's styled help and errors** — bypassed: `--help` and every failure draw the T2 boards, so
  fang's own help never shows

## what was hard

- **bubbletea v2's inline renderer erases its last frame on exit**, and leaves the upper lines of a
  view that shrinks to nothing; the run board printed blank rows until each step's still line
  moved out of the program, and every huh form needs its residue wiped (`runForm`)
- **two dependency surprises**: the runewidth init tax (13 ms), and staticcheck that cannot read
  the toolchain's export data
- **no reuse with the TS lib**: the handoff store's rules are TS, so go reaches them through a node
  bridge — correct (one store, no fork), but 60 ms and a permanent ts/go seam
- **the evidence pipeline**: `freeze --execute` cannot replay cursor-moving output (bubbletea, ink)
  and shot blank; vhs never overwrites a Screenshot and takes its still a frame late; freeze needs
  the font file, not the family name. `x/fixtures/shoot.sh` + `vtreplay` now hold all of it for every arm
- **the frame cannot see emoji widths**: `🔧` and `☕️` count 2 in lipgloss and render 2 in vhs, but
  a variation-selector emoji can still shift a right border by one cell (`handoffs-peek`)

## gaps

- the freeze `.png` of a board with a chip or an emoji has two artifacts the `-vhs.png` does not:
  a chip background one cell too long, and emoji as tofu (Hack has no emoji glyph, freeze no
  fallback font) — the `-vhs.png` is the look; the `.png` stays as the brief's freeze shot

- the registry names no family purpose; go keeps the four family gists in `boards.go`
- `parseRunId` in the store lib reads `**run marker** — run id: **x**` as `— run id:` (both arms show it)
- a terminal round trip for OSC 11 was not measured in iTerm; vhs (xterm.js) answers it
