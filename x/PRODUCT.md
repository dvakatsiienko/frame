# x — the fleet cli

## the want

dima's words:

> «make pnpm scripts in dotfiles part of cli — pnpm dotfiles and related» (FRM-14)
>
> «We will have a lot of methods for CLI, I think about 60 minimum … any fleet member would call a global `CLI --help` command … usually 90% of the time any thread would refer to fleet CLI anyways. Especially if we fold all our processes into that, CLI threads will be forced to use it because the stuff that they want to use is within a CLI.» (inbox, 2026-10-05)
>
> «having an always-up-to-date CLI schema would allow us to save turns for any fleet member» (chat, 2026-10-05)
>
> «another cli purpose: streamline fleet by automating repeatable operations» (chat, 2026-10-05)
>
> «let's be mindful about what we fold into a CLI: not just blindly pull everything there, but only have the verbs and operations that truly deserve to reside in a CLI interface» (chat, 2026-10-05)
>
> dima likes charm's tools and style — «the look judged on my own terminal» (FRM-284)

- **who:** the fleet first — every agent on every surface — and dima second
- **job:** a fleet procedure becomes one verb, so every member uses the same door instead of re-deriving the steps
- **job, second half:** a repeatable operation done by hand twice becomes a verb the third time
- **feel:** a json contract agents cannot break, and a view dima enjoys on his terminal

## the human view (grill Q2, 2026-10-05)

- pretty by default, read-first: boards and status views dima reads, one-shot verbs with a clean confirm
- interactive driving (pickers, arrow-key browsing) only when dima starts driving x — then it grows those elements; not before
- ~~the bet: TypeScript + charm's binaries (`gum`, `glow`) for the look~~ → **decided 2026-10-06 (FRM-284 look probe): go + charm** — bubbletea, bubbles, lipgloss, huh, glamour, harmonica. the look won on the side-by-side shots
- the look is a product requirement, not polish: «cli must look pretty and look prod grade. and use all bubbletea components when applicable — spinners, loaders, huh and other components. and don't forget that i sometimes will use cli too. it should be agents and user friendly» (dima, 2026-10-06)
- it is a showcase piece too: «btw my fleet has its own brand cli» — a clip or a shot of it can sit on the visit card (BYT-119)

## what x is not — the admission rule (grill Q1, 2026-10-05)

a verb lives in x only when all three hold:

- **a fleet procedure, not a package's lifecycle** — build, dev, test, typecheck, lint, codegen, render stay turbo / pnpm scripts, cached and ordered by the task graph; x may call a turbo task, never re-implements one
- **more than one surface calls it** — agents and dima, or cc and cloud threads; a one-off script stays a script
- **it hides a hazard or a sequence** — a thin alias over one command is noise

after a frame → bytes merge, x is one workspace package beside turbo: turbo owns the graph, x owns the procedures.

## the cut — v1 (2026-10-05)

- `lane` (shipped in v0) · `handoffs` (list, peek, ingest — the store `x-cw` uses) · `x schema` at two detail levels
- the resident index: a SessionStart hook prints the verb names + purposes, generated from the registry
- the look: the FRM-284 a/b/c winner, built to the T2 design
- every new verb passes the admission rule first

**out of v1:** pm / notes / scheduling / evergreen verbs (each through the admission rule later) · interactive driving · an MCP mirror (decided: none; `x-cw` stays until the cw-door probe) · package lifecycle (turbo / pnpm)

the done test is `FTR.md`; the words are `GLOSSARY.md`. prior art: `docs/research/cli-agent-facing.md`.
