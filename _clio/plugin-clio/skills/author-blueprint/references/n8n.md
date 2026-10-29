# n8n 2.43.7 — what cclio uses, verified 2026-10-18

sources: three research lanes (exa, parallel, an opus source lane reading the installed package), raw in `_clio/.scratch/viz-tool/n8n-*` until the halt; the recipe `refresh-blueprint-comms` refreshes this file.

## the door

- REST `localhost:5678/api/v1`, header `X-N8N-API-KEY`, the key through `script/op-run.sh` (`N8N_API_KEY`)
- `GET /discover` lists what the key can call; the bundled `openapi.yml` (in the n8n package, `dist/public-api/v1/`) is the map, never docs memory — the docs say `/datatables`, the spec says `/data-tables`
- workflows: GET, POST, PUT (whole, `versionId` locks), `/publish`, `/unpublish` (`/activate` is deprecated), `/history`, `/versions/{vid}`
- executions: list, read, `/retry`; kept 14 days, 10,000 rows max
- data tables: create, rows insert, `/rows/upsert`, update, delete; 200 MiB shared
- the MCP server (Settings › Instance-level MCP) adds partial edits (`addNode`, `renameNode`, `setNodePosition`), validation and a node catalog; off by default, kept off: REST does the job without resident schemas

## community edition limits

- licence-gated, so not ours: variables, projects, folders API, source control, environments, external secrets
- git history of our workflows: the exports in `blueprints/`, committed

## the nodes that matter

- `noOp` tiles, sticky notes (colors, behind tiles), `nodeGroups` frames (`{id,name,description,nodeIds}`; editor rendering unverified)
- webhook, schedule, wait, data table, code (JS and Python, task runner, env blocked), execute workflow, error trigger, http request, github, linear, gmail
- Execute Command is blocked by default (`NODES_EXCLUDE`); Read/Write File only under `~/.n8n-files` unless `N8N_RESTRICT_FILE_ACCESS_TO` widens it
- community nodes: npm packages adding node types, full host access; installed only after a source read

## templates

- `https://api.n8n.io/api/templates/search?search=<w>` and `…/templates/workflows/<id>` need no key and return importable json (strip the wrapper, POST to `/api/v1/workflows`)

## footprint

- ~680 MB RSS live (n8n 558 MB + task runner 122 MB); sqlite is right for one user; a backup is the whole `~/.local/share/x-n8n` with its encryption key
- otel traces per execution (`/settings/otel`) → our `x-cc-otel` tap; licence status unverified
