---
kind: refresh
owner: coordinator
artifacts:
  - home/.claude/plugin-x/mods/AGENTS.md
  - home/.claude/plugin-x/mods/api-map.md
  - docs/test-drive/mods.md
script: none
was: [refresh-branch-mods, refresh-mods]
groomed: 2026-10-10 (dima)
---

# refresh-cc-mods

Keeps the fleet's cc mods (function-hook plugins, `home/.claude/plugin-x/mods/`) worth their place:
what the api can do now, what others built, and whether anything useful is left for us. Born
2026-10-05. The standing story is [FRM-304](https://linear.app/x-com/issue/FRM-304).

## the want

> mods would allow us to solve lots of issues, including my UX and DX, and maybe even some issues from flowlog or fleet flow issues (2026-10-05)

> I still explore them myself and can't tell for sure how much fleet should be aware of mods (2026-10-05)

> we have more ideas for mods … let's exhaust full list, until nothing else useful to do with mods (2026-10-05)

> why not to keep everything related to mods in its own agents.md? i agree that another research about tips and tricks for mods would be a good idea. to seed best practices. and probably, create a recipe based on all my asks about mods? e.g. what i want from them? and recipe should also have «search for already built to borrow» item, and «see what's there» e.g. hunt inspo ideas (2026-10-05)

> let's run it again to see if we truly did everything essential (useful) via mods, and nothing more useful left for now (2026-10-05)

> the main thread is chaotic and multi-lane, so i often miss data in your messages that i don't want to miss … mods are about solving comms issues (2026-10-10; the five pieces in full — lane tracker, planned actions, the asks box, checkbox asks, «what did you miss» — live in cclio's pocket PK-20)

> the biggest possible failure of this mod is a habit: you should know it very well, since it becomes the main comms place (2026-10-10)

his standing calls: session.measure «not yet, i don't need another ctx meter»; spoken pings «not yet … speak only when i press f4»; sline stays a statusline, not a mod; a mod-authoring skill → no, `mods/AGENTS.md` is the home.

## the run

- suggest a run when: a cc minor touches mods, the test-drive verdict (2026-10-19)

1. **groom**: `x:shape-recipe` steps 0 and 2. done: his word on the list. (open)
2. **research** — one brief from the vectors; `pnpm research:lanes <brief> <out>` + an opus lane when source must be read (vector 2). done: every lane returned or marked failed. (script)
3. **distill** — merge into `mods/AGENTS.md` (claims marked unprobed until probed) and the FRM-304 open list; raw lane output stays in `last/` until the next run's distill. done: the artifacts carry the merge, or are named «unchanged». (open)
4. **eval + findings** — grade the lanes in `docs/test-drive/{exa,parallel}.md`; findings print. done: the grades are in the test-drive files. (template)
5. **resolve** — with dima; a build becomes a child of FRM-304; noop is fine. done: his word on each build. (open)
6. **log** today's line in `log.md`. done: the line is there. (open)

## vectors

### research

1. the official surface — the mods reference + changelog since the last run: new events, `$` methods, render sites, limits, surfaces; then the generated types in each `<mod>/.claude-plugin/types/` as the authority for our build
2. **hunt already built to borrow** — published mods and hook plugins (the catalogue at mods.aidojo.si, claudemods.ai, ray-amjad/awesome-claude-code-function-hooks, anthropics/claude-code-playground mods): read the source of the ones near our needs, one «borrow» line each
3. **hunt already built for inspo** — unusual or high-value uses we have not thought of (guards, dashboards, presence, cost, privacy)
4. best practices and pitfalls — hot paths, state lifetimes, reload, composition with other mods and with cc built-ins, testing
5. **the comms mechanics** — clickable checkboxes, buttons and a text box inside a mod's pane, in the desktop side pane and in the terminal: what renders where, what takes input, what keeps per-session state
6. **joining a prompt** — a mod adding text to the next prompt on send (before or after it), and whether anything can join a running turn without starting a new one
7. **borrow for the asks** — the vendor fleet views (needs you · ready to review · working), Claude Code's structured asks (`AskUserQuestion`), approval queues: what a mod can copy as is
8. **keeping the contract in mind** — how an agent keeps a tool's contract live across turns and compactions: a skill, resident memory, a hook reminder; dima's «the habit is the failure point»

### analysis

1. every mod's FTR against reality — a ✅ line still passes, a 🧭 line still wanted, a 🐞 still open
2. the test drive log (`docs/test-drive/mods.md`) — which mod fired for real, what it saved or broke
3. the coder retros on mods work — each harness or api trap becomes an `AGENTS.md` line
4. built-in collisions — does cc now ship natively what a mod of ours does (the prompt suggestion did); then the mod yields or goes
5. the api-map — re-read the types at every cc bump; grep the whole file for a capability before choosing one
6. **a session-kind probe** — any filter on origin or session kind is probed once per kind: interactive, bg `sdk`, peer (the composer-only allow-list broke every bg session, FRM-303)
7. **a state-lifetime audit** — every module variable that must survive a reload lives in `$.state` or `$.store` (the 10-04 keep-hot untick looked like a reload resetting one)
8. **open leads**: every «unprobed» line in `mods/AGENTS.md` and every open child of FRM-304, re-checked on the current build; the test drive verdict in `docs/test-drive/mods.md`
9. **why the stash asks went unused** — dima kept them folded; plus the fence check that fires after the reply, costing a second print
10. **the comms targets** — the ledger in `docs/knowledge/operator-agent-comms-optimization.md`: the numbers each comms mod must move (asks pasted back, status questions, re-asks, the reading load)

## artifacts

- `home/.claude/plugin-x/mods/AGENTS.md` — the authoring rules and traps (the one home, dima's call)
- `home/.claude/plugin-x/mods/api-map.md` — every event with its line in the types file, and the fleet ideas
- `docs/test-drive/mods.md` — the running measurement, verdict 2026-10-19
- [FRM-304](https://linear.app/x-com/issue/FRM-304) — the open list; every round of work is a child ticket

## findings

- print dima: what is essential and not built, what to borrow, what to drop
