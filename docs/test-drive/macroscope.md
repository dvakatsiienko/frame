---
status: live
until: 2026-11-22
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

## verdict
