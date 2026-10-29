---
name: notes
description: Load BEFORE any read or edit of an obsidian vault note or a notion page — «inbox», «the obsidian vault», «obsidian», «notion», «all notes», «edit the note», «append to inbox», «rename the note», «update the notion page», a vault path, a notion url. Not for a 1password vault or item.
---

# notes — the channel per op, measured

one suite, six lanes, 2026-09-10 (`docs/test-drive/notes-stack/results-2026-09-10.md`). the
pick per op is the cheapest lane that does not break the vault; nothing here is a preference.

## obsidian

the vault's hazards first (the cloud chat leaf `/topics/obsidian.md` keeps a hand copy — an edit here is
copied there by hand):
- the vault is **not under git** — no undo, no history; a bad overwrite is gone
- **writes only when dima asks**, except clio's inbox reset and pocket mirror (`habit-shared-files`); reads anytime
- 🚫 **icloud sync is whole-file, last-writer-wins, no conflict copy**: never edit before the synced
  version has arrived (sync lags minutes after obsidian opens; a relaunch often forces the pull), keep
  obsidian closed on the ipad during a session, and re-read right before every write
- a lost edit → `pnpm -C ~/frame --silent notes-obsidian-recover '<text>' --note <vault path>`: every desktop snapshot holding the text, and the lines today's file lacks. it reads the file-recovery store (IndexedDB, snappy `.ldb`, UTF-16), which `strings` and `rg` miss; the tablet keeps its own store, opened in its File recovery settings

- **read · append · property edit → raw files.** `cat`, `>>`, a frontmatter edit in place. 2–5 ms
  per note, payload only, nothing to time out. the vault lives at
  `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/`.
- **rename · move → the `obsidian` cli, only.** `obsidian vault="Obsidian Dima's Vault" rename
  path="<dir>/<note>.md" name="<new name>"` rewrites every wikilink through the running app
  (231/231 in 0.4 s); a plain `mv` breaks every one. needs the app open.
- **link graph → the cli**: `backlinks` · `unresolved` · `orphans` · `deadends` · `search
  query="…" format=json` (off obsidian's index, 24 ms, half the bytes of a grep).
- 🚨 **drive the cli with `timeout 15 … </dev/null`, and judge a rename by the file landing**
  (`until [ -f "<new path>" ]`), never by the process returning — it hung on a read and on a rename
  that had already finished. an open stdin in a script makes it eat the loop.
- **a note's icon is its `icon:` frontmatter** (iconize reads it) — live-safe, obsidian may stay open.
- 🚫 **a plugin's `data.json` is written only with obsidian closed** (`pgrep -x Obsidian` first) — the plugin holds it in memory and saves over an outside edit. folder icons live only there (iconize), so they wait for dima to quit the app.
- a vault `AGENTS.md`/`CLAUDE.md` never loads — lazy nested memory stops at the working tree, `--add-dir ~` included (probed 2026-09-23). vault knowledge lives here.
- `property:set` reformats the whole frontmatter (inline lists → yaml lists). fine, diff-noisy.
- 🚫 the `Local REST API` plugin / any obsidian mcp: 5× the cli, no rename endpoint. not installed.

## notion

- **a page → `ntn`** (`brew "notion-cli"`), always run as `~/frame/script/op-run.sh ntn …`: the token is `op://dev/notion-api-golden/credential` in `op.env`, and a bare `ntn` has none (exit 4). `ntn api` reads a body from stdin and waits forever without one: give it `-d` or `</dev/null`. `ntn pages get <id>`
  returns markdown (~170 bytes a page); `ntn pages create --parent page:<id> --content '# title …'`;
  append = `ntn api /v1/pages/<id>/markdown -X PATCH --notion-version 2026-03-11 -d
  '{"type":"insert_content","insert_content":{"content":"\n…\n","position":{"type":"end"}}}'`.
- **a batch → `xargs -P4`** over `ntn`, or the raw api at concurrency 4. gains stop at 4; at 8 notion
  throttles and drops results. every call `</dev/null` — `ntn api` hangs on an open stdin.
- `ntn api` needs `-X PATCH|POST` and a bare `/v1/…` path; `ntn pages trash` needs `--yes`
  non-interactively; writes echo the whole page — `| jq -r .id` to keep the reply small.
- **access is by nesting, never by link**: the `ntn-agent` integration reaches a page only under a
  root it was granted (games · job · dev · cooking · cool names, 2026-09-17); a page merely
  mentioned on a granted page 404s. grant a root once, nest under it; notion has no workspace-wide grant.
- `ntn pages edit --content` replaces the whole page — block-level patching goes through `ntn api`.
  an icon is `ntn api /v1/pages/<id> -X PATCH -d '{"icon":{"type":"emoji","emoji":"📷"}}'`
  (`pages create` has no icon flag; dima wants every page iconed).
- `WebFetch` on a notion url returns the app shell, never content — notion is `ntn`-only.
- 🚫 the notion connector (hosted mcp) for edits: one paragraph cost 23 s and 5 tool calls, `ntn`
  did it in 0.7 s and 271 bytes; it is disconnected.
