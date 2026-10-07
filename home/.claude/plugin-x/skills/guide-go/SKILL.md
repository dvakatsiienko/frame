---
name: guide-go
description: Load EVERY time you write, edit, or review Go in any repo — a .go file, a go.mod, a go test, a bubbletea or lipgloss view.
---

# Go Guide

`guide-code` carries the values that govern this one; these are the Go refinements. Go here is
`x` (`~/frame/x/go`) and `sline` (`~/frame/home/.claude/sline`). Binding when printing Go.

## The gate — run it, the hooks never do

frame's commit hooks run biome, tsc and vitest; none of them reads Go. Before every commit, in the
module dir:

```bash
gofmt -l .                 # prints nothing, or run gofmt -w on what it names
go vet ./...
staticcheck ./...          # ~/go/bin, built with the module's go — see below
go fix -diff ./...         # the modernizer: SplitSeq, errors.AsType, min/max, range-over-int
go test -count=1 ./...
```

- **staticcheck reads only the go it was built with.** it comes from brew (Brewfile), which rebuilds it per go
  release; `go version -m $(which staticcheck)` names its go, and a module on a newer go needs `brew upgrade staticcheck`
  (go1.25's could not read go1.27, 2026-10-06).
- `go fix ./...` applies what `-diff` shows; its fixes are safe by contract (`go tool fix help`).
- `go doc <pkg>` answers a stdlib question in one call; a charm module's source sits under
  `~/go/pkg/mod/charm.land/<module>@<version>/`; ctx7 carries `/charmbracelet/{bubbletea,lipgloss,huh,glamour,fang}`.

## Module layout

- **one module per tool dir**, `package main` in flat files named by concern (`lane.go`, `store.go`,
  `view.go`); a second binary is `cmd/<name>/`. a sub-package only when a second binary imports it.
- **data a human writes lives as data** — `registry.json` with `//go:embed`, and everything
  derivable (usage lines, global flags, completion) is computed from it, never kept beside it.
  `go:embed` cannot reach outside the module dir.
- a binary that needs its source tree pins it at build: `-ldflags "-X main.srcDir=<dir>"`.

## Errors

- **return errors, never panic on input.** a panic is for a broken invariant in our own code (a
  malformed embedded registry), never for a user's argument.
- **a cli's bad input is exit 2 and one line** naming the fix; x's `*Fail` carries the message and
  the `Next` command, and `IsUsage` picks the exit.
- wrap with `fmt.Errorf("…: %w", err)`; match with `errors.Is`; take a typed error out with
  `errors.AsType[*Fail](err)` (go1.26+), never `errors.As` into a pre-declared var.
- cleanup that can fail beside a main error: `errors.Join(err, cleanup())` — one is never dropped.
- `exec.Command` output: read stdout and stderr apart; a tool's own words are evidence, so they
  reach the caller (x puts them on stderr in agent mode).

## Tests

- **table tests**: a slice of cases, `t.Run(c.name, …)` per case, the name a behaviour; one
  behaviour per test function, the table holds its variants.
- **build the binary once** in `TestMain` and run it as a process for anything a user calls —
  exit codes, stdout, the env, the cwd are the contract, not the funcs.
- `t.TempDir()` for every fixture, `t.Setenv`, `t.Chdir`; `t.Parallel()` only in tests that touch
  neither env nor cwd.
- **a terminal view is tested on a pty** (`github.com/creack/pty`): size it, feed keys after the
  screen settles, assert on the bytes. a real zsh `<Tab>` runs the same way.
- **a test is proven by making it fail**: `red-proof --cmd <file> <anchor> <replacement> -- go test -count=1 -run <Test> ./`.
- the child of a test runs with `CLAUDECODE` and `AI_AGENT` unset, or x answers in json and the
  human-view assertion lies.

## Output

- json for machines through one encoder with `SetEscapeHTML(false)` — the default prints `<msg-file>`
  as `<msg-file>`. key order is not a contract; tests compare parsed json.
- width is `lipgloss.Width`, never `len` — ansi codes and wide runes break a byte count.

## Charm traps (bubbletea v2, lipgloss v2, huh v2)

- **the inline renderer erases its last frame on quit.** a step's still line is printed with
  `fmt.Println` after `program.Run()` returns; the model's last view is empty.
- **a view that shrinks leaves its upper rows.** a fixed-height huh form (confirm, select) is
  measured with `View()` before it runs and wiped after with `\x1b[{h-1}A\x1b[J`; a form whose
  height moves (inputs, validation) takes the alt screen via `WithViewHook`.
- **anything taller than the terminal is a `bubbles/viewport` pager** on the alt screen, only when
  stdin and stdout are both a terminal; q leaves.
- **a wait gets a `bubbles/spinner`** in the family colour, with the elapsed time after 1 s; the
  spinner's view goes empty on done and the still line takes its place.
- `lipgloss.HasDarkBackground` is a terminal round trip — compute the theme in the human view only.
- keep `github.com/mattn/go-runewidth` at v0.0.30 or later: older ones spend ~13 ms of every start
  building two 1.1 MB tables.
- vhs never overwrites a `Screenshot` (shoot into a fresh dir), takes it a frame late (`Sleep 600ms`
  after it), and inherits `CLAUDECODE` (unset it in the hidden init). freeze needs
  `--font.file=…` and `--flag=value` forms; a spaced value hangs it on stdin.

## The worktree guard

- `go -C <dir> …` instead of `cd <dir> && go …`.
- a command whose text holds a module path with `github.com`, or a `{{…}}` template, is refused —
  put it in a script file and run the script.
