---
kind: refresh
owner: coordinator
artifacts:
  - home/.claude/plugin-x/mods/AGENTS.md
  - home/.claude/plugin-x/mods/engine.md
  - home/.claude/plugin-x/mods/api-map.md
  - docs/test-drive/mods.md
  - home/.claude/plugin-x/mods/workarounds.md
script: none
was: [refresh-branch-mods, refresh-mods]
groomed: 2026-10-12 (dima)
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

> this mod is very important, as one of the critical failure points: it's a communication point and kind of an escape hatch of your own harness … our workaround is home-baked, so it has higher risks of malfunction. how to ensure that, if it starts to malfunction, it will not be missed? (2026-10-12, quiet comms)

> what other common operations would existing mods be missing, and what features and knobs would you want to smoothen your moves? (2026-10-12)

> my mods wants: know how to make mods look pretty; how to organize them in the UI (layout). my number one mods issues: the lack of space in the desktop app to lay mods out; not knowing what mods can render — no component library to see what i, you or a coder can actually draw; not knowing the best use of mods overall — which mods would help us, given our troubles and bottlenecks. prior art is what i'm most interested in: there is a very large number of mods out there, and borrowing from them should be researched precisely (2026-10-12)

his standing calls: session.measure «not yet, i don't need another ctx meter»; spoken pings «not yet … speak only when i press f4»; sline stays a statusline, not a mod; a mod-authoring skill → no, `mods/AGENTS.md` is the home.

## the run

- suggest a run when: a cc minor touches mods, the test-drive verdict (2026-10-19)

1. **groom**: `clio:shape-recipe` step 0, the grill. done: his word on the list. (open)
2. **research** — one brief from the vectors; `pnpm research:lanes <brief> <out>` + an opus lane when source must be read (vector 2). done: every lane returned or marked failed. (script)
3. **distill** — a probed engine fact merges into `mods/engine.md`, a door or a rule into `mods/AGENTS.md` (claims marked unprobed until probed; the core stays near 8 KB) and the FRM-304 open list; raw lane output stays in `last/` until the next run's distill. done: the artifacts carry the merge, or are named «unchanged». (open)
4. **eval + findings** — grade the lanes in `docs/test-drive/{exa,parallel}.md`; findings print. done: the grades are in the test-drive files. (template)
5. **resolve** — with dima; a build becomes a child of FRM-304; noop is fine. done: his word on each build. (open)
6. **log** today's line in `log.md`. done: the line is there. (open)

## vectors

### research

1. the official surface — the mods reference + changelog since the last run: new events, `$` methods, render sites, limits, surfaces; then the generated types in each `<mod>/.claude-plugin/types/` as the authority for our build
2. **hunt already built to borrow — the lead vector** — published mods and hook plugins (the whole catalogue at mods.aidojo.si, claudemods.ai, ray-amjad/claude-code-mods, anthropics/claude-code-playground mods, anthropics/claude-code/mods): read every catalogue entry, not a first page; rank the ones near our needs and troubles; read their source; one «borrow» line each with what it would replace or add for us
3. **hunt already built for inspo** — unusual or high-value uses we have not thought of (guards, dashboards, presence, cost, privacy)
4. best practices and pitfalls — hot paths, state lifetimes, reload, composition with other mods and with cc built-ins, testing
5. **keeping the contract in mind** — how an agent keeps a tool's contract live across turns and compactions: a skill, resident memory, a hook reminder; dima's «the habit is the failure point»
6. **fail-safe mods on a comms door** — how others guard a hook that can swallow or delay delivery: fail open, canaries, ledgers, kill switches, health rows
7. **a mod's reach into other sessions** — sending a peer message, reading another session's state, delivering into a tool result's `context`; the size caps on a tool description and on that `context`
8. **pretty mods** — what makes a mod look good: the visual patterns in the best published mods, color, density, glyphs, motion, light and dark
9. **layout in a tight space** — how others fit many mods into the desktop side pane and the terminal: folding, tabs, priority, one board vs many
10. **the component gallery** — every element a mod can render (text, boxes, buttons, inputs, markdown, links, status lines, notifications), how each looks on desktop and in the terminal; the answer feeds a living gallery we can open

### analysis

1. every mod's FTR against reality — a ✅ line still passes, a 🧭 line still wanted, a 🐞 still open
2. the test drive log (`docs/test-drive/mods.md`) — which mod fired for real, what it saved or broke
3. the codie retros on mods work — each harness or api trap becomes an `AGENTS.md` line
4. built-in collisions — does cc now ship natively what a mod of ours does (the prompt suggestion did); then the mod yields or goes
5. the api-map — re-read the types at every cc bump; grep the whole file for a capability before choosing one
6. **a session-kind probe** — any filter on origin or session kind is probed once per kind: interactive, bg `sdk`, peer (the helga-only allow-list broke every bg session, FRM-303)
7. **a state-lifetime audit** — every module variable that must survive a reload lives in `$.state` or `$.store` (the 10-04 keep-hot untick looked like a reload resetting one)
8. **open leads**: every «unprobed» line in `mods/AGENTS.md` and `mods/engine.md` and every open child of FRM-304, re-checked on the current build; the test drive verdict in `docs/test-drive/mods.md`
9. **the comms targets** — the ledger in `docs/knowledge/fleet-operator-comms.md`: the numbers each comms mod must move (asks pasted back, status questions, re-asks, the reading load)
10. **session identity** — every key a mod uses for «who is this session» (cwd, registry name, cc sessionId, desktop `local_` id) checked against a `cd`, a `/clear`, a rename and a reinit
11. **leftovers** — dev-mods dirs past their probe, a mod still loaded after its source moved
12. **clio's wants list** — each open want of the coordinator's (brief 8 on 10-12) read against the api: buildable, workaround, or engine gap
13. **our bottlenecks → mods** — the flawlog, the comms ledger and the retros read for the troubles a mod could remove; a ranked list of mods we do not have yet

## artifacts

- `home/.claude/plugin-x/mods/AGENTS.md` — the doors and the rules every mod round needs (the one home, dima's call)
- `home/.claude/plugin-x/mods/engine.md` — the probed engine facts and the test-harness traps, read by name
- `home/.claude/plugin-x/mods/api-map.md` — every event with its line in the types file, and the fleet ideas
- `docs/test-drive/mods.md` — the trial record, adopted 2026-10-19; a run reads its log, appends nothing
- `home/.claude/plugin-x/mods/workarounds.md` — dima's mods wants the engine can't do yet; an entry the cc changelog shows landed is printed with its undo, and leaves once the undo ships
- [FRM-304](https://linear.app/x-com/issue/FRM-304) — the open list; every round of work is a child ticket

## findings

- print dima: what is essential and not built, what to borrow, what to drop
- checklist, every run: each entry in `home/.claude/plugin-x/mods/workarounds.md` against the cc changelog since the last run — landed, or still missing (dima, 2026-10-10)
