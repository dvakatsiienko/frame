---
date: 2026-09-17
slug: the-quicklinks-day
tickets: [DOT-237, BYT-101, BYT-102, BYT-86]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the quicklinks day — seven links with a grammar, the blue capsule dies, and every chord gets a name

## shipped

- **quicklinks sealed** — [DOT-237](https://linear.app/x-com/issue/DOT-237): a pre-research round found the only real corpus is raycast's own gallery and the rule «a quicklink earns its slot only with an argument or a path». seven live: `qy qg qd qh ql qs qt`, alias grammar `q` + letters, argument names `query` / `id` / `text`, linear-by-id as one arg so a hotkey passes the selection. the import deeplink lives under `raycast/quicklinks/…` — two failed tries went to manual paste before raycast's log named the wrong id in one line. raycast skips duplicates on import, so an update is delete + re-import + alias retyped; a double-click installer sits on the desktop. a second research round proposed six more (`claude://claude.ai/new?q={selection}`, obsidian inbox append, cursor prompt, linear new issue); dima took none — quicklinks are enough for one head.
- **cleanshot under raycast** — the store extension replaced the cleanshot quicklinks; `⇧⌘0–9` sealed (1 window · 2 ocr · 3 full · 4 area · 5 scroll · 6 aio · 7 history · 8 annotate · 9 record · 0 clipboard) with the reshuffle due from `hk` stats in two weeks. export location → `~/Desktop/screenshots`, desktop now icloud-synced; stitching = annotate drag-drop on mac (the only door, verified) and «Stitch Screenshots v4» shortcut on both platforms (combine 16 px → png → clipboard → ask-where-to-save, ✅/❌ notifications).
- **the blue caret capsule is off globally** — three research rounds said no global fix on macos 27 (`TSMLanguageIndicatorEnabled=0` made the birman ukelele layout vanish from TIS). the cause was never the os: with the pref off TIS derives custom-layout ids from the `.keylayout` name and ignores the bundle's plist, so select-by-id fails and select-by-**name** works. the three layout script commands now select by name and print a flag pill (`🇺🇦 🇷🇺 🇺🇸`). on the way: the bundle moved to `/Library/Keyboard Layouts` with a quarantine flag to strip, the U.S. layout removed by the plist trick, russian birman re-enabled through a 12-line swift.
- **`hk` names chords** — the hotkey monitor's reader prints `chord  action · app` from the manual map, with `since`-dated rows so a reshuffle never relabels the past; system chords labelled (paste, word moves, spaces from the scan), wispr's `paste_event` hook dropped as a binding. dima edits the map himself. `cmd+tab` 1835, `opt+esc` read-aloud 1550, `⇧⌘4` 334 over 30 days.
- **project manager, one list** — cursor's `projects.json` is the curated set (tags `1 core · 2 bytes · 3 config · 4 lab`, the digit is the group order because the raycast ext sorts tags alphabetically); `pnpm projects:sync` in bytes writes every app and package under `2 bytes`; the cursor recent-projects ext deleted, the Project Manager ext reads the same file. `ca` dies when the sync lands.
- **cw's game-notes thinking folded** — [BYT-102](https://linear.app/x-com/issue/BYT-102): one record per game in trophy-sys's redis, patchable by cli, «rethink first» with dima's frame verbatim (simplify cowork's access, never swap one unoptimal approach for another; obsidian as the alternative); `docs/research/trophy-sys-notes-store.md` with the lost-guide incident and the checklist; cw's f1–f8 into [BYT-86](https://linear.app/x-com/issue/BYT-86)'s candidates. batch d flushed the same evening: notion grants-by-nesting into `x:notes` (x 0.11.77), tracker data shapes into trophy-sys's guide, `.node-version` repinned to `24` in both repos (fnm had no 24.0.2, every shell prompted).
- **smaller**: [BYT-101](https://linear.app/x-com/issue/BYT-101) hosting split research (next stays on vercel, vite ejects — dima's seven vectors, blocked on whether the deploy cap still bites) · hide.me picked by research (only free tier with a real country picker), installed, NL exit ~2× latency vs 7× for US, `1.1.1.1` dead through it, dima dislikes the ui — a «pretty» round later · glow's file-list paging bug filed upstream ([#1037](https://github.com/charmbracelet/glow/issues/1037): `paginator.Model{}` leaves the keymap empty; `f d b u` work, `h l ←→` do not) · linear mobile notifications: no cross-device dismissal exists, the lever is the account-level mobile push types.

## tricks gained

- raycast's log at `~/Library/Logs/com.raycast.macos/raycast-x-*.log` explains every «nothing happened» deeplink — third time it beat inference this week
- a raycast quicklink with two arguments cannot take the selection on a hotkey; single-arg only
- `TSMLanguageIndicatorEnabled=0` changes how TIS names custom layouts, not whether it loads them; select by display name
- macos removes an input source from the plist only through `defaults import` of the filtered `AppleEnabledInputSources` array (the U.S. layout has no minus button once it is the fallback)
- the raycast Project Manager ext sorts tag groups by raw string; a leading digit orders them
- `shortcuts sign` refuses a `.plist` input and takes the same file as `.wflow`; «Continue» on no input is the absence of the behaviour key; Run Shell Script is mac-only, Save File with ask-where is the ios path
- a `.node-version` pinned to a patch that fnm lacks prompts in every shell of that tree; pin the major
- `mas install` cannot fetch a free app the account never «got»; one app-store click, then the Brewfile line works
- github refuses labels from non-collaborators without an error worth the name (`failed to update 1 issue`)

## state

- dotfiles 5 commits unpushed (`7cb4ded`); bytes 1 unpushed on a tree 2 behind with untracked design docs + regenerated convex files — rebase at the next bytes session
- dima's tools · next overhaul · 21/25 — DOT-237 In Progress, phase 4 aliases slice next (pre-research first)
- no coders, no worktrees; halt16 CST still parked; x-com-chat prod red still parked
- reminders born: cleanshot reshuffle on/after 2026-10-01, node pin drift

## trail

- shipped: 7 raycast quicklinks (`q`+letters grammar), cleanshot ext under `⇧⌘0–9`, caret indicator off globally (select layout by name), `hk` chord labels, cursor projects.json as the one project list, BYT-102 game-notes model folded
- open: DOT-237 phase 4 aliases slice (pre-research first), then snippets, script commands, phase 5 hotkeys
- state: dotfiles 5 unpushed, bytes 1 unpushed on a tree 2 behind; no coders
