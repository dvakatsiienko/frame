---
name: herdr-customize
description: Load BEFORE changing herdr itself — a herdr mod, a herdr layout, its `keys.json`, `settings.json` or `programs.json`, anything under `~/.config/herdr-app` — «herdr mod», «a panel in herdr», «fleet-board», «x-herdr-deck», «zoo mod», «herdr layout», «tweak herdr».
---

# herdr-customize — building inside dima's herdr

a mod is JavaScript that describes native GPUI elements; Rust draws them. no HTML, no CSS, no web view, no Node APIs. layouts, keys and settings are JSON, hot-reloaded on save. load `x:herdr` too: its doors (`shot`, `status`) are this loop's proof.

## 0 · read the truth for this version first

```sh
herdr-app --skill                                         # «Customize layouts, keys, or mods»
sed -n '/^## Mods/,/^## herdr-core/p' ~/.config/herdr-app/AGENTS.md
```

- `~/.config/herdr-app/AGENTS.md` (62 KB, about 15k tokens) and the type files beside it, `herdr.d.ts` (the app's data) and `gpui-kit.d.ts` (elements, 790 KB), are herdr's: read the section or symbol you need, never quote them into our files, never edit them
- the `.d.ts` files beat this skill, AGENTS.md and memory: herdr ships near-daily (0.1.4 → 0.1.14 in 16 days) and mod semantics changed in a patch release
- the other sections by their headings: `## Layouts`, `## Keys`, `## Commands`, `## Programs`, and the person's settings (`sed -n '/^## The person/,/^## Programs/p'`)

## the loop, every save

```sh
herdr-app check ~/.config/herdr-app/mods/<name>    # a folder path, never the bare name
herdr-app status                                   # mod and file errors the window holds
herdr-app shot /tmp/<name>.png                     # then read the png
```

- 📌 a linked mod's save needs a herdr restart before the shot shows it (§ where our mods live)
- 📌 `check` renders the mod once and never runs async reads, deferred rows or later states: only the shot proves the data arrived, so «check passed» is never «it works»
- herdr's manual holds the rest of the loop (a broken save, the reset key): `herdr-app --skill`, «Customize»

## types — JS with a TypeScript check

- herdr loads only `.js` mods; its guide names no TypeScript and its repo shows no plan for it (0.1.14). dima, PK-363:W69: «ok lets do for now. would be good to have native ts support» — JS with a JSDoc check now, native TS the day herdr ships it
- each mod's `jsconfig.json` is written once and is ours after: `checkJs` and `strict` on, `strictNullChecks` off by design
- the check: `pnpm -C ~/frame exec tsc -p ~/.config/herdr-app/mods/<name>/jsconfig.json` (pass the file; `-p <dir>` looks for a `tsconfig.json`). types come from JSDoc: `/** @param {string} path */`
- `x-herdr-deck` fails it today with 46 implicit-any errors (run 2026-11-09): a mod we own reaches 0 before its chunk closes

## where our mods live

- 📌 a mod's source belongs in `~/frame/home/.config/herdr-app/mods/<name>/`, so it gets git and our gates; it reaches herdr as a real folder, copied by `pnpm herdr-mods:land <mod>` (`--watch` lands each save that passes `herdr-app check`)
- 📌 a mod outside the mirror (herdr's own, zoo's) has no undo: copy the folder aside before a rewrite
- 📌 a mod linked into herdr never hot-reloads (a write through the link sends the watched dir no event), so no mod is linked: a landed real folder reloads live
- a shipped mod or layout belongs to herdr and is replaced on every start; our copy comes from `mod.clone` or `layout.clone` and never takes upstream fixes, so it is diffed against the new shipped one at each herdr update
- 📌 `layout.clone` switches dima's shown layout to the clone: ask before running it
- 📌 a `layouts/` save has killed a thread: its ask says so
- one mod per idea; touch only the mod or file the job names

## building blocks we paid for

- `TextView`, `v_flex`, `h_flex` import from `gpui-base`; `View` and `div` from `gpui-kit`
- a percent width is a string: `"40%"`
- text dima can select comes from `TextView.markdown(id, md).selectable()` (or `TextView.html`): anything he reads or copies goes through it
- live data: `watchFolder(dir)` in a `cx.spawn` loop, never polling
- `exec` is buffered and returns on exit; a stream needs a sidecar over the `net` or `websocket` client, or a file the sidecar writes and the mod watches
- `on_drop` hands a mod dropped file paths
- 📌 macOS `ps` has no `etimes=`: use `etime=` and parse it. `exec` resolves with `{code, stdout, stderr}` on a bad flag: a mod that reads only `stdout` shows nothing and no error, so check `code`

## the fleet's state a mod reads

- `~/.claude/sessions/*.json` — live sessions, one file per pid
- `~/.claude/plugins/store/x-mod-stash_inline-*.json` — the stash store: keys `model:`, `context:`, `asks:<sid>`, and `reply:<sid>` with its `.wait`; one shared file, read-only from a mod
- `~/.claude/shelf/lanes.json` — the glide cards
- a mod never writes a cc session's state; a tick or a steer goes back through the file the stash mod reads for it, or `hc send`

## what a mod cannot do

- draw into a pane from an outside process: every native pane is an in-app mod
- show a web page: the near door is an `agent-browser` screenshot shown in a pane
- import a package by name from `node_modules`: a pure-compute library vendored as a file in the mod's folder imports by relative path (proven 2026-11-10, a 72 KB markdown parser under `herdr-app check`), and one joins only where it computes something we would otherwise hand-write
- undo an edit to a mod outside the mirror: only the copy you set aside
