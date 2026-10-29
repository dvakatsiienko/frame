---
date: 2026-09-18
slug: the-perf-mini-session
tickets: [DOT-218, DOT-215, DOT-187, DOT-237, DOT-252, DOT-14]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the perf mini-session — the fleet measured, a verifier gets a spec, and the boot becomes one script

## shipped

- **the flow measured** — dima's ask: where is the flow leaking. numbers from the transcripts: cclio boots at 106–135k, runs 20–25 h sessions to 600k+ context, 8–11 tool rounds per human prompt, 100–240M cache reads a session; bytes 4 commits in 5 days vs 339 dotfiles commits in 21. verdict: the coordinator is the leak, then bytes starvation, then the review gate. dima's frame back: his own ux upgrades (raycast, hotkeys, quicklinks) are fleet upgrades — «you have a more capable operator now» — and root `CLAUDE.md` now says so in one line.
- **the verifier, researched and specced** — [DOT-218](https://linear.app/x-com/issue/DOT-218) un-parked. two research lanes: an opus researcher over 32 primary sources (no product IS the role; anthropic's `claude-security` plugin is the template — refute-not-confirm, a verdict computed in code, «not examined ≠ clean»; openhands' stop threshold 8.0 → 1.35 attempts), then `neuroarxiv` over 25 papers, which changed the design three times: **the verifier's first run is a tamper pr it must refuse** (vacuous pass, 75/112 refusal sites deletable with every check green), the merge stakes stay out of its prompt (14–17 pp drift), the coder gets the failing criterion never the located fix. panel dropped. spec = `x:verifier-brief` (x 0.11.79): exit lines in the ticket, execution first, owns the ci reviewer, one ≤12-line prompt per round, cap 2. `x:coder-brief` step 3b reroutes «final»; `craft-spawning` carries the pair-spawn line and the model trial (pr 1 opus high, pr 2 sonnet high, the ci reviewer as control). research: `docs/research/verifier-identity.md`.
- **the boot is one script** — [DOT-215](https://linear.app/x-com/issue/DOT-215) done: `boot-prefetch.sh` prints every check with a status line in 6 s (handoffs, inbox, x-queue, roadmap, reminders, live sessions + worktrees + coder prs, renovate, repos, symlink, flawlog tail), `🚨 FAIL ·` per check that cannot run, a stamp + a stale re-run from `cclio:init` for the evening-clear / midday-boot case. ~12 rounds → 0–1. proven red then green. cclio 0.3.48.
- **gazette → trail** — five posts resident (30 KB) became `_trail.md`: three lines per day, shipped / open / state, 2.4 KB. every post ends with `⸻ upd 21:05 — the script-commands slice became x-ray

## shipped
- **x-ray, one private raycast extension** ([DOT-237](https://linear.app/x-com/issue/DOT-237)): `linear query tickets` (title + body + comment search, opens on the 25 recently updated, an id as argument or selected text opens the ticket, tab reuse), `linear query projects` (linear's own icons, progress, lead), `handoffs` (browse the shelf, ⏎ read, ⌘⏎ paste the cclio init line, ⌘⇧⏎ the ingest line), `currency` (monobank shape, typed amount converts every row), `schedule` (every `com.dima` launchd agent: what, when, state, exit, next fire). one extension-level linear key. the monobank and official linear extensions died, the linear script command and three quicklinks with them.
- **`x-screenshots-autoclean`** — a signed swift helper under launchd, daily 12:00, screenshots older than 30 days into `~/.Trash`, proven exit 0 from launchd; the «what did you schedule» view is x-ray's `schedule`, the cli version is on [DOT-14](https://linear.app/x-com/issue/DOT-14).
- **verifier rebalanced** (x 0.11.80) after the research: reviewers gated P0/P1 on the verifier's side, repro not patch, a misapplied math citation out, round wall-clock measured; coder runs coderabbit first, greploop as the fallback.
- **ci-watch** — failed gh runs + vercel deploys at boot and as a plugin monitor (silent unless new); it caught two real reds in its first hour.
- **`pnpm toolchain:sync`** owns `.node-version`, `packageManager`, `engines` in both repos from the installed node + pnpm; renovate is told off those pins (#41 had re-pinned node to a patch fnm lacked).
- claude.ai plugin + skill sync into the terminal off (~40 resident tools gone); `ca` func, tuxedo, otter gone; leaf on gruvbox, [RivoLink/leaf #287](https://github.com/RivoLink/leaf/issues/287) filed; [raycast/extensions #31269](https://github.com/raycast/extensions/issues/31269) filed (Dev Servers misses next 16).
- [DOT-252](https://linear.app/x-com/issue/DOT-252) born: the ray-hoist candidate list, fed by repeated asks only.

## tricks gained
- `ray build` registers no new extension and skips tsc under typescript 7 — `ray develop` once, `pnpm typecheck` as the gate; raycast caches titles and icons until a relaunch; a hotkey command that acts must `popToRoot` or the next press re-enters it.
- FDA on a launchd binary does not unlock `trashItem` on an iCloud desktop; a plain move into `~/.Trash` works; `plutil` drops plist comments; `launchctl print` nests `state`.
- a `pnpm install` in a non-member subdir climbs to the workspace root; «no worktree» means on `main`, no branch; a pr's base needs a `PATCH base=main` nudge after a main push.
- the cursor save blip was `editor.accessibilitySupport: on`, not a signal setting.

## state
- DOT-237 In Progress, phase 5 hotkeys next (pre-research + dima's binding list first); memory-bridge-halt16 parked; bytes: 1 push (renovate pins), no product work; x-com-chat prod red parked; 0 unpushed.

## trail
- shipped: x-ray raycast ext (5 commands: linear tickets/projects, handoffs, currency, schedule), x-screenshots-autoclean under launchd, verifier rebalance, ci-watch monitor, toolchain:sync + renovate off pins, claude.ai sync off, DOT-252 hoist list, verifier spec + boot digest (morning)
- open: phase 5 hotkeys (dima's bindings + pre-research), verifier trial at the next bytes spawn, memory-bridge-halt16 parked, x-ray:icon script freebie
- state: 0 unpushed both repos; no coders; bytes untouched another day
