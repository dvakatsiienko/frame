# shift · 2026-09-28 · trophy-sys

mode: **shift** — m1.1 of [FRM-266](https://linear.app/x-com/issue/FRM-266), the first one nobody steers. a **lane** is our usual day with dima; a **shift** is a lane built to run without him (dima, 2026-09-28). cclio takes every gate by the rules below; a taste call gets a default build, flagged for his review, never a silent decision.
budget: stop at **15 % of the week** (8 % at start) · read `~/.claude/shelf/cc-usage-window.json` at every pit stop
lane: bytes worktree `coder/BYT-88-sys-shift`, ONE pr, step commits, verifier on the pr. **nothing merges** — dima reviews the pr after the shift.
members: `🛰️ sys-shift · code` and `🛰️ sys-shift · verify` — the 🛰️ prefix marks a shift member in the sidebar; they ping cclio only when fully done or blocked
server: skip — the coder and the verifier start their own through `trophy-sys-run` (a worktree port)
tickets: [BYT-88](https://linear.app/x-com/issue/BYT-88) (gremlins) · [BYT-87](https://linear.app/x-com/issue/BYT-87) (hardening tails) · [BYT-85](https://linear.app/x-com/issue/BYT-85) (npsso renewal) · [BYT-108](https://linear.app/x-com/issue/BYT-108) (now playing)
not in this shift: [BYT-86](https://linear.app/x-com/issue/BYT-86) — the product map and `FTR.md`, `granular`, a grill + step-by-step with dima, later

## the rules

- **live reads**: every step reads its ticket body at step start, never a copy in this file
- **intake is «in» by default**: an ask dima drops mid-shift is folded into it — one exit line, the verifier re-reads the list
- **the coder's own finds**: a bug found on the way is fixed in place when it needs no taste call, else parked with its reason
- **steer log**: every dima message during the shift is one line under «steers» — the goal is none

## cclio's watch — dima is away, so cclio is his eyes

- keep an eye on the process: an idle notice, a pr commit, a verifier round line → a check against the plan within the minute (`craft-spawning`: an idle notice is a check)
- log everything: one line per event under «log» below — time, who, what, the evidence (a sha, a pr comment, a command)
- fix in place: a stall, a wrong turn or a broken tool is fixed by cclio the moment it is seen, logged as `fixed:`
- the report at the end: everything spotted and fixed, then a separate **«needs your eye»** section

## 0 · preflight (cclio, before the spawn)

- spare age (`craft-spawning` 0.5) · impeccable plugin OFF (`claude plugin list`) · `trophy-sys-run` + `trophy-sys-verify` exist ✅
- the pr watch armed the same turn as the spawn
- the coder's first ping names its loaded AGENTS.md paths (bytes root + `apps/trophy-sys`)

## 1 · the npsso hot swap — the one real bug first (dima, 2026-09-28)

symptom: a fresh npsso was pasted 09-27; the app stayed open in a prod tab on `/journal`; today a switch to `/campaign` answered «npsso not correct» until a page reload. a running app does not pick up a renewed token.
evidence to collect first: which layer holds the old token — a server instance memo (`server/cache.ts`, the 60 s api memo, a module-level token), the refresh grant in kv, or the client's cached query error. **a guess, not a cause**: a warm serverless instance kept the old npsso or grant in memory.
fix: a renewed npsso reaches every instance on its next request, and the client retries a failed query after a renewal without a reload. proven by a test that swaps the token under a warm server.

## 2 · the fixes — clear, no taste call

- BYT-88: `npssoDeathRecord` behind `isAutoWriteSafe`
- BYT-87: the error boundary logs · the login throttle moves to a kv counter · the chart-layout invariant test (headless, every x-axis chart ends the same distance above its panel)
- BYT-85: the 3-day warning before the grant ends · the dead `ignoreBuildErrors` removed (proven by a local `pnpm --filter trophy-sys build`)
- `CONTEXT.md` (the domain words: npsso, grant, the gaming day, hidden set, …) + `docs/adr/` with ADR-0001 (the stack) and one ADR per hard decision the prd `cclio/docs/trophy-sys-prd-2026-09-10.md` names — the [BYT-111](https://linear.app/x-com/issue/BYT-111) essentials, no `FTR.md`

## 3 · the visual asks — default build, flagged for dima's eye

- `/journal` day rows (dima's screenshot, 2026-09-28): the progress text and the progress bar swap places — text first, the bar at the row's right edge — and the day separator band «make pretty». the house look (`DESIGN.md`, the dark terminal style) is the reference; before/after screenshots at 1280 go in the pr
- BYT-108 «now playing» accent: one default look

## 4 · research only — the answer lands in the pr, the choice stays dima's

- BYT-88 refetch misfire: dima's recipe — the react-query docs on every refetch path (focus, `focusManager`, `visibilitychange` vs `focus`, interval, stale time) + best practice on not over-refetching → options
- BYT-88 journal % vs library %: the two numbers explained, 2 fix options
- BYT-88 MGS5 two skus: edition merge vs an admin alias, the cost of each
- BYT-88 non-game titles in the library: is there a real type source (`conceptId` store lookup) — one probe, the result

all four go into `dima-review.md` in the pr, one recommendation each.

## 5 · verify

- the verifier (opus medium) runs the exit lines at 390 and 1280, the essentials on every touched view, `pnpm --filter trophy-sys build` + typecheck + tests
- round 3 or a dispute → park, per the stop rules

## exit — the verifier's list

- given a warm local server and an open client, when the npsso is renewed, then the next request on any route succeeds with no reload
- given a local run against a prod-like kv, when an npsso dies, then `npssoDeathRecord` writes nothing unless `isAutoWriteSafe`
- given a render error in a production build, when it throws, then the error boundary logs it
- given the grant ends in ≤ 3 days, when `/console` opens, then the warning shows
- given the trophy-sys build, when `ignoreBuildErrors` is gone, then `pnpm --filter trophy-sys build` passes
- given `/journal` at 1280, when a day row renders, then the progress text comes first and the bar sits at the right edge
- given `CONTEXT.md` and `docs/adr/`, when read, then the domain words have entries and ADR-0001 names the stack
- given `dima-review.md`, when read, then every parked and flagged item has options and a recommendation

## stop rules

a dispute, round 3, not-checkable, an unplanned decision → park that step with its reason, go to the next · 15 % of the week crossed → finish the step, stop, report · anything that writes to production kv, vercel settings or the live npsso → park, never run

## steers

_(one line per dima message during the shift)_

## log

_(cclio, one line per event: time · who · what · evidence)_

- 18:5x · cclio · shift start: `🛰️ sys-shift · code` spawned (11665aea, opus medium), pr watch armed, idle subscription on; BYT-88/87/85/108 → In Progress
- 18:5x · cclio · beside it, not the shift: `🧪 probe: FRM-147 round 2 prep` (68a9a1ed); parallel monitor `98e9a277` on cirruslabs/homebrew-cli#21
- 19:0x · cclio · pr [bytes#111](https://github.com/dvakatsiienko/bytes/pull/111) opened (1 commit) → `🛰️ sys-shift · verify` spawned, waits for the coder's ready message
- 19:0x · cclio · fixed: the pr watch printed `null` on an empty list (`.[0]` on `[]`) — re-armed with `.[]`
- 19:1x · code · commit 2 on #111 (watch)
- 19:1x · code · commits 3–4 on #111 (watch)
- 19:1x · cclio · spotted: ci red on 1e6770d9 — knip, unused exported `FailureWindow` (state.ts:434) → relayed to the coder with the run link; `pnpm knip` before each push
- 19:2x · verify · round 1 (step 1, npsso hot swap, 0d14afa5): clean · 0 high/medium, 1 low
- 19:3x · code · commits 5–6 on #111 (watch) — error boundary logs, 3-day grant warning
- 19:4x · code · commits 7–8: dead-token errors stop retrying (a find), the chromium chart-axis test
- 19:5x · code · commit 9 on #111 (watch) — CONTEXT.md + six ADRs
- 20:0x · code · commits 10–11 on #111 (watch) — journal rows text-first + day band, now-playing mark on /campaign
- 20:1x · code · commit 12 on #111 (watch) — dima-review.md
- 20:1x · cclio · spotted + fixed: dima's ssh into seed-3 refused `admin` twice — the 1Password agent's keys burn the auth tries; `-o PubkeyAuthentication=no` (the prep coder's find, an inference)
- 20:2x · verify · round 2 (step 2, through 658ea01f): clean · 0 high/medium, 1 low
- 20:3x · code · commits 13–14 on #111 (watch) — the coder's own review fixes (heal scope, kv expiry)
- 20:3x · code · commit 15 (c7811ec8, docs: now-playing, chromium on a fresh machine); tree clean, idle waiting on the verifier — checked, no nudge needed
- 20:4x · dima · round 2 of FRM-147 beside the shift: the VM logins (claude, 1Password), the apple sign-in skipped (it hung) — not shift steers
- 20:5x · verify · round 3 (the full pr, c7811ec8): clean · 0 high/medium, 2 low → dima added as reviewer
- 20:5x · verify · retro received (7 lines → flawlog), verifier stopped
- 21:0x · code · commit 16 after the clean round (e3545d57, a test: now-playing follows the sync, not the clock) — a verifier low, test-only; ci re-checks it

## report

**done** — [bytes#111](https://github.com/dvakatsiienko/bytes/pull/111), 16 commits, ci green, verifier clean after 3 rounds (8/8 exit lines), ci reviewer 2/2 clean; ~18:50 → 19:40, ~50 min
- step 1: the npsso bug was the client — the layout `profile` query latched NPSSO_INVALID across route switches; the server was fine (the plan's guess was wrong, the evidence-first line caught it)
- step 2: death-record guard · kv login throttle · error boundary logs · 3-day grant warning · the chromium chart-axis test · dead-token errors stop retrying (a coder find) · CONTEXT.md + 6 ADRs
- step 3: journal rows text-first + the day band · now-playing on /campaign — shots: https://claude.ai/artifact/S6ZVdwCAGaBQhHaZw4bSLK
- step 4: four research answers in `apps/trophy-sys/dima-review.md`

**spotted and fixed by cclio** — the pr watch's `null` on an empty list · the knip red relayed with the run link · a post-clean commit (test-only) checked

**plan misses** (for the night plan) — exit line 5 was true before the pr (check exit lines against main at planning) · the 3-day warning's premise was false and shift mode forbade the early «i'd cut this» → a premise-doubt lane · impeccable's hook fired with the plugin off

**spend** — week 8 % → 11 % for the shift + the tart prep beside it

**steers** — none about the shift; dima's messages were the tart VM logins

### needs your eye

- 📌 review + merge [bytes#111](https://github.com/dvakatsiienko/bytes/pull/111) — the dev pair runs the pr on http://localhost:5187 until ~03:00
- `dima-review.md` — 8 items, each with a ➡️; read first: #3, the 3-day warning fires on a healthy token ~3 days in 10 → ➡️ an early re-mint, its own pr
- ⚠️ trophy-sys `.env.local` holds PRODUCTION kv creds — one wrong env order in a local run writes prod (the verifier's sentinel check is the proposed guard)
- the pr edits `ci.yml` (a chromium gate for the chart test)
