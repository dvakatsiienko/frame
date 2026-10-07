# Handoffs interop through one shared file store

Every handoff frontend — the `cc` `handoff*` skills and `cw`
via the `handoff` MCP server (`mcp-handoff-cw`; now named `x-cw`, living in
`mcp-x-cw` — the names changed, the decision did not) — reads and writes the same
store, `~/.claude/handoffs/` (now `~/.claude/shelf/handoffs/` — the location moved
under the shelf, the decision did not), in the same CST format. The format is defined
once, in `home/.claude/plugin-x/CST-SPEC.md`; frontends inline or load that file,
never fork its text. Files are transient: deleted on ingest (`-shared` kept for
multiple pullers). CSTs therefore flow in every direction
(`cc`↔`cc`, `cc`↔`cw`) with no per-direction machinery.

> **Amended 2026-08-31 (DOT-233):** the store's mechanics now live in ONE executable —
> `script/handoff-store.ts` — and every frontend is a thin adapter over it. The sweep is
> retired: nothing auto-deletes; `list` age-flags files older than ~7d and deletion is
> always a human-said thing. Upmerge exists as `write --replaces <slug>`. The shared-store
> decision itself stands unchanged.
>
> **Amended 2026-10-06 (FRM-284):** the store has a second reader — `x handoffs` reads it in go
> (`x/go/store.go`), because a node bridge cost 60 of its 72 ms. The writer stays one executable,
> `script/skill-handoff-store.ts`. The two readers test the same names, `script/lib/handoff-names.json`,
> so the grammar is still defined once.
>
> **Amended 2026-10-07 (FRM-343):** one door again — `x handoff` (list, peek, ingest, write,
> delete) owns the whole store, and the node store script is gone. The `cc` skills, the `x-cw` mcp
> server and the raycast command all call it. Its deletes skip `--apply`: the store is disposable
> by this decision, and every removal goes to the macos trash.

## Considered Options

Per-app stores or formats would double the mental model and orphan the
CC-side lifecycle tooling (sline's 📬, prune, sweep). A claude.ai-API bridge
(driving the logged-in browser session) was prototyped conceptually and
rejected: `cw` threads aren't on local disk, the API surface is unofficial,
and a scraper is a science experiment where a 100-line stdio server is a daily
driver. Peer messaging — `cc`'s happy path — has no `cw` equivalent, so the
file tier, already CC's delivery guarantee, became the interop backbone.
