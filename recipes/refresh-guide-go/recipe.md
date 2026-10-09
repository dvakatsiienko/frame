---
kind: refresh
owner: coordinator
cadence: "event-driven: a go minor ships, a charm major lands, or a go change in `x` hits something the guide does not cover. no timer."
artifacts:
  - home/.claude/plugin-x/skills/guide-go/
  - docs/knowledge/charm.md
  - x/go/go.mod
  - x/PRODUCT.md
  - x/FTR.md
script: x-go:gate
was: [refresh-go-knowledge]
---

# refresh-guide-go

keeps `x:guide-go` and the cli's go stack current.

## the want

dima's, 2026-10-06:

> «i like go with bubbletea the most … cli must look pretty and look prod grade. and use all bubbletea components when applicable — spinners, loaders, huh and other components … it should be agents and user friendly»

two languages at full scale is fine (dima, FRM-284), so go gets the same care as typescript: `x:guide-go` stays current, and the cli's stack moves with its upstreams.

> «would it be useful to create a «charmbracelet toolkit» reference for cli coders?» · «where i could peek into all tools installed? e.g. bubbletea, harmonica? … with links to quickly navigate to related gh page?» · «the standard best practices, powerusage recipes, do's don'ts etc» (dima, 2026-10-07)

## the run

1. re-groom the vectors with dima. done: his word on the list. (open)
2. one research round per `habit-research-lanes` (exa + parallel + an opus source lane). done: every lane returned or marked failed. (script)
3. findings print. done: the proposal is printed. (template)
4. dima's word → a coder lane, or the guide edit. done: the lane spawned or the guide edited. (open)
5. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

from the v1.1 coder's retro, 2026-10-06:

- each go minor's release notes: new stdlib (e.g. `errors.AsType`, `strings.SplitSeq`) and the new `go fix` analyzers
- staticcheck ↔ go version compatibility: which staticcheck release supports the installed go
- the charm v2 changelogs: the bubbletea renderer, bubbles components, huh, lipgloss, glamour, fang — new components the cli should use
- the charm toolkit, every lib x uses or plans (bubbletea · bubbles · lipgloss · glamour · huh · log · fang · harmonica · teatest · ntcharts · sequin · vhs · freeze · wish later): standard best practices, power-usage recipes, do's and don'ts, and which `bubbletea/examples` entry shows each widget
- cobra's zsh `__complete` protocol: changes that touch `x completion`
- creack/pty upkeep (the contract test drives tty verbs through it)
- vhs and freeze flag changes (the look shots)
- govulncheck as a gate candidate
- the go-runewidth init cost in bubbles' pin (start-up time)

### analysis

- 2026-10-09 · the 10-07 log line said `x:guide-go` points at `docs/knowledge/charm.md`; a grep of `guide-go/SKILL.md` finds no reference — check at the next run
- `x --json` start-up time against the budget in `x/FTR.md`
- the go gate (`pnpm x-go:gate`) green on the current toolchain
- `go list -m -u all` in `x/go`: what is behind

## artifacts

- `home/.claude/plugin-x/skills/guide-go/` — the go craft
- `docs/knowledge/charm.md` — the stack page: each lib with its gh link and job, which widget for which view, our gotchas; `x:guide-go` points at it, dima reads it with `x knowledge read charm`; a contract test fails when `go.mod` gains a charm module it does not list
- `x/go/go.mod` — the pins
- `x/PRODUCT.md`, `x/FTR.md` — what the cli promises

## findings

- an overhaul proposal: what is new, what it changes in `x:guide-go` and `x/go`, noop included
