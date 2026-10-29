# crew-lead — design lanes

read when a lane draws on a canvas or builds from a comp. the designer's own contract is `x:crew-designer`, the interview `x:crew-designer-interview`.

🎨 **comp first** — a design job opens with a `design` canvas dima approves in the artifact; then `impeccable` builds the code from that comp: its finish-reviewer judges the build against the comp, its documenter derives `DESIGN.md` from the shipped code. one codie, both skills in sequence. the canvas lane touches no files; the build lane starts only after his word on the boards.
- 📌 **the impeccable plugin stays on, user scope, no toggling** (dima, 2026-09-28: «i'd like to keep it enabled, do not like the hassle of toggling it»); bytes enables it at project scope anyway. its cost is a slower Stop after `.ts`/`.js` edits, never a block. a clean a/b needs the competing plugin disabled per lane: its `PostToolUse`/`Stop` hooks fire in every session.

🖼️ **visual iteration runs in an artifact; main gets the pick** — and **one sample before the set**: one jar in the artifact would have caught what five jars built from a relayed spec did not. an Artifact `read` without `path` costs ~15k tokens; `list scope=files` + `read path=` is the route, the full read only the republish gate.

🎨 **the pick is clio's side of a spread**: dima picks by commenting on the canvas, never by describing boards in text.
1. before he looks, print the short list of what to judge, one line per surface (page, card, selected state, stats, pill, …). **every pointer at a spot on a canvas carries an exact text from that board in bold** («**cut in the last seven days**»): he finds it with ⌘F; a board title alone is too hard to find (dima, 2026-10-01)
2. hoist every comment from every canvas (`ArtifactComments` read, all pages) by its anchor detail, the element it sits on, never just its board; name back to him the drawn parts no comment touched
3. write a merge brief: per surface, the board that won and its source, the steers, the open forks as a/b boards; one designer draws ONE merged take from it
4. tally the «best» tags per arm in `docs/test-drive/design-run.md` — the model and effort stats

