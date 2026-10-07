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

- 2026-10-07 · cclio · the `researcher` agent (`omitClaudeMd: true`, opus medium), spawned from a fresh `claude -p --model haiku` parent in `~/frame` · hit: no CLAUDE.md, rules or memory loaded (it saw only the auto gitStatus), answered the ntcharts tag question from `gh api` with sources · first request wrote **9.2k** tokens cold, against ~137k for a plain fresh agent (10-06 base) and 51.7k for its own haiku parent · 7 steps · note: the agent file is not hot-loaded — a session started before it gets «Agent type not found»; chore-helper keeps the fleet memory on purpose (it edits repos)
