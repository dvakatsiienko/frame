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
>
> «we shouldn't migrate scripts one-to-one from pnpm to CLI. Since we are rebuilding CLI from scratch, we can rethink the architecture … Everything, everywhere, essentially, was created in a random way … now we have an opportunity to properly rearchitect everything from scratch in an efficient way.» (chat, 2026-10-06)
>
> «How to actually properly architect a CLI so it would be top-notch, perform very well, and actually streamline Fleet Flow?» (chat, 2026-10-06)
>
> «a telemetry (tracing) for cli is also worth to bake in from start. for stats, and tracing what is used and what is a dead weight … infographics, i'd maybe would want in hq app.» (chat, 2026-10-06)

- **who:** the fleet first — every agent on every surface — and dima second
- **job:** a fleet procedure becomes one verb, so every member uses the same door instead of re-deriving the steps
- **job, second half:** a repeatable operation done by hand twice becomes a verb the third time
- **feel:** a json contract agents cannot break, and a view dima enjoys on his terminal

## the human view (grill Q2, 2026-10-05)

- pretty by default, read-first: boards and status views dima reads, one-shot verbs with a clean confirm
- interactive driving (pickers, arrow-key browsing) only when dima starts driving x — then it grows those elements; not before
- **motion and colour wherever they fit** (dima, 2026-10-07): a spinner on every wait, a progress bar on every step with a length (the terminal-tab one too, OSC 9;4), harmonica springs where a view can move, emoji as line prefixes on the human view — the tty path only; an agent's envelope stays plain json. the widget per view is `docs/knowledge/charm.md` §2
- prior art for the main view (pocket 05): [gh-dash](https://github.com/dlvhdr/gh-dash) — a sectioned bubbletea dashboard over github prs and issues, by the author of diffnav (where `bubbles/tree` came from)
- ~~the bet: TypeScript + charm's binaries (`gum`, `glow`) for the look~~ → **decided 2026-10-06 (FRM-284 look probe): go + charm** — bubbletea, bubbles, lipgloss, huh, glamour, harmonica. the look won on the side-by-side shots
- the look is a product requirement, not polish: «cli must look pretty and look prod grade. and use all bubbletea components when applicable — spinners, loaders, huh and other components. and don't forget that i sometimes will use cli too. it should be agents and user friendly» (dima, 2026-10-06)
- it is a showcase piece too: «btw my fleet has its own brand cli» — a clip or a shot of it can sit on the visit card (BYT-119)

## what x is not — the admission rule (grill Q1, 2026-10-05)

a verb lives in x only when all three hold:

- **a fleet procedure, not a package's lifecycle** — build, dev, test, typecheck, lint, codegen, render stay turbo / pnpm scripts, cached and ordered by the task graph; x may call a turbo task, never re-implements one
- **more than one surface calls it** — agents and dima, or cc and cloud threads; a one-off script stays a script
- **it hides a hazard, a sequence or a location** — where a thing lives, its format, its filter; a thin alias over one command is noise
- **a thin verb lives while telemetry shows it used** — dima, 2026-10-07: «even if cli cmd is very basic and just a listing like x handoffs list — it is still good to have because it allows to see doors … not always for perf gains - for colocation purposes». colocation is the reason, `x stats` is the proof
- **hiding is for the caller, never for the fixer** — `x schema <verb>` prints the verb's source dir, the stores and files it touches, and the script it replaced; `--help` stays the pretty day-to-day view

## a verb is done when its old door is dead (2026-10-07)

a ported verb names what it replaces (`replaces:` in its registry entry); a contract test stays red while that file exists or anything still calls it. `x handoffs` shipped without it and gained zero callers — dima: «creating dead cli families and verbs is not about optimization».
<!-- this rule dies when the migration map below is empty: every planned port landed, nothing left to replace -->

after a frame → bytes merge, x is one workspace package beside turbo: turbo owns the graph, x owns the procedures.

## the cut — v1 (2026-10-05)

- `lane` (shipped in v0) · `handoffs` (list, peek, ingest — the store `x-cw` uses) · `x schema` at two detail levels
- one resident line, never a per-verb index: «`x` is the fleet cli; `x` lists families, `x schema <family>` the verbs» (~30 tokens, against ~1.5k for 60 verbs, dima 2026-10-07); an `x-mod-guard` hint answers a call to a replaced script with its verb
- the look: the FRM-284 a/b/c winner, built to the T2 design
- every new verb passes the admission rule first

**out of v1:** pm / notes / scheduling / evergreen verbs (each through the admission rule later) · interactive driving · an MCP mirror (decided: none; `x-cw` stays until the cw-door probe) · package lifecycle (turbo / pnpm)

the done test is `FTR.md`; the words are `GLOSSARY.md`. prior art: `docs/research/cli-agent-facing.md`.

## the rebuild — grill round 1 (2026-10-06)

the inventory: 119 scripts (82 frame, 37 bytes), 45 unused in 30 days, ~40 name prefixes; the top three by calls are `linear:read` 148, the handoff store 145, `linear:agent-token` 125 (agent calls only — dima's own terminal is invisible to transcripts).

- **what x owns:** every fleet op. app dev (`dev`, `build`, `test` per app) stays with `pnpm` / `turbo`, one door per app.
- **the shape:** entity-first families (`x linear read`, `x handoff ingest`, `x lane commit`), ~12 families, each verb declared once in the registry. not a port: each script is re-thought into its family or dropped.
- **go native or adapter:** the hot paths go native first (linear, the handoff store, lanes); a cold verb may call its TS script through an adapter until telemetry says it lives.
- **telemetry from day one:** one json line per call in `~/.local/state/x/trace/<date>.jsonl`, written at exit, no network — when, verb, flag names (never values), caller (a terminal, or an agent session + member), repo, duration, exit and error kind, each step's time, x version. OpenTelemetry-shaped names. `X_TRACE=0` turns it off. `x stats` reads it (most used, dead for 30 days, slowest p95, failure rate, agents vs dima); `flow:report`, the halt board and the hq app read the same files. each `pnpm` shim left during the move writes a trace line too.
- **where x runs:** the mac (cc, cw through Desktop Commander). a cloud session gets the repo, not x.
- **the move is done when:** the root `package.json` holds only app dev scripts, every fleet op is a verb with a contract-test line, and `x stats` shows no verb dead for 30 days.

## the rebuild — grill round 2 (2026-10-06)

- **the families (draft, each re-thought when built):** `linear` (read, token, as, push) · `handoff` (store, ingest, peek) · `lane` (commit, push, pr, merge-main, unlock, worktree seed) · `mods` (test, live) · `design` (contrast, palette, cvd, scale, tokens, diff) · `jev` (vet, report, route, flawlog) · `research` (lanes) · `flow` (report, crew audit, memory-load, reply-check) · `app` (essentials, badges) · `frame` (link, toolchain sync, macos setup) · `tool` (dima's hotkeys, speak, schedule, monitor) · `x` (schema, stats, completion)
- **the order:** telemetry first (it decides the rest) → `linear` + `handoff` (the hottest) → `flow` (feeds the memory sweep) → the rest in the order telemetry ranks them
- **who builds:** one go `--bg` coder per family, reused while under the spawn grid's ~220k; mechanical ports go to `implement-spec` subagents on sonnet
- **the old scripts:** a ported script dies in its verb's commit; a thin `pnpm` shim stays only for a name dima types himself, and goes after 14 days of zero calls in telemetry
- **the memory sweep pairs with it:** each memory line the sweep touches gets a fourth verdict, «→ x verb» or «→ guard rule», collected into this family map

## the next lane — grill rounds 1–3 (2026-10-07)

- **the order:** `x` (telemetry + `x stats`) → `handoff` → `linear` → `fleet` (flow report, crew audit, memory-load, reply-check, agent-ops) → `mods` → `research` → `design` → `jev` (after the credit refill) → `app` / `frame` / `tool`, ranked by telemetry when their turn comes. `lane` is done. agent calls per family over 30 days (transcripts, dima's terminal not counted): `linear` 300 + 632 raw `linear api`, `handoff` ~145, `jev` 84, `mods` 62, `design` 52, `research` 50
- **depth:** the next 1–2 families are grilled in full ahead of the build, so a lane never stops for a grill; the rest stay one line here until their turn — the memory sweep may move them
- **telemetry is the foundation:** every verb built after it is traced from its first call
  - `caller` on every trace line: `dima` (a tty, no agent env) · `cc` (`CLAUDECODE=1`) · `cw` (marker unknown — probed when the cw door is tested) · `ssh` (`SSH_CONNECTION`, no agent env) · `hook` (lefthook or a cc hook) · `other`. a cloud session never reaches the mac's x, so it has no value; a new member is one line
  - the agent's member name (cclio, a coder) is resolved from the session registry at `x stats` time; the write stays one append
  - error kinds: `usage` · `refused` · `external` · `bug`
  - raw daily files live 90 days — the cli changes fast while it is built
  - dima's terminal: a zsh `preexec` hook writes a trace line for every `pnpm <script>` and `x` he types, same format, same dir
- **the pnpm scripts:** each family's port deletes its scripts in its own commit; the ~45 dead for 30 days go in one prune pass, 14 days after the `preexec` hook starts, item by item with dima (granular)
- **`x stats`:** easy to extract for agents (the envelope), pretty for dima — a bubbletea board: calls per family as bars, a 30-day sparkline per verb, failure kinds, dima vs agents; `tab` switches family / verb view
- **the charm stack, in full:** bubbletea · bubbles · lipgloss · glamour · huh · log · fang (in use) · **harmonica** — upfront: a coder animates with it wherever a view can move; a continuous repaint is fine when it makes the ui prettier (dima) · **teatest** — golden frames for every redraw · **ntcharts** (third party) — the charts, tried first on `x stats` · **sequin** — the redraw debugger (`brew`) · **vhs** + **freeze** — the shots
- **later, when needed:** **wish** — serve x's views over ssh

## the next lane — grill round 4 (2026-10-07)

- **the charm reference is the stack page:** `docs/knowledge/charm.md` — every lib with its gh link and job, which widget for which view (pointers into bubbletea's examples), our gotchas; a pointer line in `x:guide-go`; a contract test fails when `go.mod` gains a charm module the file does not list
- **`fleet`** is the family of the fleet measuring itself: `x fleet flow` (was `flow:report`), crew audit, memory-load, reply-check, agent-ops; the rename lands once, with the port
- **skill → x ← mcp:** a skill keeps the judgment and points at `x <family> --help`; the `x-cw` tools are one-line shells to x; a mechanic lives in one place
- **identity:** `x as <member> -- <command>` puts the right app token (linear: cclio / coder, github: x-coder) into that child's env only; one internal `keys` package — 1password read in-process, minted tokens cached in the macOS keychain to expiry, every `as` traced. ❓ does the `linear` cli take an oauth bearer from env — probe at spec time
- **`linear`, the fast train:** native go, batched, presets, and measured both ways in `x stats` — under-delivers (a `read` followed within a minute by a raw call on the same id) and over-delivers (bytes per call nobody used)
- **traces keep entity ids** (ticket ids, slugs, family names); free text, bodies and paths outside the repos stay out
- **the `linear` verbs**, from 981 raw `linear api` calls + 93 curl calls in 30 days: `read <ids…>` (batched; default fields = what the 583 single reads asked for) · `list` + `list --search` · `body <id>` pull / `--set <file>` write back, refused when the ticket changed since the pull · `set <id>` (state, delegate, parent, project, milestone, additive labels) · `link <id> blocks|related <ids…>` · `comment <id> --body-file` · `update <project|initiative> --body-file --health`; ids and state names resolve inside x, the token hop and the `viewer` checks go into `x as`
- **the raw door:** a missing verb never blocks an agent. each proxying family keeps one traced passthrough, `x linear api '<graphql>'` — the tool underneath, under `x as` identity, with id resolution and a trace line; `x schema <family>` names it. `x stats` ranks what the raw door carries, and a query seen three times becomes a verb. a raw call outside x still works: the doors report (`refresh-agent-ops`) counts it, and an `x-mod-guard` hint answers it with the matching verb once one exists
- **later, a verb candidate:** `x scout <url> "<lens>"` — reads `docs/knowledge/scout-tools.md` first, a miss runs the `researcher` agent with dima's lens (for him, the fleet, cclio), prints the verdict and appends one line; a «try» hands into `x:shape-test-drive` (dima, 2026-10-07)
