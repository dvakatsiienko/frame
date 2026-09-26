---
name: github-contrib
description: Load BEFORE any `gh pr` / `gh issue` command, before writing a PR title or description, before filing or editing an issue, and whenever asked to watch or babysit a PR.
---

# github contributions

conventions for pull requests and issues — the `gh` mechanics under the lanes in `x:cmt` and
`x:coder-brief` (a coder's assignment lands as a PR by default; dima's own lane is `main`).

## pull requests

- titles follow the target repo's conventions — simple, clear; conventional-commit style where
  the repo uses it: `fix(web): new threads no longer spike CPU`.
- descriptions: the problem in a sentence or two, then how you solved it. end with a blurb
  naming the model and harness that did the work.
- **one concern per PR** — if the description says «also», split it.
- **never a draft.** a PR opens real at the first push and stays the review surface while the
  work continues; review bots and dima read it as it grows.
- rebase onto latest main before opening; stale branches waste a review round.
- UI changes need before/after images; motion or timing needs a short video. upload evidence to
  GitHub — never commit PR-only screenshots or assets into the repo.
- **babysitting**: poll checks and comments newer than the last push; verify each bot finding
  against the source; fix real ones, dismiss false positives with a written reason; fix CI
  failures, distinguishing real breaks from infra flakes. nothing new → stay quiet. stop when
  the bots are green on the latest commit.
- **reading a reviewer, measured 2026-09-11**: the ci reviewer posts to a different endpoint per
  round — poll all three (`issues/N/comments`, `pulls/N/reviews`, `pulls/N/comments`), never
  the workflow run (an `issue_comment` workflow runs on the default branch; `gh run list
  --branch` never shows it).
  an inline thread is answered only through `POST /pulls/{n}/comments/{id}/replies`; a
  top-level comment does not count as a reply.
- **the bytes review lane**: `gh pr edit <n> --add-label '🤖 review:requested'` starts the ci
  reviewer on this head; the guard publishes `review:clean`, the required check on main —
  never created = blocked. a later push leaves it stale — re-review = remove + add the label,
  at most twice per pr, a third round on dima's word. read the counter before every label, never
  from memory: `gh api 'repos/<o>/<r>/actions/workflows/review.yml/runs?branch=<head>' --jq
  '[.workflow_runs[] | select(.conclusion=="success")] | length'` — at 2 the label does nothing. 📌 a green `review:clean` means a review ran; until the reviewer's
  own verdict marker gates it, the findings live in its comment — read that.
- a claude-code-action pr that edits a workflow already on the default branch IS reviewed
  (measured 2026-09-12: #79 got two rounds with verdict lines; the «self-skips» belief in
  older comments was wrong). only a pr that edits `claude.yml` itself is unproven.
- `performed_via_github_app` exists on issue comments only — absent on `pulls/N/comments` and
  `pulls/N/reviews`; identity of an inline thread comes from `user.login` + `user.type`.
- a `gh api …/runs` waiter keys on `id > <last seen>`, never on `status == completed` with
  `per_page=1` — that matches the PREVIOUS run and returns instantly (two false «done» reads).
- `gh pr review …` without a checkout needs `--repo <o>/<r>`, or it dies on «not a git
  repository».
- **`--delete-branch` on a merge auto-closes every pr based on that branch** — `gh pr list
  --base <branch>` before the merge; retarget the stacked prs first (#80 died this way).
- **when main moves under an open pr, merge it into the branch within the hour** — github creates
  no `pull_request` run while a pr is CONFLICTING (no merge ref), and `gh pr checks` reads «no
  checks reported» as calm; ten heads ran nothing on dotfiles #45 (2026-09-20). a red run beats no run
- **a merge that changes a `package.json` is followed, in the same turn, by `pnpm install` in the main
  checkout and a restart of every live dev server it feeds** (`launchctl kickstart -k gui/$(id -u)/<label>`) —
  a pull alone left atelier's `:5180` on a vite «failed to resolve import» overlay for half an hour
  (bytes #102, 2026-09-26); vite keeps a failed resolution until it restarts
- **the pr body is the squash-merge commit message** — it describes what landed, never the plan,
  and carries no session-url trailer (the commit contract bans it; the harness's pr-body ask would
  smuggle it in through the squash)
- **a push to main after a pr opened does not refresh that pr's base** — the diff keeps showing the
  coordinator's commits (#42: 46 files for a 7-file change) until `gh api -X PATCH repos/<o>/<r>/pulls/<n>
  -f base=main` nudges github to recompute; run it after every main push while a pr is open.
- merge only per the disposition given (merge-when-green, or stop and report). none given →
  report and ask.
- a merged PR is the implementation record — close or update the tracking item when the work
  lands; keep no second checklist in the repo.

## issues

- **before filing**: read the repo's issue templates and `CONTRIBUTING.md`, run
  `gh label list`, search open issues for a dupe. dupe found → comment there instead.
- **labels are mandatory** — pick from the repo's actual set, or say in the issue why none
  fits. never file bare.
- on a repo we do not own, labels are the maintainers' to set: `gh issue edit --add-label`
  answers «failed to update» without saying why. name the labels you would pick in the body
  instead, and never report them as set.
- fill the template's fields; a bug report carries repro steps and a version/environment block.
- write it easy to read by a human and easy to resolve by an agent.

## completion criterion

done when the PR or issue is in the state the request named — labeled, templated, and you have
said which state that is. a PR left open when the request said merge-when-green is not done,
and neither is one merged when the request said report and ask.

## github api reads

- **a ci watcher waits for the run to exist before `gh run watch`** — github creates the run a few seconds after the push; asked at +15 s for the head sha it answered nothing and the watcher died on a 404 (2026-09-23). poll `gh run list --commit <sha>` until an id appears, then watch that id
- `gh api --paginate` emits one json array PER PAGE — `.[0]` reads the first 30 items and looks
  complete; fold with `jq -s add` (a review guard nearly read half the threads, 2026-09-11)
- a poller that seeds its window at «now» is blind to everything that made it worth starting —
  seed two hours back (greptile's findings sat unseen for a round, 2026-09-11)
- **a conflicting pr gets no `pull_request` run at all** — github creates none without a merge ref, and «no checks reported» reads calm. main moves under an open pr → merge it in within the hour (ten heads ran no ci, 2026-09-20)

## posting under dima's account outside our repos

an issue, pr or comment on a repo we do not own, written by an agent and posted with dima's `gh`,
ends with one footer line so the maintainer knows who typed it and that dima stands behind it:

    — printed by Claude Code, signed by me.

his account carries the accountability, the footer carries the honesty. the text itself is
written through `x:writing-for-humans` — load it before the first draft. never a `[bot]`
impersonation, never silent. inside our own repos the app identities (`x-coder-cc`,
`x-reviewer-cc`) do this job instead.
