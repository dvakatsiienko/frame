---
kind: refresh
owner: coordinator
cadence: at every cc minor that touches mods, at the test-drive verdict (2026-10-19), or when dima asks
artifacts:
  - home/.claude/plugin-x/mods/AGENTS.md
  - home/.claude/plugin-x/mods/api-map.md
  - docs/test-drive/mods.md
script: none
was: [refresh-branch-mods, refresh-mods]
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

his standing calls: session.measure «not yet, i don't need another ctx meter»; spoken pings «not yet … speak only when i press f4»; sline stays a statusline, not a mod; a mod-authoring skill → no, `mods/AGENTS.md` is the home.

## the run

1. **research** — one brief from the vectors; `pnpm research:lanes <brief> <out>` + an opus lane when source must be read (vector 2). done: every lane returned or marked failed. (script)
2. **distill** — merge into `mods/AGENTS.md` (claims marked unprobed until probed) and the FRM-304 open list; raw lane output stays in `last/` until the next run's distill. done: the artifacts carry the merge, or are named «unchanged». (open)
3. **eval + findings** — grade the lanes in `docs/test-drive/{exa,parallel}.md`; findings print. done: the grades are in the test-drive files. (template)
4. **resolve** — with dima; a build becomes a child of FRM-304; noop is fine. done: his word on each build. (open)
5. **log** today's line in `log.md`. done: the line is there. (open)

## vectors

### research

1. the official surface — the mods reference + changelog since the last run: new events, `$` methods, render sites, limits, surfaces; then the generated types in `.claude-plugin/types/` as the authority for our build
2. **hunt already built to borrow** — published mods and hook plugins (the catalogue at mods.aidojo.si, claudemods.ai, ray-amjad/awesome-claude-code-function-hooks, anthropics/claude-code-playground mods): read the source of the ones near our needs, one «borrow» line each
3. **hunt already built for inspo** — unusual or high-value uses we have not thought of (guards, dashboards, presence, cost, privacy)
4. best practices and pitfalls — hot paths, state lifetimes, reload, composition with other mods and with cc built-ins, testing

### analysis

1. every mod's FTR against reality — a ✅ line still passes, a 🧭 line still wanted, a 🐞 still open
2. the test drive log (`docs/test-drive/mods.md`) — which mod fired for real, what it saved or broke
3. fleet misses a mod could have caught — the flawlog and coder retros since the last run
4. the coder retros on mods work — each harness or api trap becomes an `AGENTS.md` line
5. built-in collisions — does cc now ship natively what a mod of ours does (the prompt suggestion did); then the mod yields or goes
6. the api-map — re-read the types at every cc bump; grep the whole file for a capability before choosing one
7. **the surface matrix** — every mod checked on the terminal, the desktop Code tab, Warp and a remote-control view; «did the viewer reload?» is asked before any ui bug is called (the hover hunt cost 3 rounds, FRM-303)
8. **a session-kind probe** — any filter on origin or session kind is probed once per kind: interactive, bg `sdk`, peer (the composer-only allow-list broke every bg session, FRM-303)
9. **a state-lifetime audit** — every module variable that must survive a reload lives in `$.state` or `$.store` (the 10-04 keep-hot untick looked like a reload resetting one)
10. **open leads (written 2026-10-05, hot)** — re-check: the three engine facts `mods/AGENTS.md` marks for a live session: `$.state` reset on `/clear` `/resume` `/branch`, hooks on the host under remote control, and the rest of that block's «unprobed» lines
11. **open leads (written 2026-10-05, hot)** — re-check: the surface matrix (vector 7) — the checklist waits in `docs/test-drive/mods.md` for one sitting with dima ([claude-code#99217](https://github.com/anthropics/claude-code/issues/99217) still open on 10-05)
12. **open leads (written 2026-10-05, hot)** — re-check: what a mod still cannot reach: the `queue-operation` record (redact), the desktop's own prompt suggestion, the `InfoNotice` line — re-check each at a bump
13. **open leads (written 2026-10-05, hot)** — parked builds (the open list is FRM-304): asks moving into stash as a tool (needs dima's word: it changes the ⏳ rule) · `mods:live`, a pty harness for reload and hover checks (only on a third need)
14. **open leads (written 2026-10-05, hot)** — re-check: the test drive verdict 10-19 (`docs/test-drive/mods.md`): spawn hints were dropped 10-05 (0 for 1, a toast never reaches the session it corrects); the board, redact, holds + the Bash veto, asks, afk, keep-hot each get a real-use line

## artifacts

- `home/.claude/plugin-x/mods/AGENTS.md` — the authoring rules and traps (the one home, dima's call)
- `home/.claude/plugin-x/mods/api-map.md` — every event with its line in the types file, and the fleet ideas
- `docs/test-drive/mods.md` — the running measurement, verdict 2026-10-19
- [FRM-304](https://linear.app/x-com/issue/FRM-304) — the open list; every round of work is a child ticket

## findings

- print dima: what is essential and not built, what to borrow, what to drop
