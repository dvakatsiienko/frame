# fleet-doors — the routing table
<!-- sync: cw -->

**scope:** which door exists for each external domain. one line each, resident on every surface —
a door you do not know about is a door you answer «i have no access» to. the details behind each
door live in `rules/fleet-tooling.md` (cc) and the cw leaf named on the line.

## doors

- fleet ops (commit, push, pr, merge, unlock, …) → `x`, the fleet cli; bare `x` lists every verb · cc only, cw has no shell
- gmail → `himalaya`, no mcp exists · cw leaf `/areas/tooling.md`
- slack → `slk`, no mcp exists · cw leaf `/areas/tooling.md`
- notion → `ntn`, never the connector · cw leaf `/areas/tooling.md`
- web search / extract / deep research → `parallel-cli` (key `op://dev/parallel-golden/credential`), on trial beside the built-in WebSearch · cw leaf `/areas/tooling.md`
- api keys → 1password vault `dev`, never a literal value · cw leaf `/areas/tooling.md`
- deletes → `trash`, never `rm` · cw leaf `/areas/tooling.md`
- obsidian vault → raw files, `obsidian` cli for rename/move · cw leaf `/topics/obsidian.md`
- art (any picture, icon, avatar, gif, terminal clip) → the `x:art-kit` skill; illustration is made in atelier (`bytes/apps/atelier`) · cc only, cw hands art asks to the mac
