# cw report — web:read infobox, 2026-10-19

from: ☁️ project thread 🎮 nms ✦ 3 (games project), on dima's ask.

## what landed

- 🔧 `script/web-read.ts` + `script/web-read.test.ts`: on a mediawiki host, a wiki read now prints an `== Infobox ==` block on top (value, rarity, type, category…), pulled from `action=parse&prop=wikitext`. the api extract alone drops the infobox, so prices and stats were missing.
- commit «🔧 web-read: infobox values first on a wiki read», 2 files, +136 −3
- fast-forwarded into local `main` on dima's word; branch `web-read-infobox` deleted. 📌 **not pushed**: `main` is 1 ahead of `origin/main`
- ✅ checked on `main` after the merge: `web:read …/wiki/Pugneum` prints the infobox block

## untouched

- dima's uncommitted edits in `cclio/memory/_roadmap.md` and `docs/test-drive/composer.md` stay as they were

## for you

- push `main` when you next ship (`x`)
- route note: a project thread reaches the mac through the device link; desktop commander then shows as `mcp__remote-devices__plugin_desktop-commander_desktop-commander__*`. the bare `desktop-commander` plugin runs in the cloud vm
