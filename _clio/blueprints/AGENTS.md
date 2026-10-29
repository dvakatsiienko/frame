# AGENTS.md: blueprints — dima and clio talk through pictures

a **blueprint** is a picture of one part of our system — a flow, a structure, a map — that clio draws and dima edits to show an idea; clio reads his edit back and builds from it. the want and the decisions: `PRODUCT.md`.

## the tools

- **draw.io** is the blueprint tool (dima, 2026-10-23: the most faithful and cheapest of three, the bench in `docs/test-drive/blueprints.md`; why FigJam left: `docs/test-drive/figjam.md`): a `.drawio` here, built by a script so a redraw is one command; `drawio -x -f png -s 0.6 -o <png> <file>` renders the look (full size runs out of tile memory)
- **n8n** is for automation workflows only: `http://localhost:5678`, run by pm2 as `x-n8n` (`schedule/jobs/x-n8n/`), data in `~/.local/share/x-n8n` (never in git)
  - clio's door is the REST API: `script/op-run.sh` with `N8N_API_KEY` (`op://dev/n8n-local/credential`), header `X-N8N-API-KEY`; the CLI import overwrites dima's unsaved tab, so it is never used on a live flow
- **Excalidraw**: on trial, its setup in `docs/test-drive/excalidraw.md` (toolchain, boards, opening one); draw.io falls back till the verdict
- **Obsidian Canvas**: an option for later; **FigJam**: back only if the Figma MCP cap lifts

## the mapped areas — the board is the design truth

a mapped area's board is our main reference for its flow: a change may land in the files first, and the board is redrawn once all its steers and tweaks land, never forgotten (dima, 2026-10-22, PK-103 W94–W95); the skills stay what agents run. an area joins only once a board proved useful. guards: `_clio/script/blueprint-nudge.ts` (an edit of a mapped source names its board) and `blueprint-drift.ts` at every siesta and halt.

- 🛼 crew and pm, end to end · `excalidraw/crew-pm-flow/board.excalidraw` (on trial, made from `crew-pm-flow.drawio`; FigJam original: https://www.figma.com/board/hVVKYtLdMTKASUS3mwG3Uz, frozen) · sources: home/.claude/plugin-x/skills/crew-lead/, home/.claude/plugin-x/skills/crew-subagent/SKILL.md, home/.claude/plugin-x/skills/crew-dna/SKILL.md, _clio/memory/craft-pm.md, _clio/memory/craft-fleet-flow.md, _clio/plugin-clio/skills/pm/, _clio/memory/habit-shared-files.md, _clio/plugin-clio/skills/shape-idea/, _clio/plugin-clio/skills/shape-lane/, _clio/plugin-clio/skills/shape-lane-dispatch/, _clio/plugin-clio/skills/boot/, _clio/plugin-clio/skills/halt/, _clio/script/pocket-check.ts, _clio/script/pocket-add.ts, _clio/script/wish-cover.ts, _clio/script/prompt-groom.ts, _clio/backlog.config.yml
- 📐 refresh-crew-coordinator, a run · https://www.figma.com/board/RAJ5NlCcJVqfWNjR0KiS35 (FigJam, frozen, drawn: 2026-10-21; redrawn in draw.io at its next touch) · sources: recipes/refresh-crew-coordinator/recipe.md, _clio/plugin-clio/skills/shape-recipe/SKILL.md

## the names

- every board leads with an emoji from the skill's set, a name dima reads cold, a dash, what it does: `🗺️ pm module flow — a wish from the inbox to dima` (dima, 2026-10-18: «I like emojis»)

## the files

- one blueprint per subject, its name self-descriptive for dima, entity-first: `<subject>-<kind>` (`pm-module-flow`)
- a builder prints `🗺️ <board> v<N>` (`versions.json`, bumped on a byte change); the reply after a board edit quotes it (dima, W282)
- a `.drawio` is committed after every redraw and after every read of dima's edit, so git keeps its history; an n8n automation saves its export here as `<name>.n8n.json` the same way
- dima's edit is read back as a semantic diff (tiles, arrows, renames, moves), never as the raw json diff: n8n, draw.io and Obsidian all rewrite the whole file on save
