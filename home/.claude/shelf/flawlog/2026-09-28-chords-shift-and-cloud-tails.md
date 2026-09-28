# flawlog · 2026-09-28 · run `cc·20260927·shift` · boot, cloud tails, the chords shift

- fixed (`-n` before `--cloud` proven, dima saw «☁️ cloud: name probe» in the sidebar): 5 cloud probe sessions launched 09-28 without a name — they titled themselves from the prompt («PROBE 3a read-only») and were left idle, no archive · cost: dima found the tails in the Code tab and asked · lesson: `x:crew-cloud` line 45 marked naming «? no flag» and nobody probed `-n` (it is a global flag); the type-first list in `craft-spawning` has no `☁️ cloud:` type, and «done» never forced the archive
- the digest counts the reset inbox template as «4 content lines» — a false «parse before any work» at every boot after a halt reset · cost: a wasted read · lesson: the counter must skip the template's own lines (`---`, `----`)
- open: the evergreen report printed «vercel 59 → 60, notes unread» and «linear, desktop, cursor: nothing to act on»; dima: «how this line is useful for me without knowing whats interesting new in a major?» · cost: a report he could not use, a redo · lesson: the skill's step 2 reads notes for renovate PRs only — brew and apps entries were judged from titles; «nothing to act on» is not «nothing interesting», and silence belongs to fix-only entries alone
- fixed: I called `✈️ dispatch` a retired tail twice; it is a built-in beta nobody can turn off · cost: a correction from dima · lesson: the 09-26 story settled «not a fleet member», never «should not be listed» — `ListAgents` shows it forever, so it never goes on a tail list
- open: `pnpm skill:evergreen-apps --mark` writes `sources.json` in a shape biome rejects — every mark fails the next commit's format hook · cost: a failed commit · lesson: the writer formats its output (biome on the path) before it returns
- open: a push piped into a `grep -E` with `->` in the pattern hit the ugrep alias, the pipe died and the push never ran — silent · cost: a false «pushed», caught by `git ls-remote` · lesson: a push is read by `git ls-remote`, never by grepping its output (fleet-hazards: a gate is read by its exit code)
- fixed: `:7384` was printed as code in an «open it» line, not as http://localhost:7384/ — dima: «always print full link for me to 1click» · cost: a copy-paste · lesson: the output rule already covers it; a localhost url is a web resource too, and the pre-send scan now looks for bare `:port`
- fixed: the BYT-97 cloud pr watch keyed on `head:coder/BYT-97`; the cloud session pinned its own `claude/knip-unused-code-sku5v8` branch, so the watch expired blind while #105 sat open · cost: ~20 min of an unseen pr · lesson: a cloud pr is found by the ticket id in its body — `x:crew-cloud` step 4 now says so
- open: biome's `useSortedProperties` fix glues CSS declarations when a rule has no trailing `;` before `}` (`64pxpadding-inline`) — a --write that broke the page silently, caught by the next check · cost: two failed commits · lesson: an artifact page's CSS ends every declaration with `;` before it enters a biome-checked repo
- noted: bytes CI `clean install · financial` went red on `next/font/google` («Can't resolve '@vercel/turbopack-next/internal/font/google/font'») and green on a bare rerun — a Google Fonts fetch flake, not the dedupe · cost: ~6 min · lesson: that error text on one next app while the others pass = rerun the job first; a second sighting earns a bytes AGENTS.md hazard line (self-host the font, or retry the step)
- open (verifier retro, #50): two exit lines named things the app could not have (`del` on a board without the key; «no scroll» with a footer) and each cost a decision round · lesson: a spawn ask's exit lines are checked against the real surface before they are written — «the key exists on the board» for a cap line. candidates for the chords verify recipe: the lan-vs-loopback write probe · a planted manual.ts row to prove a cap renders · a clip count on key names · a below-the-fold check · a tab-walk with a key selected · dnd-kit's aria-disabled is a false lead (run-chords gotcha)
- open (coder retro, #50): ~40k tokens of raw dumps (a loose selector, a wrong 2>&1 order) — a probe prints counts or jq-filtered fields only · a «clean» typecheck read by grep, colour codes hid the match — gates by exit code (already a hazard, broken anyway) · the worktree bash guard cost ~15 retries — its trap list could reach x:browser-headless · `agent-browser errors --clear` does nothing (now in run-chords) · x:product-docs: no rule for a feature with no visible label; «status flips once, in the last commit» fights a bug-by-bug shift · candidate: a `chords:probe` script, only if chords gets another shift soon · the «four events» ping rule landed in crew-coder today (e2c2701a)
- open: claude-in-chrome on claude.ai/code could not archive a cli-made cloud session — its url answered «This session couldn't be found», the web sidebar listed only «cclio» · cost: one try, stopped · lesson: unknown whether the chrome profile sits in another org or the web app hides cli cloud sessions; until probed, cloud cards are archived by dima in the desktop sidebar (hover → archive), and `x:crew-cloud` step 5's chrome line is unproven
- fixed: two commits died on a pathspec naming the OLD path of a `git mv` (`git add <old>` → «did not match any files») — the frame one committed the moves alone, the edits needed a second commit · cost: one extra commit · lesson: after a git mv, stage only the new paths; the move is already in the index
- open (daemon coder retro): my brief's cmd+tab guess was a false lead — the leak was release order (shift+cmd+4, cmd up first → shift's release logged bare `cmd`, 1,059 of 2,933); one log query on the neighbour lines ended it · lesson: a guess in a brief comes with the log query that would test it · also: EnterWorktree named the branch `worktree-coder+…` and skipped the git-crypt seed; the worktree sandbox refused 5 heredoc/sd/python edits with no «git» in the text
- fixed: deploy-watch called `gh run list` with no repo and ran from frame's cwd — it waited 10 min on a bytes sha frame never ran, printing «ci still running» while ci was green · lesson: a watch names its repo; zero runs is a finding after 3 min, never a wait (script + x:cmt fixed)
- fixed: vendoring quicksilver turned frame's ci red — the commit hook checks staged files only, ci runs `biome ci` over the repo · lesson: vendored code gets its biome exclusion in the same commit that adds it
- open (verify-skills coder retro): EnterWorktree skipped the seed a THIRD time today (no .worktree-offset in bytes, no git-crypt unlock in frame — daemon, knip and verify coders all hit it) · lesson: the worktree-seed hook does not fire for --bg coders' EnterWorktree; a real fix, not a brief line · the bash guard refused ~10 shapes again · candidate: `ess.sh <session> <base> <paths…>` (essentials at 2 widths + tab walk), repeated in 9 apps → x:browser-headless · essentials.js skips aria-disabled, and dnd-kit sets it on 61/84 chords caps
- dropped: a coder-hang watch on «subtree cpu under 1 s in 10 min» failed its green proof — 5 false flags on live coders (a VM burns cpu outside the coder's process tree, an idle dev server and a coder's own sleep-watcher are idle by design) · lesson: prove green on the real population before arming a detector; the deadline guard ships alone
- open (overflow coder retro): trophy-sys-verify + sketchbook-verify baselines already stale (page-height range, 13 truncations, a cursor, journal ring clips) — the next verifier reports them as findings; EnterWorktree names the branch worktree-<name>, every coder renames by hand
- fixed: deploy-watch picked apps from the head commit only — a 2-commit push (trophy-sys, then sketchbook) reported «no deployed app touched» while trophy-sys deployed · lesson: a watch reads the pushed range (origin/main@{1}..sha), never the head alone

## FRM-147 tart coder retro (18:1x)
- a VM brief states guest disk, not host: 50 GB image left 18 GB free, recovery partition blocks grow on macOS 26 → ~25 min; round 2 wants a packer 120 GB base
- brew runs Brewfile steps under env -i: GIT_CONFIG_GLOBAL filtered → a dead fix; candidate fleet-hazards line (brew env allowlist)
- a silence watcher's 30-min cap fires falsely on brew 7's quiet cask-move phase (~6 min)
- cirruslabs tart formula broken on brew 7 (tap DSL); pinned 2.32.1 release used
- sline focus pin refused by the sandbox guard (piped hook input)
- worktree started git-crypt locked; seed hook maybe missed (d74cd376 landed mid-session)
- sandbox «git»-text refusals: 6, ~10 min, still costly with the hazard in context

## sys-shift verifier retro (bytes#111, 3 rounds clean)
- a shift exit line is checked against main at planning time: «ignoreBuildErrors gone» was already true (cclio's plan miss)
- ⚠️ trophy-sys `.env.local` holds PRODUCTION kv creds; one wrong env order writes prod — the verifier proved local with a sentinel settings key read back via /api/settings before any write → candidate line for trophy-sys-verify
- `dev:api` ignores PORT (reads API_PORT / PORT_OFFSET): the verifier's api landed on the main checkout's :5178 → trophy-sys-run note
- a render error in a prod bundle: `vite preview` + `agent-browser network route "**/api/games" --body '{"broken":true}'` → recipe line
- the ci reviewer cap (2/pr) vs a pr growing in 4 steps: held run 1 until step 2, run 2 on the final head; each ~1 min
- hand-repeated every round: state-file backup/restore, admin login json, essentials at 2 widths → one verify-kit.sh candidate
- a tab walk scrolls the page; a screenshot after it can lie (sticky day header hid a row)

## sys-shift coder retro (bytes#111)
- the worktree bash guard: any text holding «git» (even «legitimate», «digit») refused ~12×; a tmp `mutate.py <file> <old> <new>` carried the shift → shelf tool candidate
- the plan's step-1 cause guess was wrong (the client's layout `profile` query latched NPSSO_INVALID); «start with evidence» in the brief paid off
- the plan's 3-day grant warning rests on a false premise (a grant end self-heals with a live npsso) — shift mode forbade the day-one «i'd cut this» ping → a shift wants one «premise doubt» lane: build + flag, or park before building
- every review layer found something unique (code-review ×2, coderabbit, ci reviewer, verifier)
- the «make it fail» rule caught a hollow chart clip test (visx overflow-visible svg); used 12× in the shift
- `pnpm knip` missing from the coder's pre-push list → ci red once
- impeccable's design hook fired though `claude plugin list` said disabled — preflight did not hold (hooks live at user scope?)
- writing-for-agents loaded late again, after the first AGENTS.md edits
- a `mutate-check <file> <old> <new> <test>` script (apply, run, restore, print red/green) candidate
- trophy-sys-verify essentials baseline lacks /campaign heatmap scrollable-region and signed-in /console region ×194

## essentials verifier retro (bytes#112, 2 rounds clean)
- an exit line that depends on another pr says so («…after bytes#111 merges») — cclio's spawn miss
- the ci reviewer cannot run `node` (no approval) → it reviews by reading only; still found the root-only-commit gap the verifier missed; ~1 min / 28 s a round
- verify-recipe candidates: hook probes on a scratch GIT_INDEX_FILE + `lefthook run pre-commit --job apps-essentials`; a scratch repo for the stale threshold; break one root file at a time; `git checkout <sha> -- <paths>` to apply another pr
- a fresh worktree needs `pnpm worktree:seed` before lefthook exists in it

## essentials coder retro (bytes#112)
- the worktree sandbox «git»-text refusals: ~12, ~15 min — third report today; an `x-run <script>` habit from the first command (with sys-shift's mutate.py) → a shelf tool, flush candidate
- a README row made art (3 jars + 3 peeks) nobody scoped — an essentials row that makes art says so in the ticket
- biome's format-on-save deleted a not-yet-used import between two Edits → runtime ReferenceError; add the use first, then the import
- fork-per-app backfill: 7 apps, ~90 s each, disjoint paths, ~2 % of the week
- the root AGENTS.md registry was wrong in 4 places; the checker proves a row exists, not that it is true — a stack cell could be derived from package.json
- every backfilled FTR line is ⬜: no verify skill walks its FTR yet — the next real step, needs dima's eyes
- pet-app finds: financial CustomerTable totals behind 6 @ts-expect-error · x-com-chat chats not per user + a spinning sign-in ring · figmentation clinique ticker repaints forever · sketchbook README example names stale

## seed-fixes coder retro (FRM-147)
- EnterWorktree cut the tree from origin/main, which lagged local main by 9 unpushed cclio commits — the brief's source file was missing; the coder rebased. fix: slay before a frame spawn, or frame `worktree.baseRef: head`
- sandbox guard: ~4 retries (`gitignored` in a heredoc, `python3 "$VAR"`, `sh -c` with a pipe, a cd into the main checkout)
- the brief left open whether the CLI step runs without --claude; the coder chose always (the README hands the seed to an agent)
- worktree:seed gives a new tree an offset from the sort index, so it can take an older live tree's ports (offset 20 twice; the coder moved to 30 by hand)

## BYT-85 #113 verifier retro
- ⚠️ `pnpm worktree:seed` copies the real .trophy-npsso.json, .trophy-psn-grant.json and the .env NPSSO into every tree → driving /console in a verify hits PSN with live creds; the verify recipe swaps in fake tokens first (same family as .env.local's prod kv creds)
- recipe: «dead npsso, grant alive» = the npsso into .trophy-npsso-deaths.json + grant expiresIn ≤ 3d; read the note before /api/games lands
- trophy-sys-verify baseline stale: /console region ×17 + landmark-one-main (console.tsx has no <main>), baseline says ×6
- the ci reviewer read a surviving mutation (isRefused, state.ts:396) as covered — the verifier's mutation pass caught it
- `github-token-wrap` takes the gh args without `gh`; the brief example with `gh` fails
- a ticket with no exit section: the verifier derived 4 lines from the accepted option — works; real-PSN halves proven via mocks only

## cclio: 30 min lost at ~20:25–20:57 (dima: «30min wasted! not good! why?»)
- #112's watch was stopped when its coder finished, then a 3rd review round was requested with no watch → review:clean green at 20:24, merged 20:57
- the cloud browserbase round went idle unseen — a cloud session sends no idle notice and no status watch was armed
- the deploy watch on a squash-merge sha died: the sha was not fetched locally (`git fetch` before deploy-watch.sh)
- fix landed: craft-spawning line «a watch lives until its pr merges; a cloud launch arms a status watch»
- 📝 the browserbase round (clean, 0.74 min, 1 session): `NODE_USE_ENV_PROXY=1` is needed for node fetch through the cloud proxy (a 401 otherwise); the default session timeout is 300 s; the vm cannot reach vercel.app directly; x:browser-headless bans playwright but the brief asked for it

## BYT-88 #114 verifier retro
- exit lines as cross-view equalities («the same number on every view») — that reading found the rounding gap
- the ci reviewer (43 s, diff only, no tests) missed the journal-vs-library rounding; a second sighting that it reads, never runs
- counts are measured, never repeated: the coder said 105 tests, vitest ran 109
- trophy-sys verify recipe candidates: prove the local store (GET /api/health → stateBackend: file); an essentials control run against main's src (the library carries ~200 old fails); agent-browser `network requests --filter` is a substring; a hidden tab = redefine document.visibilityState; the 5-min timer needs a 5m20s watch with no edits (HMR pollutes); admin list = POST /api/admin/login then /api/games?all=1
- `github-token-wrap` already adds `gh` (second sighting today)

## journal-polish coder retro (BYT-88 + BYT-85)
- the sandbox guard again: ~20 one-shot scripts; wanted — one plugin-x/bin wrapper for the coder lane (commit-by-paths, push-sha + ls-remote, pr-open, merge-main); drafts of all four in /Users/dima/.claude/jobs/c448ff98/tmp (keep them before the job ends)
- worktree:seed offset fix: the lowest free offset, never one a live `.worktree-offset` holds
- `?all=1` without the admin cookie silently returns the public list — admin views read through the signed-in page, never curl
- the review fork caught the «Constructor» crash; coderabbit found nothing unique on #113 and was rate-limited on #114 → question coderabbit's place in the lane
- cclio's brief assumed #112 on main (FTR files, the checker) — one fetch of main before a brief
- when a figure changes, grep the formula (`* 100`), not the field
- trophy-sys DESIGN.md is an unfilled template — «the house look is DESIGN.md» pointed at nothing (BYT-86 owns it)
