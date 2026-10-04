# tooling — the tool picks, split by surface

**scope:** which cli does which job. the `shared` section is copied by hand into
the cw leaf `/areas/tooling.md`; the `cc only` section never leaves the mac cli.

## shared — cc and cw

- **cli over mcp, whenever possible** — an mcp only earns its place in a complex multi-surface,
  multi-person collab case, which is currently nowhere in this setup; everywhere else it only
  hurts (resident schemas, slow, expensive). no gmail / slack / notion mcp exists here — the
  clis below are the doors
- **1password holds every api key** — vault `dev`, item `<service>-golden` (the shared key) or `<service>-<purpose>` (a scoped one)
  - configs carry `op://dev/<item>/credential`, never a value; reads run through `script/op-run.sh` (service account `x-fleet`, read-only, no touch id)
  - `op item create|edit` works from an agent shell through his desktop session; dima pastes the key value in the app
  - an item an agent creates carries: `--url` where a new key is minted, a one-line note (what it unlocks, which config reads it), tags `fleet` + the surface (`cc`, `cw`, `raycast`), the account, and the expiry when the service sets one
- **pnpm** — preferred package manager for node/typescript/javascript projects
- **obsidian = raw files, the `obsidian` cli only for rename/move and the link graph; notion = `ntn`; never an mcp for either** — measured 2026-09-10 (DOT-228): the mcp lanes lose on every metric, the notion connector costs 34× the time of `ntn` per edit. the recipe and the hazards: `x:notes`
- **himalaya** — the mail cli (`himalaya envelope list`, `message read <id>`, `message delete`, `message reply`); one gmail account, app password from 1password `gmail-himalaya-golden`, config in `home/.config/himalaya/`. filters are not its job — those are `gmailctl` over `gmail/blocklist.json`
- **slk** — slack cli (package `slkcli`; binary is `slk`, auth rides the slack desktop session; `slk --help` is the whole api)
- **jq** — prefer it for JSON parsing, filtering, and transformation
- **code examples across public github → `grep-mcp` first** (regex over ~1M repos, deferred, ~0 resident cost); `gh search code` only for one known repo — no cli exists for grep.app
- **rg** (ripgrep, `brew "ripgrep"`) — the regex search over files; the Grep tool runs it too. 65 docs search in ~15 ms, so a doc is findable the moment it exists (2026-09-30)
- **yq** — yaml/toml read-write (`settings.toml`, lefthook)
- **sd** — in-place text replace without sed's macos `-i ''` traps
- **trash over rm** — `trash <path>` moves to the recoverable macos trash; prefer it wherever a deletion is approved but regret is possible
- **install order for any tool** — `brew` (formula or cask) first; not in brew → `pnpm add -g`; never `npm -g` (dima, 2026-09-18)

## cc only

- **fnm** — node version manager, use if needed
- **package.json** — exact pins, `npm view` before any version, script order and `family:name` keys: the whole shape is `x:guide-conventions` → `conventions/package-json.md`, read before printing or editing any manifest
- **ctx7** — context7's docs cli, on trial vs the context7 mcp to 2026-10-07 (`docs/test-drive/ctx7.md`): `ctx7 library <name>` → id, `ctx7 docs <id> "<query>"`; a library it lacks → `WebSearch`
- **archives → keka's bundled binaries**, `/Applications/Keka.app/Contents/MacOS/Keka --cli <bin>` — `7z` `7zz` `unar` `unrar` `tar` `xz` `zstd` `brotli` `lz4` `lzip` `pigz` and friends. macos ships no `unrar` and no 7z at all, so this is the only door to those; plain `zip`/`tar`/`ditto` still handle the ordinary cases
- **big or tiny images → crop with pillow first.** a screenshot up to ~2000 px is read directly (≈3k tokens); a larger image, or a detail under ~20 px (a sprite, an icon, a chart tick), is cropped or zoomed with pillow (`from PIL import Image`, installed) and the crop is read (≈300 tokens) — the harness downscales big images and small text dies
- **uv** — the Python package manager here; pip in any form is not used
  - `uv pip install <package> --system --break-system-packages`, or `uv venv` + `uv pip install`
- **app removal, a cask** → `brew uninstall --zap --cask <name>`; the cask traps: `docs/knowledge/macos-admin.md`
- **app removal, anything else** (app store, dmg, hand-installed) → `mo uninstall` (mole): takes the root-owned bundle and its residue in one pass, where `trash` is refused
