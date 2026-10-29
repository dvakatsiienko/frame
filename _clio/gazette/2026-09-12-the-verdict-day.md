---
date: 2026-09-12
slug: the-verdict-day
tickets: [BYT-92, BYT-93, BYT-94, DOT-26, DOT-237, DOT-243]
posted: {health: yes}
---
# 🗞️ cclio's gazette · the verdict day — the gate learns to read, a probe says no to the native way, and cclio gets a face on github

## shipped

- **the gate reads the verdict** — [BYT-92](https://linear.app/x-com/issue/BYT-92) done (#79 + #83): the ci reviewer ends every round with `verdict: clean | findings` in its sticky comment, the guard requires the line, and the decision lives in `review-gate.jq` with fixture cases and mutation checks (20 cases, 8 mutations, 12 real defects found by 4 reviewers across the two prs). measured live the same afternoon: findings → red and counted (#82 run 9), clean → green and counted (#82 run 11), unjudgeable → red and uncounted (runs 6–8), dima's approval → green (#83's own lane, on itself). a `renovate/*` lane publishes the check on green ci, actor renovate. the answer lane (5 of the 12 defects) is gone: past the cap the owner approves, 887 lines deleted.
- **the probe that said no** — dima: «i lost track of how pr merge protection is driven… overcomplicated». a research fork proposed the native design (require 1 approval + conversation resolution, the reviewer approves as the app); the coder probed it on a scratch pr: an app's APPROVED review is recorded and `reviewDecision` stays `REVIEW_REQUIRED`; one human approval flips it. so bot approvals cannot gate, the parser stays, and dima's verdict on the shape lives in [BYT-94](https://linear.app/x-com/issue/BYT-94) for the greptile-ci decision on 2026-09-16.
- **ci matrix** — [BYT-93](https://linear.app/x-com/issue/BYT-93) done (#82): a clean-clone filtered install per vercel app, read from each `vercel.json`; the renovate validator only on its file, postgres in its own job, chromium only when kit tests run. the round found a `needs:` edge that had made the required check skippable — the #72 trap, in a file that documents it.
- **evergreen** — jotai 3, npm-run-all2 9, the patch group (biome 2.5.12 unmasked a wrong optional-catch-all type in x-com-chat; the suggested fix would have crashed `/chat`), brew 13 upgrades (pnpm 12.4.1, node 26.8.2, vercel 59.16). finding: renovate prs could not merge since #75 — the gate had no path for them; `--admin` once, the renovate lane since.
- **cclio's face** — github app `x-cclio-cc` (4921020) on bytes + dotfiles, `pnpm github:agent-token x-cclio-cc`; attribution only, an app approval never counts. **init mini** (`/cclio:init mini`, cclio 0.3.40): healthcheck, inbox read-only with ✅ in place, no cst, no flowlog. **plugin eval** first run on plugin-x: `x:cmt` fires on «commit this» (Δ +1.00), two cases flaky at one run; the instrument for [DOT-243](https://linear.app/x-com/issue/DOT-243) only, results gitignored.
- **smaller**: [DOT-237](https://linear.app/x-com/issue/DOT-237) loses the raycast-ios research line (answered: a companion keyboard, no letter layout); [DOT-26](https://linear.app/x-com/issue/DOT-26) gains gifs (vhs + gifski installed, a gif is a screen recording, no base images), bot identities (vendor bots keep their names, vercel avatars are the one lever) and the notifications tune; `.node-version` = `24` in both repos, fnm stays (volta's readme says unmaintained, mise is the only live alternative); wispr flow + superwhisper in the Brewfile.

## tricks gained

- github closes a pr whose base branch is deleted — retarget stacked prs before merging the parent with `--delete-branch`
- an installed app's `author_association` is NONE: its reviews never satisfy a required-approval rule, in either direction
- the coder app cannot push or delete refs (no `contents: write`); api writes wear the app, pushes are dima's git
- runner jq is 1.7, the mac 1.8 — a jq program is proven when ci compiles it; `sd`/`sed` silently eat `${{ }}` in workflow files
- two negative turbo filters intersect; `turbo run --dry=json` lists packages with no such script
- a `gh api …/runs` waiter keys on `id > last seen`, never `status == completed`
- `performed_via_github_app` exists on issue comments only; `gh pr review` needs `--repo` without a checkout
- the `--case` flag of `claude plugin eval` takes one glob; a second is dropped

## state

- bytes `9870956e` + cclio's `.node-version` commit unpushed; dotfiles 4 commits + the flush unpushed; 0 open prs, coder `2ee2daa4` stopped after its retro
- next: wispr flow snippets with dima, the finance sub-item, the ralph first run on the guard fixtures, BYT-84, knip; 09-16: greptile-ci + BYT-94

⸻ upd 00:30 (2026-09-13)

## shipped (evening)

- **vercel zero, by deploy hooks** — [BYT-84](https://linear.app/x-com/issue/BYT-84) done (#84): vercel's git integration is off on all six apps; a `deploy.yml` job on push to `main` curls per-project deploy hooks for the apps turbo lists as affected, vercel still builds on its side. researched first at dima's ask: canceled deployments count toward the hobby cap (three vercel pages, 2026-08), `deploymentEnabled: false` is the only true zero, hooks survive it (probed on cv before any edit). the coder minted the six hooks and the secret itself (`vercel deploy-hooks create`, local cli auth, no token). first main push: job 36 s, cv prod Ready 15 s later. riders: `workflow_dispatch` per app, a job summary, no install in the job, a commit-msg guard for the ci-skip markers (proven by failing; dotfiles copy the same night). the why lives as an html comment in bytes root `CLAUDE.md`: a hobby-plan workaround, unnecessary on pro. follow-ups born in triage: [BYT-95](https://linear.app/x-com/issue/BYT-95) workflow_run lane, [BYT-96](https://linear.app/x-com/issue/BYT-96) preview lane by label (x-com-chat bumps build unbuilt until then, dima's call), [BYT-100](https://linear.app/x-com/issue/BYT-100) the review guard's jq argv overflow + the unguarded pr body.
- **ralph retired** — research: huntley's post is 2025-07, the plugin stale since 03-28 with 11 open stop-hook bugs, `/goal` is the native loop; the zenith study says a loop fights premature completion, not model iq, and earns tokens only when a task outlives one context. plugin uninstalled, [DOT-1](https://linear.app/x-com/issue/DOT-1) holds the `/goal` trial for the next long spec build; knip became [BYT-97](https://linear.app/x-com/issue/BYT-97), two granular steps, never a loop target.
- **the triggers, measured** — `claude plugin eval` ×4 on dima's real prompts: pm 12/12; notes 2/9 → 9/9 («flowlog», «notion» as literal words); cmt 1/12 → 12/12 once the description LEADS with «/cmt», «commit», «slay» and says «even mid-sentence or after another instruction». x 0.11.70. [DOT-243](https://linear.app/x-com/issue/DOT-243) carries the finding; the eval is the proof step for any description edit now (memory-nurture skills lane).
- **the burn** — the BYT-84 coder took ~85 % of a 5-hour window in 75 min: 638 turns at 250–460k context, 180M cache reads, 567k opus output; ci ping-pong with two adversaries and its own novel-length bodies. dima: no ceilings, no early auto-compact; trace the cases in `cclio/docs/ctx-burn-log.md`, dig in when it repeats.
- **smaller**: wispr flow answered research-backed (experimental tab = beta, press-enter is a spoken phrase, no claude desktop hook, notetaker replaces granola for english mac meetings, hooks read via remote mcp only, ukrainian dictation unclear); read-aloud: wispr + superwhisper have no tts, siri Voice 4 beat every premium voice in dima's ear, the Pronunciations table is the lever, sotto the free upgrade ([DOT-27](https://linear.app/x-com/issue/DOT-27)); finance: a mono usd virtual card topped up after salary, date sync only via cancel + resubscribe; monorepo project is bytes-only (DOT-245 → BYT-98, DOT-241 → BYT-99); dima's tools mil reordered DOT-26 → 39 → 147 → 237; his priorities 1–8 in the queue; PO doc-noise folded into DOT-244, the sys no-refetch gremlin into BYT-88; english practice stays on typed prompts only (wispr auto-fixes the rest).

## tricks gained (evening)

- github honours `[skip ci]` anywhere in a commit message, quoting included — no run created, silently; file contents are exempt. a `commit-msg` hook in both repos now
- no run at all reads like checks pending: ask «was a run created», never «is a check green»
- turbo `--affected` reads commits, not the working tree; refuses the literal `HEAD`; a root file with no dependants affects nothing — `globalDependencies` for `.npmrc` + `pnpm-workspace.yaml`
- a probe without a positive control is a coin flip (four attempts, three wrong, one backwards)
- linear: a project shared by two teams shows its tickets in both triages; one team per project
- a fork brief for a long run must say «wait in the foreground» — two forks ended on background watchers
- an echoed ⏳ block is an accept; an ask leaves the fence the turn it is verdicted

## state (evening)

- dotfiles `1c13abf` + the halt commit, bytes `946f1669`, both on origin; no coder (BYT-84's stopped after its retro), no worktrees, 0 open prs
- tomorrow: the created-count read (zero canceled?), then dima's priority 1: BYT-95 → BYT-96 → BYT-100; 09-16 greptile-ci + BYT-94; DOT-26 waits on his word
