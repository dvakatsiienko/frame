---
date: 2026-09-16
slug: the-store-and-sweep-day
tickets: [DOT-237, DOT-250, DOT-251, DOT-187, DOT-27, DOT-39]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the store and sweep day — every extension verdicted, 26 apps hoisted under brew, and a flicker with a name

## shipped

- **the raycast store round** — [DOT-237](https://linear.app/x-com/issue/DOT-237): an opus researcher listed 17 candidates under «popular ≠ useful», dima pulled his own set, and every one got read from the extension source. configured: github (My PRs, Notifications, Search Repos, Workflow Runs, three menu bars, `is:open user:dvakatsiienko` as the search default, no token), google translate (Quick Translate + Translate Form, cross-language ordering on, the `qt` quicklink gone), gif search (favorites as the keep signal, copy never persists), kill-process (path search on, confirmation kept), vercel (deployments, projects, menu bar; the ai-gateway commands need an inference key nobody has). deleted: brew, port-manager (every next app sits on base 3000, a port names a slot), mole, obsidian (never configured, appends make a mess), system monitor, unsplash, the `qgh` quicklink. parked: monobank until a combined currency extension exists, cleanshotx until the capture-area quicklink, screenocr and ray.so as test drives.
- **unsplash's sign-in is the extension's own bug** — its 2026-08-06 «Fix Windows OAuth» pinned a bare `raycast.com/redirect` without the `?packageName` raycast's docs require, so the redirect page says «Connected» and can never deep-link back. found after a `raycast://confetti` probe «failed» because confetti was a disabled command: raycast's log at `~/Library/Logs/com.raycast.macos/` had `No enabled command` in one grep, after an `lsregister` and a `brew reinstall` nobody needed. flawlog: a probe of a door names a target known to work through it first.
- **the /Applications sweep** — a coder read all 69 items, verified 32 casks by codesign team against the cask vendor (not bundle id, which casks do not carry; the check caught `sherlock` → an iOS debugger), found the OpenVPN orphan by reading login items whose url points nowhere. applied: **26 casks adopted** (nuphyio after its own update, `macvim-app`/`neovide-app` under their renamed casks), a Brewfile section, cleanshot's accidental 5.0 receipt removed so a licensed 4.8.10 stays unmanaged. deleted: GitHub Desktop, Otter, Sherlock, Comet, ComfyUI + 1.2 GB, the Draw Things 16 GB model container, the google docs/sheets/slides launchers (root-owned, dima's sudo), the OpenVPN daemon + frameworks, and **28 steam shortcut launchers** in `~/Applications` — `run.sh` → `steam://rungameid`, valid bundles in a user folder, the tails every cleaner skips. SIP apps (Chess, Stocks, Home…) cannot be deleted, unchecked in raycast's Applications tab instead. report: `docs/research/apps-sweep.md`; the `pnpm apps:audit` idea rides [DOT-39](https://linear.app/x-com/issue/DOT-39).
- **the AW3225QF flicker is OLED VRR** — dima's «very subtle, solid colour areas, hard to explain» after switching to Variable 48–240 Hz. QD-OLED throws gamma spikes at particular frame rates, worst on flat mid-tones; apple's own page says pick a fixed rate for non-game use; dell's forum has the same reports. fixed 120 Hz, 240 to taste. story: `dima-stories`.
- **evergreen grows two lanes** — the skills lane now runs every lockfile scope (bytes root, `apps/x-com-chat`'s convex set, global `~/.agents`; the `skills` cli has no machine-wide list or check command, the digest line is the lockfile diff) and a plugins lane for marketplaces without `autoUpdate` and disabled plugins (impeccable sat at 4.2.1 vs 4.3.1 upstream, measured). brew step diffs steam launchers against `steamapps/common`. cclio 0.3.44 → 0.3.46.
- **tickets born**: [DOT-250](https://linear.app/x-com/issue/DOT-250) «test drive: tech, tools» — the pool sibling of [DOT-187](https://linear.app/x-com/issue/DOT-187) (renamed «test drive: skills»), seeded with raylib (C99 game framework, weak TS lane, a Zig/Go tinker) and vgpu (vercel-labs' WebGPU shader layer, the one worth a spike), then the video's four: leaf, glow, tuxedo as dima's test drives, lazyrsync looked and skipped. [DOT-251](https://linear.app/x-com/issue/DOT-251) — yt-transcript gains a local audio/video-to-text fallback under the skills story, whisper.cpp shared with [DOT-27](https://linear.app/x-com/issue/DOT-27).
- **ghgrab, measured and dropped** — `agent tree` / `agent download` return a clean json envelope on a mid repo (3.8 s, one level per call), and hang past 60 s on vercel/next.js for both a tree and a single file, burning ~19 api calls; `gh api …/contents/<path>` does it in 0.6 s, the recursive tree in 1.5 s. uninstalled the same day, the agent stays on `gh api`.
- **smaller**: groq through a gateway researched (vercel ai gateway BYOK needs purchased credits, openrouter takes 5 % on BYOK, neither keeps the free tier for free; x-com-chat stays direct, the unused `OPENROUTER_API_KEY` deleted); gron dropped after the usage vet (0 hits vs yq 3, sd 18); the coder linear identity vet resolved, both app identities stay; yt-transcript writes `mode` into metadata so a dead transit is provable (x 0.11.76); dotfiles pushed after 38 unpushed commits.

## tricks gained

- a raycast deep link that «does nothing» is read from `~/Library/Logs/com.raycast.macos/raycast-x-*.log`, never inferred — the scheme, chrome's allowlist and launchservices were all fine
- `brew install --cask --adopt` refuses a version mismatch (nuphyio) but wrote a 5.0 receipt over a 4.8.10 cleanshot; a `pkg` cask cannot adopt at all; cask↔app identity is `codesign -dv` team vs the cask homepage vendor, `brew search` is a guess and `brew info` the check
- the `skills` cli: `list`/`update` see cwd or `-g`, never both; global lockfile is `~/.agents/.skill-lock.json` (v3), project ones `skills-lock.json` (v1)
- a disabled claude code plugin does not auto-update; only marketplaces with `autoUpdate: true` refresh themselves (`x`, warp here)
- macos 27's «Data Access Blocked» toast names the claude code binary version (`2.1.273`) when a session reads another app's data folder
- steam «add desktop shortcut» writes a `.app` into `~/Applications` that survives the game's uninstall; cleanmymac, pearcleaner and mole all skip it
- tuxedo's todo.txt body is a `note:<path>` sidecar per task, opened with `o`/`O`; `ls --json` exists
- pnpm blocks a package's postinstall binary fetch by default: `pnpm add -g <pkg> --allow-build=<pkg>`

## state

- dotfiles `e0c057a` on origin, the halt flush to follow; bytes: x-com-chat prod red since evergreen #87 (jotai 3), parked to the next bytes session
- dima's tools · next overhaul · 21/25 — DOT-237 stays In Progress; phase 4 opens with the pre-research rounds tomorrow
- no coders (the sweep coder stopped after its retro), no worktrees, halt16 CST still parked
- reminders due: greptile-ci decision + BYT-94 (deferred by dima), hotkey refresh at the phase 5 boundary

## trail

- shipped: raycast store round (github, translate, gif, kill-process, vercel configured; 6 exts deleted), /Applications sweep (26 casks adopted, 28 steam launchers gone), AW3225QF flicker = OLED VRR → fixed 120 Hz, evergreen skills + plugins lanes, DOT-250 + DOT-251 born, ghgrab dropped
- open: greptile-ci decision (due 09-16), x-com-chat prod red parked to the next bytes session
- state: dotfiles pushed at e0c057a; no coders
