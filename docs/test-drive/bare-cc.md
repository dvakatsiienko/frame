# test drive — bare cc

window: 2026-10-06 → 2026-10-20 (two weeks). the fold: one line in `rules/fleet-tooling.md` (cc only).

## what

`claude -p --model haiku --safe-mode --strict-mcp-config '<prompt>'` from a temp dir: only cc's built-ins load — no `CLAUDE.md`, rules, plugins, hooks, mods or MCP (probed 2026-10-06; `--bare` needs an API key).

## stress list — one real use each

- an «is it us or cc?» probe (the 10-06 fork gate took a 3-minute researcher)
- a model A/B without our memory (the ccrow arms, FRM-327)
- an upstream bug repro on anthropics/claude-code
- a blind lane (`advise-project-approach`)
- the memory weight: bare `/context` vs a cclio boot (FRM-267)

## the count

`pnpm flow:report` prints bare runs per window ([FRM-328](https://linear.app/x-com/issue/FRM-328)); read at every halt.

## verdict rule

zero uses while the flawlog holds a case that wanted one → the memory line is not enough; the trigger moves into a guard hint.

## log

one line per use: date · session · case · hit · seconds · note
