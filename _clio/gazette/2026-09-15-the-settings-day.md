---
date: 2026-09-15
slug: the-settings-day
tickets: [DOT-237, DOT-14]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the settings day — raycast verdicted top to bottom, four mail apps come and go, and a blank square is bartender

## shipped

- **raycast phase 3, every built-in entry** — [DOT-237](https://linear.app/x-com/issue/DOT-237): Applications through Window Management verdicted by eye, one screenshot per entry. off: MCP, Screen Awareness, Focus, Teams, Dictation, Translator, Developer, Browser, Dictionary, Raycast Settings, every Ask-* AI command, the volume and media system actions, eject-all-disks (it wanted to eject xcode's simulator cryptex). on and tuned: clipboard 3 months + 1password excluded, screenshots scoped to cleanshot's `~/Library/Application Support/CleanShot/media`, calculator (7 usages listed, `⌘↵` pastes), emoji pins + custom keywords, snippets settings, system settings pruned to the panes that exist on this mac. window management, typing practice and the app list parked to the hotkey round. progress comment on the ticket as cclio.
- **store items owned** — 1password extension uninstalled (three commands, worse than the app's own quick access), linear trimmed to Search Issues + Search Projects with a custom copy action that emits the fleet link format, svgl to Search SVG Logos, color picker to pick / convert / names (hex lower case; Pick Color is a hotkey candidate), clean keyboard and speedtest kept. next session: the store research round, «popular ≠ useful» as the filter.
- **the handoff filename** — `<for>--<lane>--<topic>--by-<author>--<stamp>.md`, lanes pm · code · research · design, a `rename` verb on the store cli (a rewrite would have reset the file's age), writer flags on the cli, the cw mcp schemas and `x:handoff`; the boot prefetch prints one lane line per pending CST and its audience tag is a whitelist. three coder rounds, `459486c` / `18cd7de` / `69af434`; x 0.11.75, cclio 0.3.43. `x:handoff` now ends every write with the ribboned pickup block Dima pastes into the next thread.
- **script commands** — `bartender-toggle.sh` (`tell application "Bartender 7" to toggle bartender`, so `hyper+B` lives in raycast), `currency-mono-convert.sh` (monobank's real buy/sell, an amount converts at the sell rate; the inline rate line was deleted on his word), `hotkey-monitor:top --limit 0` lifts the row cap (79 → 213 lines). daemon stays swift: purego covers the tap but not the AppKit half; the reader goes go+charm as the cli's first command, decided at [DOT-14](https://linear.app/x-com/issue/DOT-14).
- **mail** — Notion Mail (shuts down 2026-09-22), Mimestream, Proton Mail and Edison removed; Marco (app store, free, no AI) and Newton (rebuilt 2026-06 by a new team, free plan) on trial, Newton took `hyper+S` from Spark Classic. Superhuman Mail starts at $33/mo, Fathom is a meeting recorder, both verified on the vendor pages. `mas` joined the Brewfile.
- **macos 27 fallout** — rosetta was gone after the upgrade; back for Battle.net (the brew cask is an installer artifact, run once, blizzard has no silicon build and no roadmap). Bartender 6 → 7 (paid discount, the 6 license predates the free window), settings clean by design. AppCleaner's `SmartDelete` helper had run out of the Trash for two days; unloaded, Trash emptied. brew itself had jumped 4 → 7 on 09-14 through its own auto-update during a cask install; evergreen reads `brew --version` now.
- **gmail** — the inbox backlog archived server-side with «select all conversations that match» in most-recent sort; an apps script was ready and found nothing left.
- **cleanshot** — cloud uploads off, file to clipboard on, `Hide desktop icons while capturing` was the grey-wallpaper cause; the 2.4k cloud uploads stay parked (no api, the docs-api page is a url scheme).

## tricks gained

- the raycast «Applications» tab is the hotkey/alias layer; Auto Quit applies only to listed apps; built-in extensions disable, never uninstall
- raycast hotkeys are modifier + one key, no chords; nesting needs Leader Key.app or karabiner, both parked
- a script command in `inline` mode shows only the first stdout line and takes no argument from root search; a required argument on a `compact` command opens a field
- `mas install` works only for apps already «gotten» on the account; `mas search` misses apps that are not in the mac store
- the Focus (do-not-disturb) menu bar item cannot be moved by bartender; System Settings → Control Center → Focus → Never kills the layout shift
- a gui uninstall that trashes the bundle keeps its login items alive — `sfltool dumpbtm` shows them
- `arch -x86_64 /usr/bin/true` is the one-line rosetta probe
- newton is two-pane by design, no preview pane, a standing feature request

## state

- dotfiles 31 commits unpushed by Dima's standing word, tree clean after the flush; bytes untouched; no coders (df518a23 stopped after four jobs and a retro), no worktrees
- dima's tools · next overhaul · 21/25 — DOT-237 stays In Progress at the store round
- reminders: hotkey refresh + skippable checkpoint at the meta boundary; bartender 7 under brew when the cask moves; the /Applications-vs-brew sweep plus a delete pass on apps and macos built-ins next session

## trail

- shipped: raycast built-ins verdicted top to bottom, store items owned (1password ext out, linear trimmed), handoff filename with lanes + `rename` verb, bartender/currency script commands, 4 mail apps out (marco + newton on trial), gmail backlog archived, cleanshot cloud off
- open: store research round, hotkey round after the settings walkthrough
- state: dotfiles 31 unpushed by his word; no coders
