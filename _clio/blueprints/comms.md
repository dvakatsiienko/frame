# blueprint comms — the scored shortlist
📌 decided 2026-10-23: **draw.io** is the blueprint tool, n8n only for automations (`docs/test-drive/blueprints.md` § verdict); the FigJam line below is history.


scored against the grill in `PRODUCT.md`: 3 = a text file in git, 4 = dima adds his own tiles and arrows, 5 = auto-layout. cost = clio's estimated tokens for one edit set (3 renames, 1 new tile, 2 arrows), bytes ÷ 3.5, measured 2026-10-18.

- **FigJam** (figma mcp) — dima's lean, the two mapped boards · 3 no, a cloud file; the board link lives in `AGENTS.md` · 4 yes · 5 no: sections don't auto-size, arrows route themselves but take no waypoints · cost ? (the 10-22 bench) · prettiest so far · limits on Starter + View seat: 20 MCP reads a month, 6 REST file reads a month; drawing (`use_figma`) and comments (REST) unmetered so far (2026-10-21: ~28 calls, no limit hit)
- **n8n** 2.43.7 — primary · 3 via a committed export per read · 4 yes (No Operation tile, F2 rename, drag a handle) · 5 Tidy up · ~131 tokens · bare but clean · dima's gut pick: the automation is right there
- **Obsidian Canvas** — A/B · 3 yes (`.canvas` JSON) · 4 yes · 5 no, clio places tiles · ~94 tokens · plain, fast
- **draw.io** 32.5.5 — A/B · 3 yes (`.drawio` XML) · 4 yes · 5 yes, ELK from the CLI · ~311 tokens · dull, a real desktop app
- dropped: **LikeC4** (no tiles or arrows from its UI) · ranked out: Excalidraw (no layout), D2 (render only), tldraw (license key)
- not a canvas: **OpenUI** — a generative-UI runtime, its own test drive (PK-182)
