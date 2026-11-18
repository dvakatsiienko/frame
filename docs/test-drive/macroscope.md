---
status: live
until: 2026-11-23
dies-when: the verdict line below is written
---

# macroscope — an outside ai code review, as a pr app and a local cli

Ticket: none

dima, 2026-11-15 23:11: «/clio:shape-test-drive yourself for macroscope, 1w … I'm actually mostly interested in the CLI code review because it's faster and there's no need to wait for CI». research: [macroscope.md](../research/macroscope.md); the probe was pocket PK-436.

**the main question** (dima, 23:45): do we fit the free tier — 1,000 agent credits a month (about $10) for the cli, the $100 welcome credit for the pr reviews? «if the quota runs out in, for example, a week, it won't work for us, because our habits will drift too hard … if not, we just delete it. otherwise i actually like macroscope»; greptile and coderabbit showed nothing outstanding so far.

**test card:** we believe macroscope reviews fit the free tier at our real pace and catch real bugs codie's own review and sixth sense miss · we test it by the cli on every codie review request (quick and side lanes), and the github app on every side-lane pr in frame and bytes · we measure $ per review and the month's projected burn against the 1,000 credits, findings (real / noise), the overlap with codie's review and sixth sense, seconds · we're right if the projected month stays inside the free credits and ≥1 real finding the others missed per 5 reviews, ≤1 noise finding per review
**kill rule:** the free agent credits projected to run out before the month ends, a card charge, or 3 reviews in a row with only noise

## how codie uses it (manual, no skill wiring; dima, 23:45)

- whenever codie asks for its usual code review, it also starts `macroscope codereview --base <base sha> --mode budget --raw` beside it, non-blocking and outside its per-chunk review quota
- in frame it passes `--isolate=false`: the isolated temp worktree would hold git-crypt ciphertext (inference, the first round proves it)
- it compares right away and reports: findings total, real / noise, found also by its own review or sixth sense, found only by macroscope, seconds
- clio reads Settings → Billing → current spend before and after each round, the round's $ is the delta; the round line lands here
- the coderabbit comparison is the point: codie has said coderabbit often finds nothing, or only nits, or what was already found ([coderabbit.md](coderabbit.md))

## the pr review in ci

- already live, no setting to enable: the github app reviews every non-draft pr opened or pushed in frame and bytes (Correctness «always run», Budget); renovate prs skipped
- first pr round after 2–3 cli rounds: FRM-632 or FRM-633, or cap v2 with a wing if dima starts it

## later: custom checks (check run agents), the idea dima liked most

markdown files in `.macroscope/check-run-agents/`, each an ai check on every pr with its own prompt, model and budget; billed as model cost + 5 % on the agent meter. only after the free-tier answer. borrows from t3code's `.macroscope/` (read 2026-11-15, [tree](https://github.com/pingdotgg/t3code/tree/main/.macroscope)):
- `conclusion: neutral` — a check informs, never blocks a merge
- `include` / `exclude` globs scope a check to its files; `input: incremental` reviews only the new push
- `maxBudgetPerRun` / `maxBudgetPerPR` per check ($1–5 / $5–25 there); a cheap model at `reasoning: low`
- the rules live in a repo doc the check points at (`docs/internals/testing.md`), so authors and the check read one source
- «make the entire final response exactly `All clear`» when nothing is found — no filler comments
- `ignore.md` replaces the built-in ignore list, so it copies the defaults first, then adds its own
- `approvability.md`: a pr that adds or widens a lint or type-checker suppression is never auto-approvable
- our candidates: the ftr line and glossary word a change needs (today `x lane gate`), README still true after a change, a lint suppression added without a reason

📌 the setup (2026-11-15):
- read back after a reload in agent-browser, 2026-11-15 23:2x:
  - frame, bytes: Correctness always, Budget, Status off, Check Run Agents never, Approvability never, draft prs off, auto-merge of its fix prs off, Skip PRs by Author `renovate[bot]` + `x-renovate[bot]`
  - the other 8 linked repos (studio, chatbot, …): Correctness manual only, Check Run Agents and Approvability never
  - billing: auto-refill off (dima), monthly workspace limit $100, CLI monthly $10, Murmur $0, per-review $10, per-PR $50
