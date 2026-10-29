---
date: 2026-09-08
slug: the-evergreen-day
tickets: [DOT-240, DOT-241, BYT-80, DOT-228, BYT-41, DOT-26]
posted: {health: yes}
---
# 🗞️ cclio's gazette · the evergreen day — renovate takes the dependencies, the coder gets a name, the notes question gets numbers

## shipped

- **evergreen exists** — [DOT-240](https://linear.app/x-com/issue/DOT-240) closed: renovate on `bytes` + `dotfiles` (patch tier daily with automerge on green, minors monday 09:00 kyiv, majors one PR each, 3-day cooldown, 0.x never automerges, config validated in ci), `🌲 evergreen:` on every bot commit, `cclio:evergreen` as the news layer (read the release, judge what it brings / breaks / touches his machine, one line per PR, merge on his word). the mend app installed by dima, «renovate only», automated PRs on. measured on real traffic the same evening: a bot PR costs **1** vercel preview instead of 6.
- **vercel stops bleeding** — `git.deploymentEnabled` gates `renovate/*` and `coder/*` in all six `vercel.json` (x-com-chat keeps its renovate preview: no ci build possible without a live convex); a coder push costs 0, a merge 6. the day itself spent **47 built + 13 rate-limited** deploys learning it — the cap was gone by 17:00, prod redeploys tomorrow. ignored build step still counts, vercel says so.
- **ci is the gate now** — bytes runs test + build for every app, financial against a postgres service container (no secrets, `db push` on empty tables); `--affected` resolved its base for the first time ever (`TURBO_SCM_BASE`; every earlier PR ran the whole graph silently); remote cache confirmed live (`Cached: 10/11`); dotfiles has a ci at all (check, typecheck, test, sline build). branch protection + auto-merge on both mains, admin bypass kept.
- **the coder has a name** — github app `x-coder-bot`, `pnpm github:agent-token` mints its installation token (jwt → token, keychain-backed, base64 pem because `security` hex-mangles multi-line), PRs and replies render as `x-coder-bot[bot]`. worktrees standardised on `<repo>/.claude/worktrees/` (cc's own default); `~/projects/.worktrees` gone.
- **steam beside psn** — [BYT-80](https://linear.app/x-com/issue/BYT-80): `steam-profile`, `steam-games` (342), `steam-game <appid>` (achievements with global rarity), `steam-wishlist` (70, names via the store api, one appid per call — the batched form answers `null`); psn `games` no longer truncates at 100 (109 titles, two fixes not one). three api lies documented in the app's `CLAUDE.md`: envelope keys differ per endpoint, rarity arrives as a string, «Game details» is a privacy setting separate from the profile. cw briefed with both apis.
- **the notes-stack research** — [DOT-228](https://linear.app/x-com/issue/DOT-228), three branches measured on a throwaway vault and a real notion workspace: rename is the only op that breaks a vault (plain `mv` 231/231 links broken; careful sed corrupts on a name collision; notion 40/40 links survive by page-id); notion reads ~32× the fs lane, throttles real page traffic at concurrency 10; no notionlike upset (anytype's encrypted store kills the fs lane). dima: not decision-ready — the obsidian cli and mcp lanes were not run. obsidian moved from a hand-installed 1.8.9 to brew's 1.13.7 (`--adopt` refused, clean replace, vault + config intact), the official cli switched on and probed live: `backlinks`, `unresolved` (4), `orphans` (58). run 2 tomorrow. `notes-stack.md` + a reusable bench committed; the old `<unknown>` data-loss hazard in `notion-channel.md` measured false and corrected.
- **the coder's retro** — dima's test: asked for its view of the flow, got nine ranked findings. three became rules in `x:coder-brief` 0.11.45 tonight: «final» is a handshake after the coder's own `code-review` (three merges raced unpushed commits today), verify state before any ordered deletion (cclio ordered a `checkout --` on a false premise; the coder refused), push freely on `coder/*` (the gate made «one push per step» obsolete), guides loaded per file type, and **the retro as the last act of every assignment** — a habit now, with the why in the ask.
- **smaller** — blacksmith is orgs-only: [DOT-241](https://linear.app/x-com/issue/DOT-241) canceled, the github-org move queued as a later todo. keys inventory folded into [BYT-41](https://linear.app/x-com/issue/BYT-41). `~/.zshenv.local` sourced for machine-local tokens. the notion integration `ntn-agent` exists, token rotated after a paste. `cmdlog.zsh` from last night keeps counting. ribbons went plain-text (box glyphs wrapped in the code tab and cw); the `·` separator is banned inside sentences and joins the pre-send scan.

## tricks gained

- a job whose `runs-on` label has no runner queues forever, never fails; with renovate's `prCreation: not-pending` that silently stops every bot PR — gate runner probes behind a repo variable
- a poll watcher must anchor on time set once, never on what exists at arm time, or every re-arm is a blind spot (dima's #59 comment sat five minutes in one)
- linear's github integration closes a linked issue two seconds after its PR merges, no actor, no closing word — dima asks linear's agent to turn every state automation off
- `security find-generic-password -w` hex-encodes a multi-line secret; store pems base64
- the mend onboarding's «scan only» default is silent mode; «require config file» keeps renovate off the other eight repos
- an internal notion integration cannot create a workspace-root page; one shared parent covers the tree
- `brew install --cask --adopt` refuses a bundle missing a binary the cask links; it removes the app, a plain install follows
- a `CLAUDE.md`-only commit still fans out to all six vercel apps: anything outside a workspace package is a global change

## state

- dotfiles + bytes clean on origin, coder `230146db` idle and warm (its worktrees and branches self-cleaned), no monitors survive the session
- bytes prod on the pre-#59 build until the cap resets ~17:30 tomorrow; five renovate PRs open (bytes #61 postgres 18, #57 pnpm 12, #56 graphql 17; dotfiles #36 vitest 5, #35 pnpm 12) for the first evergreen digest
- tomorrow: the interview 16:00 kyiv; before it, nothing agent-side; after it, DOT-228 run 2 (obsidian raw + cli + cyanheads mcp, notion cli + mcp, artifact) and the taste interview
- vets: brew picks 09-15, coder identity 09-16 (bot on github too now), initiative 09-17, proto-lab 10-04, `cmdstats` ~09-22
