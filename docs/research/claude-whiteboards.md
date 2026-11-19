---
dies-when: FRM-614's door is decided
---

Ticket: FRM-614

# Claude whiteboards: the door, what a board holds, does it answer blueprint v2

wish: FRM-614 (W1–W27, blueprint v2) and dima's 19 Nov 14:31 ask. read on 2026-11-19 by the stray codie: probes in this terminal session (Claude Code 2.1.328, a herdr pane), the type's own instructions, Anthropic's help and Code docs, and two web lanes (exa 124 s, parallel 182 s, `research:lanes`). no board was created: a create is a write, so it is the test drive's first step.

**the verdict**: **a plain terminal Claude Code can create, read, draw on and answer comments on a whiteboard.** it needs no desktop app. the door is the `Artifact` tool's Whiteboard type, plus `ArtifactData` for the board's contents and `ArtifactComments` for its threads. it answers most of blueprint v2's want with zero build. worth a test drive before any line of our own app.

## 1. what a whiteboard is

- **a claude.ai artifact type, in beta**: «Claude Whiteboards is available in beta on Pro, Max, Ultra, Team, and Enterprise plans on web, Claude Desktop, and Claude Mobile» ([help: get started with whiteboards](https://support.claude.com/en/articles/18324319-get-started-with-claude-whiteboards)); both web lanes date the launch **10 Nov 2026** from Anthropic's article ([sheets, whiteboards, data](https://claude.com/resources/articles/sheets-whiteboards-data), not opened by me)
- **the type's own description**, as this session lists it: «shared infinite canvases that show ideas as blocks, arrows, sections and marker sketches, which people rearrange together, with live cursors» (`Artifact` `list`, `scope: types`, type `https://claude.ai/artifact/PLsEyfjXbDUM1iasW7rjLR`, release `1795055083-071a`)
- **what a board holds**, from the type's instructions (`Artifact` `read` with the `type_url`):
  - blocks (`shape`): rect, rounded, ellipse, diamond, pill, hexagon, parallelogram, database, queue, document, cloud, person; 7 fills
  - sections (`container`), `text` in five sizes, pen `stroke`s, `arrow`s with planned routes (`bends`), `table`s
  - `image`: an upload, or Claude's own SVG drawing
  - `html` embeds: a small working page that can keep what people enter
  - link cards to other artifacts
  - at most 800 elements, 2 MB a board
- 📌 **a wireframe is spelled out**: «a wireframe, like anything only read, is shapes and text»; «a prototype or mock-up is an embed that looks and works like the product»
- **both edit it**: people drag, type and sketch in the browser, with live cursors (the type's `room` capability). Claude writes elements into the board's live store and claims a frame first, so people see where it is working
- **comments**: the type declares the `comments` capability; a thread sent to Claude reaches the session through `ArtifactComments`
- **export**: PNG, «send to» Lucid, Miro and Zoho Vani, or a doc or deck made from it; «you can't import a board from a file» (help page)

## 2. the door: which surfaces draw

- **a plain terminal cc: yes, proven by probe in this session.**
  - `Artifact` `list` `scope: types` lists 7 types, the **Whiteboard** among them, beside Design, Design System, Docs, Sheets, Slides and Data
  - `ArtifactData` and `ArtifactComments` load as deferred tools here (`ToolSearch select:ArtifactComments,ArtifactData`)
  - the type tells Claude to fill a board «with `batch` through `ArtifactData`»: `board/meta`, then `elements/<id>`, 50 writes a call
- **no tool is named «whiteboard»**: `ToolSearch` for «whiteboard» and for «board canvas draw» both answered «No matching deferred tools found». the door is the `Artifact` tool and its type list, never a tool of its own
- **Anthropic's Code docs say the same**: «the artifact templates on your claude.ai account also work from Claude Code»; you need a session with artifacts available, the template on for a Team or Enterprise org, and a claude.ai `/login` ([Claude Code artifacts](https://code.claude.com/docs/en/artifacts) § start an artifact from a template, line 11: «require a session signed in with `/login`»)
- **the conditions**: a paid plan, a claude.ai login (an API-key session cannot publish), and an org without zero data retention for Claude Code («isn't available in Claude Code» there, help page). this mac meets them: the probe ran
- **claude.ai chat, Desktop and Mobile**: create and edit (help page); sharing settings change only on web or Desktop (parallel lane)
- **the API**: no public whiteboard api found by either lane; the store is reached through the Artifact tools only
- **one gap a terminal has**: in claude.ai the board sends Claude an `<artifact-view-context>` block (what dima selected, his viewport, an open comment's pin). a terminal session gets none, so «this box» needs words or a comment pinned to the box

## 3. one board, every surface

- **a board a terminal agent makes opens for dima at its claude.ai link**: an artifact is a private claude.ai url (Code docs); the type fills the same live store the browser draws
- **a board made elsewhere is reachable from the terminal by its url**: the type says to «read all of it (`get` `board/meta`, `list` `elements` with `query: {limit: 1000}`) before your first change to a board this chat didn't make». documented; **not proven**: no board exists yet (`Artifact` `list` with `type: Whiteboard`, `scope: all` → none)
- **concurrent edits are safe by design**: every write pins `if_version`; a write over a newer edit is refused, and the type forbids rebuilding a board («a rewrite would lose what they did»)
- **comments wake a session**: a thread sent to Claude wakes a session that watches the board (`ArtifactComments` `watch`); a plain comment does not, and is read with `read`

## 4. does it answer blueprint v2

the want, from FRM-614: «a pretty drawing door we talk through with comments» (title), «you can draw there very easily and efficiently, I can draw as well, and it should support comments» (W19), «excalidraw is not convenient, slow and ugly» (W9).

- ✅ **both draw**: he drags and sketches in the browser, the agent writes elements; no local file, no PWA copy, so the Excalidraw trial's standing miss is gone («the PWA holds a copy, so each redraw needs his ⌘O», `docs/test-drive/excalidraw.md` § verdict)
- ✅ **comments, both ways**: threads on the board, answered by `ArtifactComments` `reply`
- ✅ **fast for the agent**: one `batch` of up to 50 elements a call, no render step
- ❓ **pretty**: not seen. no board has been drawn, so no shot exists; a hands-on review calls it Excalidraw-like ([chase ai](https://chaseai.io/blog/claude-sheets-whiteboards-data-tested), via exa, not opened)
- ❓ **fast for him**: the editor's feel in his browser is his to judge
- 🚫 **what it cannot do that blueprint v2 wanted**:
  - archify's borrow: a typed flow spec that a script lays out and refuses overlaps «before anyone sees it» (FRM-614 § borrowed). on a board the agent places every coordinate itself, and the type says «you don't see them land»
  - our checks: `pnpm crossings` and the text-in-tile render check run on Excalidraw files; a board lives in claude.ai's store, outside git and our scripts (an `ArtifactData` read could feed a check: new surface, unweighed)
  - files: no import from a file; export is PNG only
  - fidelity: wireframes are shapes and text; the type has no UI component kit. a screen with real parts is an `html` embed, or the **Design** type (listed here too: «a design canvas for … UI mockups, wireframes»), the designer's door already
  - beta: Anthropic may change the type; it carries a release id
- 📌 **two Claude doors, one want**: the Whiteboard for flows, maps and rough wireframes talked through together; the Design canvas for a screen's look. blueprint v2's want reads like the first

## 5. verdict

1. **door**: adopt the Whiteboard as blueprint v2's door on a test drive, never build our own first; the terminal reaches it today
2. **why**: it brings what W19 asks for at zero build: both of us drawing, comments both ways, live in his browser. our own app would be months to the same point
3. **the drive**: one real board first, the mods big picture ([FRM-611](https://linear.app/x-com/issue/FRM-611)). a codie draws it from the terminal and dima edits and comments in claude.ai. the agent answers his threads, and the look is judged from a shot
4. **kill rule**: two boards he calls ugly or slow, or a terminal read-back of his edit that comes back wrong twice
5. **kept from blueprint v2**: the layout-from-spec borrow, as a small script that writes coordinates into a board batch, weighed ⚖️ worth it only if the drive shows the agent's own layout overlaps
