---
dies-when: the unified canvas app is grilled and its ticket holds the decision
---
Ticket: BYT-136

# one canvas app: design review + agent diagrams + one comment system — feasibility probe, stage 1

read on 2026-11-23: design-loupe at `~/projects/bytes/apps/design-loupe` (bytes HEAD `099f255f`), `~/frame/_clio/blueprints`, earlier frame research, and the libraries' own docs, repos and npm. no code was written or run.

**verdict: yes, with one named risk.** recommended: **option 1, grow design-loupe's own surface**. a diagram becomes a new kind of board, drawn as DOM + SVG on the same `react-zoom-pan-pinch` surface. the agent writes nodes and edges, and **elkjs** lays them out. comments anchor to `{board, element id}` on both kinds of board. the risk: elk's layout of agent-written nested graphs with real labels has to read well with no hand-tuning.

## A. design-loupe today

- **the canvas is DOM + CSS transforms.** there is no `<canvas>` and no svg
  - `react-zoom-pan-pinch` `TransformWrapper`/`TransformComponent` puts every board in one absolutely positioned div (`src/components/surface.tsx:168-200`)
  - the scale is pushed into a CSS var `--zoom` on each transform (`surface.tsx:177-179`). the wheel is the app's own (`surface.tsx:80-113`, `src/view.ts:52-77`, ADR `docs/adr/0001-the-stack.md:14`)
  - pinned at 4.2.0 (`package.json`). latest is 4.4.0, MIT ([npm](https://www.npmjs.com/package/react-zoom-pan-pinch), read 2026-11-23)
- **a board is an iframe of the designer's `.dc.html`**, served from the app's origin (`src/components/board.tsx:105-119`)
  - it sits at the x/y/w/h from the job's `canvas.json` (`server/job.ts:98-110`), and is virtualised to a placeholder when far away (`board.tsx:89-104`)
  - the frame is same-origin on purpose, so the app can read the board's DOM (`board.tsx:112-113`)
- **a pin is an element id inside the board's markup, `id="ask-N"`**
  - found by regex in the file text (`server/job.ts:112`, `:194-203`) and measured live with `getElementById` + `getBoundingClientRect` in the frame (`board.tsx:173-229`)
  - the **ring** is an app-drawn div over the board, in board px, inside the transformed content (`board.tsx:120-136`). so it follows pan and zoom for free
- **the model has three parts, and none of them is a free-form comment**
  - **asks**: written only by the designer, in `asks.json` (`server/job.ts:16-38`). fields: `id` (`ask-N`), `board`, `kind` pick/confirm/compare/open, `options`, `recommend`, `why`, `seen`, `applied`
  - **answers**: written only by loupe, in `answers.json` (`job.ts:48-70`). an answer is a pick plus `notes: [{at, text}]` (`job.ts:40`), keyed by ask id
  - **handovers** live in `sent` (`job.ts:77-84`)
  - a note has **no author field** (`job.ts:40`)
  - dima cannot open a thread of his own: «out: … dima's own canvas threads · asks from clio or codie» (`PRODUCT.md:39`)
  - so the brief's «marks/comments» today means **designer asks + dima's answers and notes**, nothing more
- **store and transport**
  - two json files, one writer each: «neither side ever rewrites the other's file» (`job.ts:7-11`)
  - loupe's own writes are queued (`writeAnswer` → `inTurn`, `job.ts:239-241`)
  - api on the vite dev server: `GET /api/job`, `POST /api/answer|reopen|send` (`server/plugin.ts:22-28`)
  - a file change reaches the page as the `loupe:job` hmr event, through node `fs.watch` (`plugin.ts:164-191`)
- **the agent's side is a cli**: `pnpm loupe round|wait|mark` (`scripts/loupe.ts:17-24`)
  - `wait` blocks until a handover and prints the answers (`loupe.ts:75-123`)
  - so an agent pushes content by writing files (boards, `canvas.json`, `asks.json`) and reads answers back through one blocking cli call
- **reusable as-is for a diagram mode**
  - the surface: pan/zoom, the own wheel, `frameRect`/`revealRect`, minimap (`view.ts:9-35`, `surface.tsx:44-72`, `:201-214`)
  - `KeepScale` labels (`board.tsx:76-88`)
  - deep links `/<job>/…` (FTR.md:18)
  - the file-plus-hmr transport (`plugin.ts:164-191`) and the cli wait/handover pattern (`loupe.ts:75-123`)
  - the «target moved» idea: an anchor id gone from the current revision locks its thread (`job.ts:143-159`)
- **tied to artboard images**
  - the iframe, sandbox and link blocking, and the Claude Design runtime `support.js` (`board.tsx:15-51`, `AGENTS.md:37-41`)
  - pins found by regex in `.dc.html` text (`job.ts:112-113`)
  - the anchor id doubles as the thread id (`ask-N`), so a pin carries exactly one ask, and only the designer can place one (`GLOSSARY.md:19-21`)
  - the ask kinds with options and recommend (`job.ts:21-25`) are a design-decision ballot, not a comment

## B. three ways to the drawing mode, plus one

### 1. grow our own on the current surface: shapes as DOM/SVG, layout by elkjs

- **build cost: low to medium**
  - a diagram board is a React component: boxes and labels as absolutely positioned divs, edges as one SVG layer, all inside the existing `TransformComponent`
  - layout by elkjs `layered`. nesting comes from ELK's compound graphs, `hierarchyHandling: INCLUDE_CHILDREN` ([ELK option](https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html))
  - elkjs **0.12.1**, licence **EPL-2.0 OR GPL-3.0-or-later** ([npm](https://www.npmjs.com/package/elkjs), [repo](https://github.com/kieler/elkjs), read 2026-11-23). elk only does layout: the caller gives node sizes (repo README, read 2026-11-23). so label text must be measured first
  - the dear part, if it is ever wanted: dima dragging or drawing shapes by hand. the brief does not ask for it
- **agent draws with one small file**: yes, by construction
  - e.g. `diagrams/<name>.json`: `{nodes:[{id,label,parent?,shape?}], edges:[{from,to,label?}]}`, picked up by the same `fs.watch` → hmr path
  - ids are the agent's own, so they stay stable across redraws
  - optional fixed `x,y,w,h` per node skips layout for a free sketch
- **our comments on any element**: yes, with the least work
  - each node is a real DOM element with `data-el=<id>` in board px. the ring/overlay code (`board.tsx:120-136`) works unchanged, minus the iframe
  - it survives pan and zoom because it lives inside the transform. it survives re-layout because the anchor is the id, and the box is re-read after layout
- **treemap later**: cheapest of all. see D
- **licence traps**: none for a local app (EPL/GPL only matter if elk is redistributed)

### 2. embed tldraw

- **version/licence**: `tldraw` **5.6.2** under the **tldraw license**, not open source ([LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md), last changed 2025-09-17 at `e455ab8`, read 2026-11-23)
  - allowed: use «in Development Environments». forbidden: use «in Production Environments», defined as any deployment that provides «functionality to end users». «Production Environment excludes internal development»
  - the software checks a License Key, «detect[s] deployment environments … ensure[s] proper watermark display», and «may collect and transmit usage data» (same file)
  - no key needed in dev (non-https, localhost, or `NODE_ENV` ≠ production). in production, without a key it «stops rendering the editor» after 5 s ([license key docs](https://tldraw.dev/sdk-features/license-key), read 2026-11-23)
  - **hobby** licences are «discretionary» and «keep the "made with tldraw" watermark». the trial lasts 100 days. commercial: price set with sales (same page)
  - **trap**: dima's local daily tool runs on localhost and passes the technical dev check. whether real daily use counts as «internal development» is a legal grey zone. a later deploy (vercel) needs a key at once. whether the dev build shows the watermark was not read «?»
- **commenting is built in**: `@tldraw/commenting` 5.6.2, same licence ([npm](https://www.npmjs.com/package/@tldraw/commenting), first published 2026-07-17)
  - thread anchors: `point | shape | region | page`. a shape anchor keeps a normalised 0–1 offset and follows the shape across moves. a deleted shape turns it into a point ([commenting docs](https://tldraw.dev/sdk-features/commenting), read 2026-11-23)
  - but: «Commenting is a licensed feature», needing «a tldraw license that includes commenting» in production (same page)
  - threads are tldraw store records, so an agent reaches them only through a bridge we build. they are not a file it can write
- **create from JSON**: yes, documented. `editor.createShapes([...])` with partial shapes, `editor.createBinding` for arrow ends, `zoomToBounds` ([shapes/bindings/camera docs](https://tldraw.dev/sdk-features/bindings), read via ctx7 2026-11-23). there is no auto-layout: we would still run elk ourselves
- **artboards**: would move into tldraw custom shapes (iframes), and the ADR's own reason not to use the sdk stands: «a full canvas editor for a page that only pans, zooms and rings» (`docs/adr/0001-the-stack.md:7`)
- **build cost: medium**. the most editor for free, but two camera systems unless the artboards move too
- **treemap later**: possible as custom shapes, but tldraw is a free-form editor, not a nested-box browser

### 3. embed Excalidraw

- **version/licence**: `@excalidraw/excalidraw` **0.18.1**, **MIT** ([npm](https://www.npmjs.com/package/@excalidraw/excalidraw), [repo](https://github.com/excalidraw/excalidraw), read 2026-11-23). the same version is already in `~/frame/_clio/blueprints/excalidraw/package.json`
- **create from JSON**: yes. `convertToExcalidrawElements(skeleton[])` for rectangle/ellipse/diamond/text/arrow, then `updateScene` ([skeleton api](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx), [excalidraw-api](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx))
  - per-element `customData` is documented ([props](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/@excalidraw/excalidraw/api/props/props.mdx))
  - our blueprints scripts already write it (`_clio/blueprints/excalidraw/lib/convert.mjs:271`, `lib/id-map.mjs:56-61`)
- **our comments**: no built-in comments in the OSS editor. «comments in Excalidraw sit behind Excalidraw+, not bought» (`docs/test-drive/excalidraw.md:42`, 2026-10-30)
  - an overlay is possible: it draws on `<canvas>`, so there is no DOM node per element. pins come from element x/y/w/h, mapped with `sceneCoordsToViewportCoords` and refreshed on `onScrollChange`/`onChange` ([utils](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/@excalidraw/excalidraw/api/utils/utils-intro.md))
  - it would work, but it is a second coordinate system beside the artboards' one
- **agent fit**: no auto-layout, so it is today's door: a script places every tile (`_clio/blueprints/excalidraw/lib/route.mjs`, `geometry.mjs`, `crossings.mjs`)
- **what dima said**: «excalidraw is not convenient, slow and ugly» (FRM-614 W9, quoted in `docs/research/claude-whiteboards.md:51`, 2026-11-19)
- **treemap later**: poor. hand-drawn style, no nesting model beyond frames and groups
- **build cost: medium**, and it rebuilds what the blueprints folder already found painful

### 4. other strong candidate: React Flow (`@xyflow/react`)

- **version/licence**: **13.0.3**, **MIT** ([npm](https://www.npmjs.com/package/@xyflow/react), [repo](https://github.com/xyflow/xyflow), read 2026-11-23)
- **fit for «agent writes nodes and edges, the app lays them out»**: the best of the libraries
  - nodes and edges are plain JSON with our own ids
  - an official elkjs layout example ([elkjs example](https://reactflow.dev/examples/layout/elkjs)). it lays out flat graphs only: nesting would be our own elk call (page read 2026-11-23)
  - nested boxes through `parentId` + `extent: 'parent'` ([sub flows](https://reactflow.dev/examples/grouping/sub-flows))
  - overlays in flow coordinates through `<ViewportPortal>` ([api](https://reactflow.dev/api-reference/components/viewport-portal)) and `<NodeToolbar>`
  - nodes are DOM, so a comment overlay anchors by node id and survives pan, zoom and re-layout
  - dagre is the lighter layout: `@dagrejs/dagre` 3.1.3, MIT ([npm](https://www.npmjs.com/package/@dagrejs/dagre)). it has no real compound layout, so elk is the pick for «container → parts → one level in»
- **cost**: it brings its own viewport. artboards would have to become React Flow nodes, or live on a second surface. that is the same split as 2 and 3, though the cheapest of them, and MIT
- **keep it as the fallback** if dima later wants to drag nodes and draw edges by hand. that is what it is built for

### also seen, not an embed

- **Claude Whiteboards**: Anthropic's own beta. a terminal session draws and answers comments through `Artifact`/`ArtifactComments`, at zero build (`docs/research/claude-whiteboards.md:11`, 2026-11-19)
  - it cannot hold design-loupe's live artboards, and its comments live in claude.ai, not our files
  - whether its FRM-614 test drive ran and how it went was not read «?»

## C. one comment thread type for both modes

what must be true:

- **the anchor is separate from the thread.** a thread has its own id (`c-<n>` or a ulid). its anchor is `{board, element?, region?}`
  - `element` is a stable id inside the board: a DOM `id`/`data-pin` in an artboard's html, or a node id in a diagram file
  - `region` is a box in the element's or board's own px, best stored normalised 0–1 to the element box, like tldraw's shape anchor (commenting docs above). then it survives re-layout
  - today the anchor *is* the ask id (`job.ts:14`, `:112`), so there is one pin per ask and only the designer can place one
- **every note has an author**: `{at, by, text}`, where `by` is `dima | <agent name>`. today `{at, text}` (`job.ts:40`)
- **anyone can open a thread**, not only the designer
  - the thread's `to` (the board's author, e.g. `designer` or `clio`) decides whose `wait` wakes
  - an ask becomes an optional payload of a thread (`kind`, `options`, `recommend`), not the only kind
- **one writer per file still holds**
  - each author appends to its own file, `threads/<by>.jsonl` (one json line per note or state change). the app merges them on read
  - this keeps «each side writes only its own file» (`job.ts:7-11`) with N agents, and gives an agent a no-api door: «append one line» or `pnpm loupe comment <job> <board>#<el> "text"`
  - the browser writes `threads/dima.jsonl` through the existing queued server path (`job.ts:239-241`)
- **coordinates in board space, never screen space**, so pan and zoom never touch the record. the overlay sits inside the transform as the ring does (`board.tsx:120-136`)
- **«target moved» generalises**: the element id is not in the board's current revision → the thread shows «moved» and is locked, as now (`job.ts:143-159`)
  - for diagrams, the revision is a hash of the json file (as `revisionOf` does for html, `job.ts:202`)
- **the way back stays the handover**
  - `loupe wait <job> --for <agent>` wakes once per batch for threads addressed to that agent (pattern: `loupe.ts:75-123`)
  - the batching rule — «one block, never one answer at a time» — is kept (FTR.md:68-73)

the smallest change from today:

- add `by` to notes (old notes read as `dima`, the way the zod preprocess already upgrades old files, `job.ts:48-62`)
- add a `threads` record keyed by thread id, holding `anchor` and `to`
- read asks as threads with `anchor.element = ask.id`
- add one cli verb, `comment`
- the ask panel (`src/components/ask-panel.tsx`) becomes a thread panel. pick, Enter and `1`–`4` stay for threads that carry options

## D. the treemap direction

- **library**: `d3-hierarchy` 3.1.3, ISC: `hierarchy()` + `treemap()` give each node `x0,y0,x1,y1` ([d3 treemap](https://d3js.org/d3-hierarchy/treemap), [npm](https://www.npmjs.com/package/d3-hierarchy), read 2026-11-23). layout only, no rendering
- **with option 1 it lives inside the same surface**
  - a treemap is one more board kind: d3 boxes rendered as the same DOM nodes with `data-el` ids, zoomed by the same `frameRect` (`view.ts:19-35`)
  - «zoom to the smallest piece» is `setTransform` to a node's rect, as `/ask/N` already does (FTR.md:13-16). comments anchor to node ids unchanged
  - many boxes need culling. `Virtualize` is already in use (`board.tsx:89`)
- **with React Flow** it also fits: d3 rects become positioned `parentId` nodes. MIT, cheap
- **with tldraw or Excalidraw** it would sit beside the canvas or be forced into an editor's shapes. both are poor fits, and Excalidraw is the worst
- the one choice to make now: **a diagram's source is a tree** (`parent` on nodes) plus edges, so the same file can feed elk today and d3 treemap later

## E. verdict

- **possible: yes, with a named risk.** **option 1**: diagrams are a new board kind on design-loupe's own DOM surface, elkjs lays out agent-written `nodes/edges/parent` json, and one author-aware, id-anchored thread model covers artboards and diagrams. React Flow (MIT) is the fallback if hand-editing becomes a want. tldraw and Excalidraw are not recommended: licence grey zone and a second canvas for tldraw, no OSS comments and dima's «slow and ugly» for Excalidraw
- **risk 1, the named one: layout quality**
  - elk has to turn an agent's nested graph (container → named parts → one level inside, labelled edges) into a picture dima reads cold, with no hand-tuning
  - elk needs label sizes we measure ourselves (elkjs README). compound-edge routing across levels is where layered layouts get ugly
  - today's blueprints needed custom routers and crossing checks (`_clio/blueprints/excalidraw/lib/route.mjs`, `crossings.mjs`)
- **risk 2: one thread model across two anchor worlds**
  - artboard pins live in a same-origin iframe's DOM; diagram pins live in our DOM. both must yield one board-px box, and a comment by an agent must survive the agent's next redraw
  - that holds only if agents keep ids stable. the file format must make that the easy path, and «moved» must catch the rest
- **smallest spike (≤1 day, throwaway, on a branch of design-loupe)**
  - given a hand-written `diagrams/cc-mods.json`: the cc mods container, its named parts, one level inside each, 6–10 labelled edges, every node with an agent-chosen id. and one artboard job (`fixtures/speak`) on the same surface
  - when the page loads it beside the speak boards, and elkjs (`layered`, `INCLUDE_CHILDREN`) lays it out as DOM boxes + an SVG edge layer
    - an agent runs `pnpm loupe comment fixtures/speak cc-mods#<part-id> "is this part right?"`
    - dima replies in the browser and adds his own thread on a speak board element
    - the agent edits one label and re-runs layout
  - then:
    - both threads ring their elements within 2 px at zoom 0.37 and 2.0 (the existing check, FTR.md:16)
    - after the re-layout the diagram thread still rings its node
    - `loupe wait --for <agent>` prints dima's reply in one block within 5 s
    - dima reads the cc mods picture cold and says whether it is clear, without a hand move
- **what reading could not settle (the spike or a person must)**
  - whether elk's compound layout of the real cc mods tree is readable as-is, or needs per-graph options «?»
  - text measuring for elk node sizes in the browser: done before layout or as a second pass, and its cost «?»
  - whether `react-zoom-pan-pinch` stays smooth with a few hundred DOM nodes plus iframes on one surface (treemap scale) «?»
  - whether a region comment on an artboard (a box, not an element) is wanted, or element anchors are enough «?»
  - whether dima wants to edit diagrams by hand (drag, draw). this decides option 1 versus React Flow «?»
  - whether tldraw's dev build shows the watermark, and whether tldraw would call daily local use «internal development» (only tldraw can answer that) «?»
  - whether FRM-614's Claude Whiteboards drive changed the want «?»

<!-- end -->
