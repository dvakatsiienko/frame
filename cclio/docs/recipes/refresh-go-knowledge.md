# recipe — refresh-go-knowledge

## the want (dima's, 2026-10-06)

> «i like go with bubbletea the most … cli must look pretty and look prod grade. and use all bubbletea components when applicable — spinners, loaders, huh and other components … it should be agents and user friendly»

two languages at full scale is fine (dima, FRM-284), so go gets the same care as typescript: `x:guide-go` stays current, and the cli's stack moves with its upstreams.

## research vectors (from the v1.1 coder's retro, 2026-10-06 — re-groom each run)

- each go minor's release notes: new stdlib (e.g. `errors.AsType`, `strings.SplitSeq`) and the new `go fix` analyzers
- staticcheck ↔ go version compatibility: which staticcheck release supports the installed go
- the charm v2 changelogs: the bubbletea renderer, bubbles components, huh, lipgloss, glamour, fang — new components the cli should use
- cobra's zsh `__complete` protocol: changes that touch `x completion`
- creack/pty upkeep (the contract test drives tty verbs through it)
- vhs and freeze flag changes (the look shots)
- govulncheck as a gate candidate
- the go-runewidth init cost in bubbles' pin (start-up time)

## analysis vectors (local)

- `x --json` start-up time against the budget in `x/FTR.md`
- the go gate (`pnpm x-go:gate`) green on the current toolchain
- `go list -m -u all` in `x/go`: what is behind

## artifacts (pointed at, never housed)

- `home/.claude/plugin-x/skills/guide-go/` — the go craft
- `x/go/go.mod` — the pins
- `x/PRODUCT.md`, `x/FTR.md` — what the cli promises

## the run

1. re-groom the vectors with dima
2. one research round per `habit-research-lanes` (exa + parallel + an opus source lane)
3. an overhaul proposal: what is new, what it changes in `x:guide-go` and `x/go`, noop included
4. dima's word → a coder lane, or the guide edit

## cadence

event-driven: a go minor ships, a charm major lands, or a go change in `x` hits something the guide does not cover. no timer.

## last run

none yet — written from the v1.1 coder's vectors (FRM-284, 2026-10-06).
