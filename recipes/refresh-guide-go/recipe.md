---
kind: refresh
owner: [codie, coordinator]
artifacts:
  - home/.claude/plugin-x/skills/guide-go/
  - x/go/go.mod
  - x/PRODUCT.md
  - x/FTR.md
script: x-go:gate
was: [refresh-go-knowledge]
---

# refresh-guide-go

keeps `x:guide-go` and the cli's go stack current.

## the want

- charm left this recipe on his word: «refresh-guide-go recipe stays, it now does not have anything related to charmbracelet» (dima, 2026-11-25)

## the run

- go gets the same care as typescript: two languages at full scale is fine, so `x:guide-go` stays current and the cli's stack moves with its upstreams (dima, FRM-284)
- suggest a run when: a go minor ships, a go change in `x` hits something the guide does not cover

1. **groom**: `clio:shape-recipe` step 0, the grill. done: his word on the list. (open)
2. one research round per `x:research` (exa + parallel + an opus source lane). done: every lane returned or marked failed. (script)
3. distill into `x:guide-go` (`clio:shape-recipe` step 2). done: it is touched or named «unchanged». (open)
4. findings print. done: the proposal is printed. (template)
5. dima's word → a codie lane, or the guide edit. done: the lane spawned or the guide edited. (open)
6. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

from the v1.1 coder's retro, 2026-10-06:

- each go minor's release notes: new stdlib (e.g. `errors.AsType`, `strings.SplitSeq`) and the new `go fix` analyzers
- staticcheck ↔ go version compatibility: which staticcheck release supports the installed go
- cobra's zsh `__complete` protocol: changes that touch `x completion`
- creack/pty upkeep (the contract test drives tty verbs through it)
- govulncheck as a gate candidate

### analysis

- go codie and sixth sense retros since the last run (`shelf/retros/*` on `x/go` tickets): every trap the guide did not warn of is a guide line
- `x --json` start-up time against the budget in `x/FTR.md`
- the go gate (`pnpm x-go:gate`) green on the current toolchain
- `go list -m -u all` in `x/go`: what is behind

## artifacts

- `home/.claude/plugin-x/skills/guide-go/` — the go craft
- `x/go/go.mod` — the pins
- `x/PRODUCT.md`, `x/FTR.md` — what the cli promises

## findings

- an overhaul proposal: what is new, what it changes in `x:guide-go` and `x/go`, noop included