- ⚠️ **Status (commit summaries, $0.05 a commit) stays off on frame**: frame landed 1,736 commits on main in the last 7 days (`git rev-list --count --since='7 days ago' origin/main`), ≈ $87 a week, the whole credit
- no brew formula or tap exists (`brew search macroscope`, 2026-11-15); the cli is `prassoai/macroscope-local`'s `install.sh --tools none --no-path`: `~/.local/bin/macroscope`, no Claude plugin, no shell edits; signed in as dvakatsiienko (`macroscope me`)
- credit: $100 welcome credit (pr reviews), 1,000 agent credits a month, about $10, reset monthly (cli reviews)

## stress list
- github pr review, Budget — a side-lane pr (FRM-632 or FRM-633), a bytes pr — findings real / noise, $, minutes after push
- the same pr, Balanced via `@macroscope-app review using balanced mode` — one pr — findings delta vs Budget, $
- cli `macroscope codereview --base <sha> --mode budget --raw` — a quick-lane mods chunk at its end — findings vs sixth sense, seconds, agent credits
- cli on a herdr chunk — a quick-lane herdr chunk — same numbers
- pr summary written into the description — a side-lane pr — useful yes / no, does it clash with our pr body
- a reply to a finding on github — one disputed finding — does it concede or argue, a new charge or not
- spend read — Settings → Billing after each round — $ left, agent credits left

## rounds

