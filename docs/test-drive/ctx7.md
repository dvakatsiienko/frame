# ctx7 — library docs from the cli, vs the context7 mcp

Ticket: none
dies-when: the verdict line below is written (2026-10-09) — the loser is uninstalled, the winner keeps its tooling line

dima, 2026-09-30: «i don't want both tools. if CTX7 CLI will prove better than MCP and coders will use it, then let's
keep CLI. no need to have MCP for Context7, considering it is a dead weight currently. coders don't use it, but we have
to measure first.» and: «when docs are not present in ctx7 reach docs via websearch tool»

the question: do coders read a library's docs before building with it, and which door do they take?
baseline (2026-09-30, `pnpm crew:audit`): the BYT-113 coder, the day's biggest build, made 0 context7 calls and 0 web
fetches.

## setup

- `ctx7` 0.5.12 from brew (Brewfile, test-drive section); no login needed for queries
- `crew-coder/how-you-work.md` names it: `ctx7 library <name>` → `ctx7 docs <id> "<part>"`; a library ctx7 lacks →
  `WebSearch` for its official docs
- the context7 mcp plugin stays installed and unmentioned, so the week shows which door a coder reaches for by itself
- measured 2026-09-30: `ctx7 library "tanstack query"` 2.1 s → `/tanstack/query`; `ctx7 docs /tanstack/query "useQuery
  staleTime refetchOnWindowFocus"` 2.8 s, 3.1k chars

## log — date · coder session · library · door (ctx7 / mcp / web / none) · useful y/n

- 2026-10-02 · `pnpm crew:audit --days 7`, 20 real coder sessions (7 scratch/probe sessions left out) · — · ctx7 in 2 sessions (3f2a7658 BYT-116: 3, 7e4c1126: 1), the context7 mcp in 0, web in 1 (3f2a7658), none in 18 · useful: not judged by the audit. ⚠️ correction (same night): the «docs first» line entered `how-you-work.md` on 2026-09-30, and 16 of the 20 sessions started before it; of the 4 coders that had the line, 2 used ctx7 (3 and 1 lookups) and 2 looked up nothing — those two built bash/ts tooling with no library to look up (FRM-278, a probe). the window must start at the line's date; re-count at the verdict with `--days` set from 09-30
- 2026-10-08 · `pnpm crew:audit --days 7` · 25 coder sessions, 7 days: ctx7 used in 6 (`53881f51` 5 · `0918edf2` 4 · `828c280a` 3 · `3f2a7658` 3 · `7e4c1126` 1 · `7da79fed` 1), the context7 mcp in 0, web in 1 (`3f2a7658`); 19 sessions made no docs lookup · «useful» not judged by the audit (it counts calls only)


## verdict

**adopted** (2026-10-09, dima's yes on pk-22): ctx7 is the library-docs door — 6 of 25 coder sessions in 7 days reached for it, the context7 mcp 0. the trial text left `rules/fleet-tooling.md`; the line stays as the door.
