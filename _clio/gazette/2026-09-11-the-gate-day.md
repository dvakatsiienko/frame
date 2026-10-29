---
date: 2026-09-11
slug: the-gate-day
tickets: [BYT-70, BYT-84, BYT-85, BYT-86, BYT-88, BYT-89, BYT-90, BYT-91, BYT-92, BYT-93, DOT-26, DOT-241, DOT-244, DOT-245]
posted: {health: yes}
---
# 🗞️ cclio's gazette · the gate day — six prs, a testing system, a reviewer with a face, and a merge gate that turned out to be paper

## shipped

- **the stash pattern** — [BYT-88](https://linear.app/x-com/issue/BYT-88) gremlins + [BYT-89](https://linear.app/x-com/issue/BYT-89) wishes per app, label `stash` (linear's api bans emoji in label names, 255-char descriptions); the sys project description carries the purpose line. seeded: the MGS5 sku join (psn's played feed holds `DEFINITIVE EXPERIENCE` 714 h and `PHANTOM PAIN` 49 m, the name join picks the wrong one), the games-only filter (entitlements carry no type; dima: «not ok with crappy string search» → concept lookup), release date, hide-from-library.
- **npsso, measured live** — [BYT-85](https://linear.app/x-com/issue/BYT-85) / bytes #68: the refresh grant is 10.0 days, counts down from the mint, a refresh does not reset it; the npsso outlives it, so the 1password sign-in runner is the only self-renewal path. b2 research: `op` reaches the psn item (touch-id prompts, so unattended = service account + own vault), the cw connector is human-approve-only, `agent-browser --restore` keeps sony's device cookie. dima pasted a fresh npsso; prod reads kv.
- **the testing system** — [BYT-90](https://linear.app/x-com/issue/BYT-90): vitest everywhere (state of js 2025 leader; jest sliding; browserbase 1 h/month; bun test a later import swap), root `projects` config, 9 `node:test` files converted to `expect`, `tree` reporter, `test:ui` for dima, vitest hoisted root-only (a filtered `pnpm i -F app...` still installs root devDeps — measured on a scratch clone; the strict-store exception is `public-hoist-pattern`), the kit's first browser-mode test in headless chromium (#72, five tests, one of them hollow twice before it could fail). the hoist rule lives in bytes `CLAUDE.md` + `conventions/package-json.md`; [BYT-91](https://linear.app/x-com/issue/BYT-91) sweeps the rest.
- **the review lane, v2** — #70 + #73: the `🤖 review:requested` label starts the ci reviewer with a tracking comment (`track_progress`), `review` is a required check on main, label-only trigger (each round ≈13 min of opus on dima's own window: two rounds per pr, re-label = re-review, delta from the last run's sha), guard red on unanswered findings (an answered thread counts), sticky comment + fix links, `@cc` trigger phrase, the reviewer posts as `x-reviewer-cc` (GitHub App, key in a repo secret + keychain), coder renamed `x-coder-cc`, matt's four gh labels deleted. ⚠️ **the gate is paper**: github counts a skipped job as passing — #72 merged with `review = skipping`. next: the guard publishes its own check run, `review` gets its own workflow file.
- **the product map, grilled** — [DOT-244](https://linear.app/x-com/issue/DOT-244) Q1–Q9: PO-first (dima: «service me as a customer»), one `MAP.md` with a character section (no `BRAND.md`), one line per feature, `🧭 planned · ✅ built · 🔎 verified` no dates (the intentdocs borrow), house svg wireframes (every markdown-wireframe dsl is <100 stars; mermaid has none), same-change sync, atelier dropped, slim designer skill. prior art: nobody extracts a spec from code — [BYT-86](https://linear.app/x-com/issue/BYT-86) is a one-time read of the running app.
- **folds**: [DOT-26](https://linear.app/x-com/issue/DOT-26) got dima's whole spec (visit cards ×3 takes, no self-mentions, svg banners work as files, badges, the profile page, a repo-settings pass); [DOT-241](https://linear.app/x-com/issue/DOT-241) reopened as the org trial, blocked by [DOT-245](https://linear.app/x-com/issue/DOT-245) graphite vs gh stacks; both to the monorepo project (team DOT added to it).

## tricks gained

- the ci reviewer posts to a different endpoint per round (review + inline, then a plain comment) — poll all three; an `issue_comment` workflow runs on the default branch, `gh run list --branch` never shows it; greptile edits its summary in place and completes a check-run — no new post ever comes
- `gh api --paginate` emits one array per page: `.[0]` reads 30 items, `jq -s add` folds
- an inline review thread is answered only via `POST /pulls/{n}/comments/{id}/replies`
- a claude-code-action pr that edits its own workflow self-skips (anti-tamper); a concurrency key on label presence still collides — key on the event
- the boot prefetch now prints ahead/behind for dotfiles + bytes; a squash-merged `claude`-managed branch reads as «6 commits main lacks» to gprune
- coder retros, the keepers: a test is proven by making it fail (delete its input); brief behaviours, not a count; fetch main before asking a question a commit could answer; «decide and say why» beats «implement»; ten items dripped rewrite the same predicate four times

## state

- dotfiles: 12 uncommitted edits (rules, brief 0.11.58, conventions, prefetch, shape hook, root claude.md testing), flushed at this checkpoint; bytes `4d880195` clean, ci green, coder `b7b0d883` idle at root, warm for the gate fix
- next: the gate-fix brief (one batch) → BYT-91 → BYT-86 map draft → the english trainer, ralph, 🧹/pm rebalance from the inbox

⸻ upd 22:40

## shipped (evening)

- **the merge gate is real** — bytes #75 ([BYT-91](https://linear.app/x-com/issue/BYT-91)'s neighbour, no ticket): the guard publishes its own check run `review:clean`, `review` moved into its own label-only workflow, main requires `review:clean` — a head nobody reviewed is blocked instead of green. measured on the way: an unrelated label ERASED a red review (skipped replaced failure on the same head), and comments were never the door (an `issue_comment` run sits on the default-branch sha). the coder found the brief's premise false — a workflow file new to main reviews itself — and four defects came out of that. ⚠️ hole #2, measured on four rounds across two prs: the guard counts inline threads, a round filed in the sticky comment reads clean → [BYT-92](https://linear.app/x-com/issue/BYT-92), first tomorrow. and the structural one: the check is per head, the cap per branch, so a pr whose last round found something cannot go green on its own — #75 and #76 both merged past a pending gate; the answer-check job in BYT-92 closes it.
- **the hoist sweep, reversed mid-pr on dima's criterion** — #76 / [BYT-91](https://linear.app/x-com/issue/BYT-91) done: the root manifest holds the shared toolchain only (typescript, vitest, biome, the `@types`, tailwind + postcss, tsx — 24 names); a tool a subset of apps chose stays in those apps. the reason is measured, not taste: a root bump moves 32/32 turbo hashes and deploys all six apps. one-version-per-name moved into the shape test (dotfiles `aea6e2f`, red first), which found a graphql 16/17 drift between two talking apps on its first run — closed. `scratch/*` joined the vercel gates after a probe branch burned six deploys; the daily cap hit 100 and three prod fan-outs failed — [BYT-84](https://linear.app/x-com/issue/BYT-84) moves up, a two-week counter watch follows it. [BYT-93](https://linear.app/x-com/issue/BYT-93): the clean-clone filtered install as a ci step + three ci riders (80 s of a 175 s run is not the work).
- **english, live** — dima's shape: not a halt summary, a turn-by-turn `🎙️ tune-up: yours «…» → mine «…» — why` line, ~1 in 10 messages, `🎸 slang:` for the native-dev way, `🔁 again:` for a recurring one, his `⌨️ <sentence>` echo as practice (mechanical retyping is the lever). [claude-english-buddy](https://github.com/xiaolai/claude-english-buddy-for-claude) installed after a hunt of the field, run quietly through a wrapper hook (the desktop app printed its diff raw; cross-session messages were getting corrected) — [issue #19](https://github.com/xiaolai/claude-english-buddy-for-claude/issues/19) upstream asks for a quiet flag, signed «printed by Claude Code, signed by me», now the fleet footer for anything posted under his name outside our repos.
- **checkpoint, first run scored** — 10/10 facts, dima 6.7: the KEEP list paraphrased his asks. `cclio:checkpoint` 0.3.38: inbox items ✅-marked in place and never cleared, the resume diffs inbox vs flowlog, details kept and fluff dropped.
- **smaller**: the 🧹 broom dropped (label, boot step, memory section — zero tickets since its first day); `x:pm` framework paragraph trimmed to four lines; ralph loop pre-researched (go, narrow: the guard fixture tests, coder-hosted, `--max-iterations 8`; the state file needs a gitignore line); knip researched and dry-run (21 files · 15 deps · 42 dead exports on bytes; proto-lab excluded by design, no blind `--fix`); [BYT-70](https://linear.app/x-com/issue/BYT-70) gains the fleet-avatar set as the first image-gen candidate; [DOT-26](https://linear.app/x-com/issue/DOT-26) gains an images pre-research line.

## tricks gained (evening)

- a green status answers «did this fail», never «did this run» — github's skipped job, vercel's skipped deploy («success»), our own `review:clean` with no inline threads, all in one day
- a cap is real only if something reads the counter before acting: the coder tracked rounds by recall, cclio counted a workflow-wide run list — both wrong; `workflows/<file>/runs?branch=<head>` is the count
- a claude-code-action pr self-skips only for a workflow already on the default branch; a new file reviews itself
- an `issue_comment` run carries the default-branch sha — its skipped jobs never touch a pr head
- every `gh` write in a coder job goes through one wrapper script made at job start (zero identity slips after it); the sandbox refuses any TEXT containing `git`, heredocs included
- `settings.json` hooks load at session start; a plugin's `UserPromptSubmit` hook fires on cross-session messages too
- ci on bytes: ~2.9 min, review round ~8; actions are free on public repos, the quota you burn per round is anthropic's

## state (evening)

- dotfiles `eba4693` + the halt flush, bytes `f5b0f0c7` — both clean on origin after the push; coder `b7b0d883` idle and warm for BYT-92; no worktrees
- tomorrow: [BYT-92](https://linear.app/x-com/issue/BYT-92) (+ [BYT-93](https://linear.app/x-com/issue/BYT-93)) → the ralph run on the guard fixtures → [BYT-84](https://linear.app/x-com/issue/BYT-84) → the knip report for dima's keep/delete pass → [BYT-86](https://linear.app/x-com/issue/BYT-86) map draft → [DOT-26](https://linear.app/x-com/issue/DOT-26) with him
