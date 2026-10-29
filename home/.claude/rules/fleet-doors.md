# fleet-doors — the routing table
<!-- sync: cloud-chat -->

**scope:** which door exists for each external domain. one line each, resident on every surface —
a door you do not know about is a door you answer «i have no access» to. the details behind each
door live in `rules/fleet-tooling.md` (cc) and the cloud chat leaf named on the line.

## doors

- fleet ops (commit, push, pr, merge, unlock, …) → `x`, the fleet cli on dima's mac; bare `x` lists the families, `x schema <family>` the verbs · cc runs it natively; a cloud chat or project cloud thread runs `~/.local/bin/x` through the mac's Desktop Commander; a project coordinator cannot reach the mac — it routes the job to a thread
- dima's mac (shell, files, local clis) from cloud chat or a project → Desktop Commander under the `mcp__remote-devices__` prefix, present whenever the desktop app is open; a Desktop Commander without that prefix runs inside the cloud VM, not the mac · a «no Desktop Commander» answer means the prefixed list was not searched
- gmail → `himalaya`, no mcp exists · cloud chat: `/areas/tooling.md`
- slack → `slk`, no mcp exists · cloud chat: `/areas/tooling.md`
- notion → `ntn`, never the connector · cloud chat: `/areas/tooling.md`
- web search / extract / deep research → `parallel-cli` (key `op://dev/parallel-golden/credential`), a standing lane beside exa and the built-in WebSearch · cloud chat: `/areas/tooling.md`
- api keys → 1password vault `dev`, never a literal value · cloud chat: `/areas/tooling.md`
- deletes → `trash`, never `rm` · cloud chat: `/areas/tooling.md`
- obsidian vault → raw files, `obsidian` cli for rename/move · cloud chat: `/topics/obsidian.md`
- more screenshots or files than a prompt holds → dima drops them on the vorssaint utils shelf and says «check my shelf»; `pnpm vorssaint:shelf` (`--json`) lists their paths, read in order · items stay until he drags them off, so a read names what it already read · cc only <!-- cc -->
- art (any picture, icon, avatar, gif, terminal clip) → the `x:art-kit` skill; illustration is made in atelier (`bytes/apps/atelier`) · cc only, cloud chat hands art asks to the mac
