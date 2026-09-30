# ctx7 — library docs from the cli, vs the context7 mcp

Ticket: none
dies-when: the verdict line below is written (2026-10-07) — the loser is uninstalled, the winner keeps its tooling line

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

## verdict

_(2026-10-07)_
