# AGENTS.md: x/go

`x` in go + charm (bubbletea, bubbles, lipgloss, huh, glamour, log, fang) — the arm dima picked on
the [FRM-284](https://linear.app/x-com/issue/FRM-284) look probe. The probe's numbers and hard parts: `../compare/c.md`.

## build, test, gate

- `pnpm x-go:build` → `bin/x` (gitignored); the shim `../bin/x` runs the same build itself when a
  source file is newer. It pins `srcDir` to this dir: the binary finds the frame tree from there
  (the token wrap for `pr-open`, the knowledge shelf), so a moved copy without the pin cannot.
- the shim also pins `devBuild=1` when `x/go` differs from its merge base with `origin/main` (an edit, an untracked file,
  an unpushed commit), so the trace marks the build a **dev build**; `pnpm x-go:build` never pins it,
  and a stamp lasts until the next rebuild — a push alone does not clear it.
- `pnpm x-go:test` — the gate, run in ci; the frame commit hooks never run it, so run it before
  every commit here. `x:guide-go` holds the go craft (gofmt, vet, staticcheck, table tests).

## the contract

- `registry.json` is the source of every verb (`../AGENTS.md` has the rules); `go:embed` bakes it
  into the binary, so the shim's rebuild picks up an edit to it.
- `../fixtures/calls.json` is the contract: `x_test.go` runs every call, a pipe call checks the
  envelope, a tty call runs on a pty and checks the human view and the exit code.
- `store.go` is the handoff store's one door (ADR-0002); `store_test.go` reads every name in
  `script/lib/handoff-names.json`, so a grammar change edits that file first.
- a verb's `replaces` is checked by `replaces_test.go` through `git grep` of each door's basename;
  `notCallers` there lists the history paths it skips.
- every `Fail.Log` line goes to stderr in agent mode — the envelope says «the output is above».

## bubbletea v2 traps

- the inline renderer erases its last frame on exit: a run step's still `✓` line is printed after
  its program quits, never left as the final view (`run.go`).
- a view that shrinks to nothing leaves its upper lines: a fixed-height huh form (confirm,
  picker) is measured before it runs and wiped after (`runForm`); a form whose height moves
  (inputs, validation errors) takes the alt screen (`runFullScreen`).
- `go-runewidth` below v0.0.30 spends ~13 ms at init on two 1.1 MB tables; keep it ≥ v0.0.30.
