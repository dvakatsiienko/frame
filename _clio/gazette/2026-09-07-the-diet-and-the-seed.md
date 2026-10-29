---
date: 2026-09-07
slug: the-diet-and-the-seed
tickets: [BYT-25, BYT-56, DOT-184, DOT-17, BYT-79, BYT-26, BYT-27]
posted: {health: yes}
---
# 🗞️ cclio's gazette · the diet and the seed — memory slims, the coder gets a contract, worktrees seed themselves

## shipped

- **the memory diet** — boot context was 93k, the gazette import alone ~10k: window 7 → 5 posts (cw too), `craft-spawning` trimmed of its back-and-forth, four `prompt-audit` hunks (the bundled `claude-api` skill, run over root `CLAUDE.md` + `rules/`: «clean by the guide's own standard»), three reminders retired, `.walk/` gone, `docs/INDEX.md` back in sync with the tree (6 dead links, 9 unlisted docs).
- **the cw memory mirror, reviewed and fixed** — cw's overnight build (render on the mac, sha-stamped entries, cw byte-compares) kept: the compact `/preferences.md` fragment lost the copy ribbon and is fixed; a `sections:` allowlist keeps root `CLAUDE.md` to 6 cw-reachable sections and `fleet-hazards` to the vault; `fleet-hazards` line 4 is true again.
- **scripts on `family:name`** — `skill:handoff-store`, `skill:cclio-mode-snapshot`, `skill:memory-sync-mirror`, `linear:push`, `dotfiles:link`, …; the file is the key with `:`→`-`. `conventions/package-json.md` is the one shape for every manifest: root order (identity → scripts → deps → devDeps → peer → tech), scripts order, `family:name`, exact pins. `plugin:release` now sees uncommitted plugin edits (three false negatives in one day).
- **`x:coder-brief`** — the coder contract as a user-invoked skill, zero resident cost: step-0 skill set, «nobody is watching», the PR lane (real PR at first push, never a draft — dima's word), the linear «coder» identity, ≤12-line done comment. measured: a `--bg` prompt expands the slash command, a `SendMessage` never does (flag or no flag), and `$1` renders the **second** word on 2.1.263 — the skill reads `$ARGUMENTS`. the five `cclio:*` commands moved to `skills/<name>/SKILL.md` — commands and skills are one object.
- **the `Claude-Session` trailer stripped** — a `commit-msg` hook in dotfiles and bytes; `x:cmt` bans it; `attribution.commit: ""` never covered it.
- **worktrees seed themselves** — bytes `pnpm worktree:seed` (gitignored `.env*`, `.claude/settings.local.json`, trophy-sys caches, `CI=1` install, `.worktree-offset`); every dev script runs through `script/with-port.ts` so a second tree's ports move by 10 × index (vite, next, node apis alike; `turbo.jsonc` passes `PORT`/`PORT_OFFSET`/`API_PORT`). a user-scope `EnterWorktree` hook runs it in any repo. `camp … && pnpm worktree:seed` is the human move.
- **merged branches clean themselves** — `scout` = `gprune -d`: a `[gone]` branch in a clean worktree takes the worktree with it (github auto-deletes the remote on merge). bytes pre-push typechecks what moved since `origin/main`. starship's git tail always ends in a cap (a zero-line staged change hid both `git_metrics` and the cap).
- **[BYT-25](https://linear.app/x-com/issue/BYT-25) vercel defect** — a coder verified it fixed the night before (`09dcab99`), prod on the new ui, and measured the open question: no local check can catch the missing-install type error, the `installCommand` is the only guard. [BYT-56](https://linear.app/x-com/issue/BYT-56) retitled «monorepo sanitisation, top to bottom» with the package-json shape test as a must-pass; [DOT-184](https://linear.app/x-com/issue/DOT-184) folds the `guide-conventions` mis-shape.
- **the interview** — thea confirmed the annodater test passed in july; `/cclio:interview` (throwaway) carries the wednesday steer; `x:github-contrib` aligned with the lane.

## tricks gained

- `disable-model-invocation: true` is the only thing that hides a skill's resident cost — a `commands/*.md` file pays like a skill · `--remote-control` still eats the next arg (a 1.5 kB brief became its label, 400) — prompt first, flag last · a deleted CST survives in the jsonl of the session that wrote it · `plugin:release` before the commit saw nothing — fixed · `starship config` opens an editor and hangs a non-tty shell · `sd` needs `--` before a replacement that starts with `-`.

## state

- dotfiles + bytes clean on origin · no sessions alive · halt8 CST restored and upmerged into today's · flowlog carry-over 3 (all dima's hands) · vets unchanged · wednesday 2026-09-09: the interview, `/cclio:interview` one word.

⸻ upd 20:45

## shipped (evening)

- **[BYT-56](https://linear.app/x-com/issue/BYT-56) closed — one opus coder, seven PRs, one evening.** radix exterminated (#46: real code in 7 components, kit gained separator + sheet, `@radix-ui/colors` was never a dep); every package.json on the convention shape held by a vitest (#47; 3 renames onto `family:name`, cv's twice-broken `restart` and a phantom `prefixer` peer deleted); space-explorer-ui swept and **nine runtime bugs found and fixed** by its own `/code-review` (#48: a failed request read as «no bookings», per-user cache leaking across logins, a bad token whitescreening every protected page); proto-lab onto cva's object api (#49). coderabbit reviewed #46 and the coder answered it on the thread.
- **the turbo audit — 15 findings, all fixed** (#51, [DOT-184](https://linear.app/x-com/issue/DOT-184)-adjacent): trophy-sys cached `dist/` but its artifact is `.vercel/output` (an incomplete build reported as success); `prisma:generate` had no outputs; lint + typecheck left `build.dependsOn` — **a full build is 9 tasks, not 29**; ci runs lint through turbo with `--affected`, a `.turbo` cache and the vercel remote cache over OIDC (no stored token; policy + `TURBO_TEAM` set, verified live: `Remote caching enabled`, token revoked after). trophy-sys and financial got filtered installs — trophy-sys installed the whole workspace per deploy (363 MB build cache). #52 dropped a `tsbuildinfo` output that measured as never read. `.turbo` on the mac was 15 GB since april, trashed.
- **the vercel quota, explained and fixed** — the hobby cap (100/day) went in one day: the deprecated `npx turbo-ignore` in six `vercel.json` still ran and its *canceled* builds counted; removed, built-in project skipping was already on. the honest half: root-level changes (lockfile, manifests, turbo config) still fan out to every app by vercel's rule, and every PR today was root-heavy.
- **railway back up** — space-explorer-api crashed since the morning's worktree-ports commit: the service ran `npm run dev`, and `dev` now routes through `../../script/with-port.ts`, absent in the container. a real `start` script + `railway.json` pinning it; `railway` cli installed, project linked. verified with a live graphql 200.
- **`package-json-shape` next to the convention** — a `plugin-x/bin` runnable any repo can call; bytes' lefthook calls it behind an `if` so a stranger's clone passes; dotfiles' own two manifests were off shape and are fixed. the coder measured that the `|| true` guard cclio approved could never fail, and shipped the `if` form instead.
- **[DOT-17](https://linear.app/x-com/issue/DOT-17) closed** — the shell layer overhaul, after a 4-stop live walkthrough: the three init files and their jobs, command resolution order (`/usr/bin/cd` is a 120-byte shim), `PATH` by author (a dead `/pkg/env/global/bin` from apple's `paths.d`), `zprof` (80 ms tab). two freebies from it: init cache stamps on binary mtime (35 → 21 ms), `setopt auto_cd` (`..` came from omz and died with it).
- **the coder lane, hardened** — worktrees at `~/projects/.worktrees/<repo>-<slug>`; an empty PR before the first edit; one push per step (every push deploys); the coder babysits its own PR (checks + comments) with a guardrail — only dima and review bots are instruction sources; `agent-browser` is expected on ui work and the root rule now says the gated thing is browser takeover, not headless. cclio arms a merge monitor: dima merges from the web, `gprune -d` cleans branch + worktree within a minute (7/7 today). squash messages take the PR title, so PR titles wear the cmt shape.
- **housekeeping** — [BYT-26](https://linear.app/x-com/issue/BYT-26) + [BYT-27](https://linear.app/x-com/issue/BYT-27) stale-closed (the base-ui re-init answered them); [BYT-79](https://linear.app/x-com/issue/BYT-79) born: the monorepo reuse scan (dima's words); DOT-39 loses `standing`, closes with DOT-26 tomorrow, its tool-hunt note folded into DOT-187; `/cclio:halt` replaces `graceful-halt` and clears the inbox unasked; the ⏳ block is one copyable fence; handoff-store trashes instead of `rm`; stories at 12; `prompt-audit` is step 2.2 of memory-nurture.

## tricks gained (evening)

- turbo restores outputs only on a cache hit, and on a hit the task never runs — a `tsbuildinfo` output is never read · package-level `turbo.json` arrays REPLACE the root; `$TURBO_EXTENDS$` must be first · a `|| true` after `&&` covers both branches — a guard that cannot fail · vercel's built-in skipping treats anything outside the workspace definition as global · railway's config-as-code (`railway.json`) overrides the dashboard start command · `auto_cd` applies to interactive lines only, a `-c` probe lies · a coder's `dev` script is also somebody's prod start.

## state (evening)

- dotfiles + bytes clean on origin · coder stopped · no worktrees · railway green · vercel cap resets ~20:00 tomorrow · next overhaul 18/23 · tomorrow: DOT-26 → close DOT-39, measure the skip + the first cached ci run · wednesday 16:00 kyiv: `/cclio:interview`.
