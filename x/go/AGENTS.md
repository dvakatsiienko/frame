# AGENTS.md: x/go

Arm c of [FRM-284](https://linear.app/x-com/issue/FRM-284): the same `x` in go + charm (bubbletea, bubbles, lipgloss, huh,
glamour, log, fang). A comparison build; what lands is decided after the verdict. The numbers and
the hard parts: `../compare/c.md`.

## build, test, gate

- `pnpm x-go:build` → `bin/x` (gitignored). It pins `srcDir` to this dir: the binary reads
  `store.ts` and the frame tree from there, so a moved or `go install`ed copy without the pin
  cannot reach the handoff store.
- `pnpm x-go:test` — the gate. None of it runs in the frame hooks (biome, tsc, vitest), so run it
  before every commit here. `staticcheck` through `go run honnef.co/go/tools/cmd/staticcheck@latest ./...`.

## the contract is shared, never copied by hand

- `registry.json` is a byte copy of `../fixtures/registry.json`, which the TS arm generates;
  `go:embed` cannot reach outside the module, and a test fails on drift. a verb's run lives in
  `impls` (`main.go`); a verb in one and not the other fails a test.
- the handoff store's rules live in `script/lib/handoff-store.ts`; go reaches them through
  `store.ts` (node, ~60 ms), never a go port of the filename grammar.
- every `Fail.Log` line goes to stderr in agent mode — the envelope says «the output is above».

## bubbletea v2 traps

- the inline renderer erases its last frame on exit: a run step's still `✓` line is printed after
  its program quits, never left as the final view (`run.go`).
- a view that shrinks to nothing leaves its upper lines: a fixed-height huh form (confirm,
  picker) is measured before it runs and wiped after (`runForm`); a form whose height moves
  (inputs, validation errors) takes the alt screen (`runFullScreen`).
- `go-runewidth` below v0.0.30 spends ~13 ms at init on two 1.1 MB tables; keep it ≥ v0.0.30.
