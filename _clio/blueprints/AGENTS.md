# AGENTS.md: blueprints — dima and clio talk through pictures

a **blueprint** is a picture of one part of our system — a flow, a structure, a map — that clio draws and dima edits to show an idea; clio reads his edit back and builds from it. the want and the decisions: `PRODUCT.md`.

## the tools

- **Excalidraw** is the blueprint tool (dima, 2026-10-30: «let's have Excalidraw as a main blueprinting tool for now»; verbs and setup: `docs/test-drive/excalidraw.md`): a board is `excalidraw/<board>/board.excalidraw`
  - a worktree has no `node_modules`: run `node lib/<verb>.mjs <absolute board>` from the main checkout's `excalidraw/`
  - the PWA holds a copy: each redraw needs his ⌘O, each edit his ⌘S
  - a redraw patches the board by script; a tickets-flow tile's text also goes into `ticket-flow.build.py`
- **draw.io** is the fallback; `crew-pm-flow.drawio` no longer follows the board
- **n8n** is for automation workflows only: `http://localhost:5678`, run by pm2 as `x-n8n` (`schedule/jobs/x-n8n/`), data in `~/.local/share/x-n8n` (never in git); its door: the skill's `references/n8n.md`
- **Obsidian Canvas**: an option for later; **FigJam**: back only if the Figma MCP cap lifts (why it left: `docs/test-drive/figjam.md`)

## the mapped areas — the board is the design truth

a mapped area's board is our main reference for its flow: a change may land in the files first, and the board is redrawn once all its steers and tweaks land, never forgotten (dima, 2026-10-22, PK-103 W94–W95); the skills stay what agents run. an area joins only once a board proved useful. guards: `_clio/script/blueprint-nudge.ts` (an edit of a mapped source names its board) and `blueprint-drift.ts` at every siesta and halt.

- 🛼 crew and pm, end to end · `excalidraw/crew-pm-flow/board.excalidraw` (FigJam original: https://www.figma.com/board/hVVKYtLdMTKASUS3mwG3Uz, frozen) · sources: home/.claude/plugin-x/skills/crew-lead/, home/.claude/plugin-x/skills/crew-subagent/SKILL.md, home/.claude/plugin-x/skills/crew-dna/SKILL.md, _clio/memory/craft-pm.md, _clio/memory/craft-fleet-flow.md, _clio/plugin-clio/skills/pm/, _clio/memory/habit-shared-files.md, _clio/plugin-clio/skills/shape-idea/, _clio/plugin-clio/skills/shape-lane/, _clio/plugin-clio/skills/shape-lane-dispatch/, _clio/plugin-clio/skills/boot/, _clio/plugin-clio/skills/halt/, _clio/script/pocket-check.ts, _clio/script/pocket-add.ts, _clio/script/wish-cover.ts, _clio/script/prompt-groom.ts, _clio/backlog.config.yml, home/.claude/plugin-x/skills/crew-codie/, home/.claude/plugin-x/skills/crew-sixth-sense/, _clio/plugin-clio/skills/siesta/, docs/knowledge/pr-flow.md, docs/research/review-model.md, docs/test-drive/stacked-prs.md, x/go/merge_auto.go, x/go/stacks.go, x/go/review.go, x/go/lane_landed.go, x/go/lane_dispatch.go, x/go/brief_summon.go, _clio/.claude/hooks/watch-pr.sh, _clio/script/close-net.ts, _clio/script/halt-sweep.ts, _clio/script/pocket-move.ts, _clio/script/check-idle.ts, home/.claude/plugin-x/mods/x-mod-guard/
- 📐 refresh-crew-coordinator, a run · https://www.figma.com/board/RAJ5NlCcJVqfWNjR0KiS35 (FigJam, frozen, drawn: 2026-10-21; redrawn in Excalidraw at its next touch) · sources: recipes/refresh-crew-coordinator/recipe.md, _clio/plugin-clio/skills/shape-recipe/SKILL.md

## the names

- every board leads with an emoji from the skill's set, a name dima reads cold, a dash, what it does: `🗺️ pm module flow — a wish from the inbox to dima` (dima, 2026-10-18: «I like emojis»)

## the files

- one blueprint per subject, its name self-descriptive for dima, family-first: `<subject>-<kind>` (`pm-module-flow`)
- a board's version sits in `versions.json` and its `bv-label` element, bumped with each redraw; the reply after a board edit quotes it, `🗺️ <board> v<N>` (dima, W282)
- a board is committed after every redraw and after every read of dima's edit, so git keeps its history; an n8n automation saves its export here as `<name>.n8n.json` the same way
- dima's edit is read back as a semantic diff (tiles, arrows, renames, moves), never as the raw json diff: n8n and Excalidraw both rewrite the whole file on save; a board's door is `pnpm read-back`
