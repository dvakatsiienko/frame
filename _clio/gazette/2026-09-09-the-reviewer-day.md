---
date: 2026-09-09
slug: the-reviewer-day
tickets: [BYT-37, BYT-81, BYT-82, DOT-26]
posted: {health: yes}
---
# 🗞️ cclio's gazette · the reviewer day — coderabbit steps back to the cli, claude code takes the pull request

## shipped

- **the coderabbit github app is uninstalled** — free plan reviews nothing (summaries only, 10-star gate); only linear's webhooks remain on `bytes` + `dotfiles`. the cli moved from a hand-installed 0.3.1 to brew's cask **0.7.6** (Brewfile line, authed, `doctor` 9/9, token never expires). `.coderabbit.yaml` left bytes: the cli reads config only through `-c <files>`, and `CLAUDE.md` is the intended input. the `coderabbitai/skills` package judged dead weight on all three channels (thin wrappers, one skill needs the gh bot, flags stale) — not installed.
- **claude code reviews bytes pull requests** — `.github/workflows/claude.yml` (#63): `@claude review [focus]` runs the `code-review` plugin skill with inline comments, any other `@claude …` is interactive and may push to the branch; opus-5 `--effort high`, `--max-turns 30`, `allowed_bots: x-coder-bot[bot]`, subscription oauth token as a repo secret on both repos. no `pull_request` trigger: the coder pushes freely, the review starts on the comment. labels were considered and dropped as friction (option c locked in the plan).
- **proven on a bot pr** — #64 opened and commented by `x-coder-bot`: one inline finding on the planted off-by-one, 18 turns, 198 s of claude, 3m49s job wall time. two failures on the way, both fixed the same hour: the skill skipped the pr titled «throwaway» (it skips prs it judges trivial), and a vercel deploy comment cancelled the review through the shared concurrency group (#65 keys the group on the `@claude` predicate).
- **`x:coder-brief` 0.11.47** — «final» now reads: `coderabbit review --agent --base main -c CLAUDE.md` → fix → `code-review` → fix → push → `@claude review` → fix real / «declined: why» → at most one re-request → `gh pr edit --add-reviewer dvakatsiienko` → the word. a rate-limited tool is skipped and named, never waited on.
- `cclio/docs/gh-stack-adoption.md` tracked in git: step 0 ticked, step 1 all but the human-authored exit, step 2 wired.

## tricks gained

- a github app installation token can open prs and comment but not delete branches or call `/user` — the deletion is dima's `gh`
- `issue_comment` workflows run only from the default branch — a workflow pr cannot prove itself
- the action posts nothing until the run ends (`classify_inline_comments` buffers); a quiet pr mid-run is normal
- `coderabbit review` flags on 0.7.6: `--agent`, `--uncommitted`, `--committed`, `-c` — `--prompt-only` and `-t` are gone, docs and skills still name them
- never `coderabbit update` when brew owns the binary; `brew upgrade coderabbit` is the path

## state

- dotfiles `c702663`, bytes `4ca72eaf`, both clean on origin; no coder, no worktrees
- open: the human-authored review (dima's next pr) · greptile, step 3, fresh session · the cr `--show-prompts` probe on the first coder run · three inbox questions (renovate avatar, vercel quota research, graft eval) parked in the flowlog, inbox kept on dima's word
- inherited, unverified from here: the 16:00 interview, the vercel cap reset + prod redeploy, the first evergreen digest, DOT-228 run 2, the trophy-sys redesign morning

⸻ upd 20:45

## shipped (evening)

- **greptile is the second reviewer — step 3 of the stack plan wired** (dima's clicks + claude-in-chrome for the dashboard): app on `bytes` only, starter plan behind a 14-day pro trial; cli 3.5.2 via pnpm global (no brew formula), `x-com` org, `init` says enabled; `config` reads every `CLAUDE.md`, `AGENTS.md` and `.cursor/rules/*.mdc` in the repo as review rules on its own; dashboard: auto-review on commits off, description update off, «fix in claude» off, filters `source branch exclude renovate/*` (verified after reload); skills `greploop` + `greptile-cli` at user scope — greploop is a real evidence-based fix loop, kept; the marketplace «greptile» plugin is an http mcp, skipped. dima: «mcp is not good for us, cli is faster».
- **`x:coder-brief` 0.11.48 → 0.11.49** — the «final» chain is now coderabbit → matt's `code-review` (named explicitly, the ci action runs the built-in one) → greploop (cap 1) → push → `@claude review` + `@greptile review` in the same minute → add-reviewer → the word; the retro names which layer found what nobody else did. 0.11.49: pnpm 12 dropped the `-s` short flag and broke every `pnpm -s …:agent-token` snippet the same evening — `--silent` everywhere.
- **the measurement run, written as step 3b** of `cclio/docs/gh-stack-adoption.md`: the next two real coder prs run all three local tools on the same final commit before any fix, one sheet per tool (true, noise, time, unique, credits); decision 1 = which cli goes first in dima's fallback chain (coderabbit → greptile → matt's, by quota), decision 2 = greptile cli-only, ci-only or both. the brief switches after pr 2.
- **evergreen v2 — `cclio:evergreen` 0.3.32 → 0.3.34** after the taste interview: one card per major (brings, breaks, since last major, 🔬 deep with researched numbers and a source), ci-only majors are cards, minors fold, the brew lane rides the same digest with its own ➡️, «approve evergreen» runs merges + `brew upgrade` by cclio, conflicted prs get renovate's rebase box ticked, peer-range holds close with a comment. the «breaks» answer now reads every dependant's peer range first — the fork said «merge» on graphql 17 from a src grep while `@apollo/server` 5.5.1 declares `^16.11.0` (the coder had said so the day before). evening additions: `pnpm install` after the round, `pnpm dedupe` as its own deliberate commit, a weekly skills lane (`npx skills update`, `greptile skills update` — the convex set in `apps/x-com-chat` sat 5 months stale because nobody looks there), and a grep of our own cli flags on a pnpm major.
- **first evergreen round merged**: bytes #57 pnpm 12, #61 postgres 18, #66 checkout v7; dotfiles #35 pnpm 12 (`11bcd98`). bytes #56 graphql 17 closed on the apollo peer range; dotfiles #36 vitest 5 hit the lockfile conflict and waits on renovate's rebase. brew: 21 upgraded (pnpm 12.3.4, gh 2.100, iterm2 3.7 with its claude-code tab status). vercel cap reset confirmed, trophy-sys prod built 15:29 off `4ca72eaf`.
- **vercel quota, researched and closed** — dima's inbox: «why skipped builds count as a used deployment». vercel's monorepo doc: «canceled builds initiated using the Ignored Build Step count towards your deployment and concurrent build limits» — the six `turbo-ignore` lines removed on 09-07 were the burn. the built-in skip holds no build slot (daily-count effect unstated, inferred separate bucket); `deploymentEnabled: false` is the only certain zero; the 100/day is per **account** (9 projects on it), so separate repos would not change the cap. api check: `enableAffectedProjectsDeployments` true on all six. → `memory/dima-stories.md` «sounds like cheating from VC side».
- **x-com-chat scoped, three tickets in order** after a read-only pass over the app: [BYT-81](https://linear.app/x-com/issue/BYT-81) routes by friend name, threads per friend with a header selector (pill with the count, «＋ new thread» replaces a wipe button, in-row delete confirm, groq-generated titles, a ghosted intro bubble as the empty state), chat created on the first message, the theme one-liner (`dark` hard-coded into `<html className>`), an ai-sdk wiring review; [BYT-82](https://linear.app/x-com/issue/BYT-82) per-user threads after a five-question grill (anonymous cookie owner, claim on sign-in, github first, `/api/chat` guarded with a per-owner rate limit); [BYT-37](https://linear.app/x-com/issue/BYT-37) rewritten as the instant-shell pr on top. 81 and 82 are the two measurement prs; dima promoted both to Todo. found on the way: chats are global today (clerk is ui-only, no `ctx.auth` anywhere), `typescript.ignoreBuildErrors: true`, `initChat` and `getChatByFriend` duplicate each other.
- **tails**: the interview skill retired (cclio 0.3.31, `7daedad`); flawlog debt from 09-08 landed (worktree in-use check via live session cwds, the three bash-sandbox shapes in `fleet-hazards`, «measurement vs standing fact» as pre-write question 5); `.cursor/rules/` audited — five 2025-07 files, eight live lines move into `guide-typescript` / `guide-react`, the rest (a `React.FC` template, prettier, a 332-line ultracite dump greptile would read as review rules) is deleted on the next coder day with a root `AGENTS.md` pointer for cursor; graft skipped (the oss cli has no markdown nodes — its own video says «graft only maps code», the doc-linking fork is the author's paid community); renovate's avatar is mend's app identity, self-hosting for a logo discarded; [DOT-26](https://linear.app/x-com/issue/DOT-26) is dima + cclio on fable, tomorrow; spawn-init sound at 0.2.
- **the fleet map** — one page for a tech interview and for dima: roster, an svg flow of members ↔ git-tracked stores ↔ linear/github/vercel with dima as the gate row, four cards, six strengths against six weak parts. [x-com fleet](https://claude.ai/code/artifact/24c4be13-4f6f-4ff7-a4c6-78bc2810a73c), three redeploys until the diagram breathed and fit without a scrollbar.

## tricks gained (evening)

- a conflicted renovate pr is rebased by ticking the `<!-- rebase-check -->` box in its body — `gh pr edit --body-file` with `[ ]` → `[x]`; the hosted app documents no comment command
- pnpm 12 removed the `-s` short flag; `--silent` and `--reporter silent` remain
- greptile's cli `config` shows the org-level rules it reads (every `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`) but «filters: none» even after a dashboard filter is saved — that field reads repo config files; the dashboard rule is the one that fires
- vercel's `skills` cli cannot update skills installed before skillPath tracking — one `npx skills add <source> -y` re-adds them, updates work after
- `greptile login` needs a live terminal for the oauth callback (a 20 s timeout kills it); `whoami` exits 0 even signed out — gate on its text
- the api field for vercel's built-in monorepo skip is `enableAffectedProjectsDeployments` on `/v9/projects/<id>`; the cli exposes nothing

## state (evening)

- dotfiles `dd6e4d7`, bytes `a7c0627e`, both clean on origin; no coder, no monitor, no worktrees
- open: dotfiles #36 vitest 5 on renovate's rebase; the greptile empty-open credit question (measured on BYT-81's pr; yes → a `review-ready` label rule, his word first); `npx skills add get-convex/agent-skills -y` in x-com-chat before the coder
- tomorrow: dima reads BYT-81 / 82 / 37 cold and steers → opus coder on BYT-81 → DOT-26 with dima on fable → DOT-228 notes bench in watch-mode (lanes one at a time on his «go»); graphite after the stack settles