- 2026-11-16 15:11–15:13 · cli, budget, `--base f9ce0aff --raw --isolate=false`, run by the mods codie (FRM-504 fix + FRM-634; the herdr codie's FRM-625 commits rode in: it read f9ce0aff..aa8b0123) · 124 s, exit 0, 67 of 67 code objects · findings 2, real 2, noise 0; 1 found only by macroscope (`x-mod-stash/hooks/register.tsx:7066`, a baseline never written, introduced by a review fix after both wisphunter reads), 1 in the herdr codie's code (`x-herdr-chatter/main.js:7118`, a thread switch keeps the old thread's 🍃 state), unjudged by its owner yet · cost: billing before (15:10) balance $100.00, spend $0.00; usage tab after (15:16) 257.5 agent credits = $2.58; the balance line still read $100.00 / $0.00 («usage data may be delayed by a few minutes»); credits before the round were not read, taken as 0 from the $0.00 spend (inference) · the free tier's 1,000 cli credits a month ≈ 3.9 rounds of this size
- 2026-11-16 23:03–23:05 · cli, budget, `--base 547e8a28 --raw --isolate=false`, run by the herdr codie (FRM-638 slice 2, 547e8a28..e5394378; FRM-641 steps 72–74, the Settings size and the mods lane's d00db524 and clipboard guard rode in: it read 547e8a28..HEAD) · 146 s, exit 0, 117 of 117 code objects · findings 8: 1 in another lane's file (`x-mod-guard/hooks/rules/clipboard.ts:33`, unjudged by its owner), 7 in slice 2's files, all 7 real, noise 0 · found also by the other reviews: 0 of 7 (the wisphunter round fixed a near cousin, a take-back racing its append; the sixth sense gave 🌼 clean at round 1 on e5394378) · found only by macroscope: 7, 4 fixed the same hour (`joins.js:126` a hold let go past its push sent nothing, `magic.js:93` a failed append left a ghost mark, `main.js:947` a push erased words typed during its take-back, `main.js:978` a refused send dropped when he had typed on), 3 named as limits (`magic.js:177` a «not taken» mark forgotten before its row is taken back, `magic.js:198` two row rewrites racing the lock, `queued.js:63` his text that opens with «<» not drawn while it waits) · cost: the cli printed no credits; billing not read (inference: about the 15:11 round's size, 117 objects against 67)
- 2026-11-16 23:24–23:25 · cli, budget, `--base 3c1626ca --raw --isolate=false`, run by the herdr codie (FRM-641 steps 72–77, f5bc6b55..131fd798) · 71 s, exit 0, 39 of 39 code objects · findings 4, real 4, noise 0, two of them one bug seen twice (`x-herdr-chat-settings/main.js:243` and `foreground.js:87`: a Reset pressed while his text colour is still being written loses to it) · found also by the other reviews: none ran on this chunk yet · found only by macroscope: 3 bugs, all fixed the same hour (that race, `foreground.js:59` a refused write counted as done, so a failed Reset threw away the colour from before; `main.js:161` a Background pill left his old hex in the colour box), red-proven by 3 new rows in `foreground.test.ts` · cost: the cli printed no credits; billing not read
- 2026-11-16 mid-drive read, told to dima: 9 of 10 findings real, 8 caught by nothing else; the monthly free cli credits spent in 2 days, $10.21 spent, $99.75 welcome balance left; kept on the welcome balance, one round per chunk with a tight base (his o140); no verdict yet
- 2026-11-18 11:15 billing read (the fleet Chrome, his tab): balance $98.75, $1.00 below the 11-16 read; a new billing period opened 11-17 (Nov 17 – Dec 17), spend $0.00 in it; limits read back: workspace $100, cli $10 a period, per review $10, per pr $50, Murmur $0, auto-refill threshold $10 / amount $50 · the cli's 1,000 monthly credits likely reset with the period (inference, the usage tab not read)
- 2026-11-18 11:20–11:21 · cli, budget, `--base fd1d546b --raw --isolate=false`, run by the mods codie (FRM-621 follow-up, uncommitted pull refusal) · ~60 s, exit 0, 36 of 36 code objects · findings 1, real 1, noise 0 (`x/go/mods.go:88`, a pull refused on a later path had already copied the earlier ones), found also by the wisphunter card; found only by macroscope: 0 (the card found 4 more) · cost: the cli printed no credits; billing not read
- 2026-11-18 11:29–11:31 · cli, budget, `--base 12ab7da3 --raw --isolate=false`, run by the herdr codie (FRM-638 slice 3, 12ab7da3..cc5d0d2a; clio's, the mods lane's and the frame hooks' commits rode in) · ~2 min, exit 0, review_coverage complete · findings 8: 3 in other lanes' files (`_clio/script/pocket-check.ts:702`, `home/.claude/shelf/hooks/reply-check.py:202`, `x/go/mods.go:104`, handed to clio unjudged), 5 in slice 3's files, all 5 real, noise 0 · found also by the other reviews: 1 of 5 (`x-herdr-chat/main.js:1601`, a Stop warning kept across a thread switch, the plain wisphunter card) · found only by macroscope: 4, all fixed in 1898af11 (`x-herdr-chatter/main.js:2530` Enter on an effort never read applied Medium, `:2482` a previewed effort stop took no click, `x-herdr-chat/band.js:410` a 🔓 press from another chat not pending, `x-herdr-chat/main.js:2177` a replaced transcript kept the old model and effort) · the two wisphunter cards found 6 + 8 others macroscope missed, two of them P1 (a permission pick typing into a question, blind presses on a screen with no mode line) · cost: the cli printed no credits; billing not read
- 2026-11-18 12:29–12:31 · cli, budget, `--base 92c1e5e9 --raw --isolate=false`, run by the mods codie (FRM-602: 2fe1c939, 5e669805, 11f94972; the herdr lane's and clio's commits rode in) · ~120 s, exit 0, 38 of 38 code objects · findings 3, 0 in FRM-602's files; 2 in the herdr deck (`x-herdr-deck/main.js:696` a steer submit that only logs, `:846` a link preview matched by a session-local ask id), 1 in clio's `pocket-check.ts:709`, all unjudged by their owners · cost: the cli printed no credits; billing not read
- 2026-11-18 13:27–13:28 · cli, budget, `--base 15acb8fd --raw --isolate=false`, run by the mods codie (FRM-643: 0216a3e1, a6d3c7ea, f7bd696c) · exit 0, 43 of 43 code objects · findings 0; the wisphunter card found 4 real on the same range (a 5 s `ps` spawn in every session the worst) · cost: the cli printed no credits; billing not read
- 2026-11-18 14:50–14:52 · cli, budget, `--base cf47cc8c --raw --isolate=false`, run by the mods codie (FRM-617: 35928365, a7fcf6c3; the herdr lane's commits rode in; the stash half unlanded, unseen) · ~2 min, exit 0, 31 of 31 code objects · findings 1, 0 in FRM-617's files; 1 in the herdr lane (`script/herdr-mods-land.ts:128`, a bad `mod.json` ends the `--watch` run), handed to clio; two wisphunter cards found 6 real on the same range · cost: the cli printed no credits; billing not read
- 2026-11-18 16:18–16:19 · cli, budget, `--base 424be275 --raw --isolate=false`, run by the herdr codie (FRM-638 slice 4, send time and «sent · read»: 7a581b7e; clio's pocket and the stray lane's doc commits rode in) · 56 s, exit 0, 24 of 24 code objects · findings 0 · on the same range the plain wisphunter card found 5 nits and 1 real question (a taken prompt read «read» at its send time until its `remove` landed), coderabbit 4 minor (1 real-ish, 3 test tightenings); all fixed in the follow-up commit · cost: the cli printed no credits; billing not read

## verdict
