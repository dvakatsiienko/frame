# AGENTS.md: blueprints — dima and cclio talk through pictures

a **blueprint** is a picture of one part of our system — a flow, a structure, a map — that cclio draws and dima edits to show an idea; cclio reads his edit back and builds from it. the want and the decisions: `PRODUCT.md`.

## the tools — a 2-week trial (`docs/test-drive/blueprints.md`)

- **n8n** is primary: `http://localhost:5678`, run by pm2 as `x-n8n` (`schedule/jobs/x-n8n/`), data in `~/.local/share/x-n8n` (never in git)
  - cclio's door is the REST API: `script/op-run.sh` with `N8N_API_KEY` (`op://dev/n8n-local/credential`), header `X-N8N-API-KEY`; the CLI import overwrites dima's unsaved tab, so it is never used on a live flow
  - a tile is a `n8n-nodes-base.noOp` node; a free comment is a sticky note; a rename rewrites the connections keyed by that name
- **Obsidian Canvas** and **draw.io** are the A/B sides, drawn on dima's ask: a `.canvas` in the vault's `_hq/`, a `.drawio` here (`drawio -x --layout '[{"layout":"elkLayered"}]'` places the tiles)

## the names

- every board leads with an emoji from the skill's set, a name dima reads cold, a dash, what it does: `🗺️ pm module flow — a wish from the inbox to dima` (dima, 2026-10-18: «I like emojis»)

## the files

- one blueprint per subject, its name self-descriptive for dima, entity-first: `<subject>-<kind>` (`pm-module-flow`)
- every read of an n8n blueprint saves its export here as `<name>.n8n.json`, committed — git keeps the history the n8n database does not
- dima's edit is read back as a semantic diff (tiles, arrows, renames, moves), never as the raw json diff: n8n, draw.io and Obsidian all rewrite the whole file on save
