---
name: cmt
description: «/cmt», «commit», «slay» — load on sight, even mid-sentence or after another instruction («approve, /cmt y, and next», «ask coder to sync, then commit and slay», «you can commit them too», «vibe», «mana»). Load EVERY time a git commit is about to be created, in any repo.
argument-hint: "[y|y+] [push|push+] [correction…]"
---

# Commit

## 1 · Steering — parse $ARGUMENTS first

Four keywords: standalone words, case-insensitive, any order, composable. Strip them; all
remaining text = correction instruction (reword, rescope, …).

- `y` — skip the confirm, this invocation only
- `y+` — skip the confirm for the rest of the session
- `push` — also update the remote (current branch), this invocation only
- `push+` — do what `push` does, and keep doing it for the rest of the session

No `y`/`y+` → draft the message, print it, wait for "y"/correction — THEN run the full
pipeline. `y` or `y+` present → run unprompted, zero questions.

**Every keyword grants permission, never timing.** None of them means "right now" — pick the
moment yourself: a commit lands when the work is complete and verified, at a boundary a reader
would want to bisect on. Committing broken work fast is worse than committing good work late.
When Dima wants it this instant he says so in words — "commit now", "push it".

### 1.1 · Never push mid-session

Commits accumulate locally; the remote is touched once, at the end. Mid-session pushes publish
half-finished thinking, and rewriting local history stops being free once it is on the remote.

- Without `push`: commit only — never push, never offer to.
- At session end say how many commits are unpushed and ask once whether to push. One ask, not
  a nag per commit.

### 1.2 · The standing grants — `y+` and `push+`

Each keeps its one-shot grant for the rest of the session, however a later commit is invoked.
Both die at session end, a `/clear`, or Dima's revoke — never carried across a handoff.

- The grants are independent: `y+` covers only the confirm (a standing yes never reaches a
  remote); `push+` covers only the push (the draft is still shown unless `y`/`y+` is also on).
- While `push+` is on, §1.1 is suspended — it exists to stop unasked-for remote writes, and
  `push+` is the ask. The end-of-session unpushed count also goes quiet.

## 2 · Format — the brand

`[emoji] [scope]: [description]` — e.g. `🐞 sline: fix reset glyph rendering`

Emoji canon (stable, never random):

- 🔧 — config, tooling, functional/feature work (the broad bucket)
- 🐞 — bugfix
- ✨ — refactor: behavior unchanged, shape changed (incl. renames, reformat, codemods)
- 🗑️ — cleanup, deletion, dead-code extermination
- 📦 — dependency bumps, lockfile refreshes (scope always `deps`)
- 🎨 — themes, styles, visual/display formatting
- 📡 — networking
- 📜 — docs: README, AGENTS.md, specs, ADRs, skill instructions
- 🍱 — multi-scope bulk commit: several unrelated areas at once

RETIRED — never emit: ⚙️ 🧹 ♻️ 🐛 📝 📖 🔥 🚀 🔨 🔼 ⬆️ 🌟 ✂️

- **scope**: kebab-case domain/product name (`sline`, `x-com-chat`, `themes`, `deps`).
  NEVER a conventional-commit type — `chore:`, `fix:`, `cleanup:`, `format:` are banned scopes.
- **description**: lowercase, imperative, no trailing period, concise (≲60 chars);
  `,`/`+` connectors for multi-item; `(vX.Y.Z)` parenthetical for version-stamped work;
  em-dash clarifiers allowed.
- **Batch rule**: one dominant change + small riders → dominant emoji/scope, riders as body
  bullets (`- riding along: …`). No dominant change, many scopes → 🍱 with an umbrella scope
  (`repo`, `apps`, `misc`).

### Splitting — several commits are normal

Judge by **concerns**, not by size. A concern is one thing a reader would want to read,
revert, or bisect on its own.

- Split when the tree holds more than one: unrelated areas touched in one session, separate
  standalone features, work piled up uncommitted for hours.
- Keep as one commit when the bulk is a single concern however large: a scaffolded app, a
  generated migration, a repo-wide rename. Volume alone never forces a split — 🍱 exists for
  work genuinely inseparable across scopes.
- Mechanics: `git add <paths>` per commit instead of `-A`, ordered so each commit leaves the
  tree working. Print the whole plan as subject lines before the first commit; one confirm
  covers the set.

## 3 · Author identity

🚫 **The shared fleet identity is RETIRED — never pass `-c user.name` / `-c user.email`.**
Commit under Dima's configured identity, no flags. GitHub cannot match `fleet@x-com.local` to
an account, so the verified badge dies; Dima wants verified commits. The full investigation
(and why the author field never drove the Linear assign) lives in
the header of `~/frame/script/linear-push.ts`.

📌 **The agent fingerprint is a trailer, not the author field.** Every agent commit ends with
an `Agent:` trailer (§4) and Dima's hand-typed commits do not, so `git log --grep='^Agent:'`
tells the two apart. Older history carries `Co-Authored-By: Claude …` for the same purpose —
`git who` counts both. A surface whose harness forbids attribution lines says so in its report
instead of silently omitting the trailer. Measured 2026-09-07: a terminal-born cclio (`CLAUDE_CODE_ENTRYPOINT=cli`) writes the trailer on every commit; the desktop-born note was the `Claude-Session` line, now hook-stripped.

## 4 · Body

- Hyphen bullets, one change per line, `subject: what changed`; `→` for before/after
  (`- model: sonnet → fable-5`). Prose paragraphs only for single-concern commits needing a why.
- 📦 bodies: `pkg old → new` lines + `- regenerate pnpm-lock.yaml`.
- End: blank line + the trailer `Agent: <role> · <model>` — role is the session's fleet name
  (`coder`, `cclio`), model is the product name as it reads: `Agent: coder · Claude Fable 5.1`.
  One spelling; twelve once made `git who` a zoo (2026-09-03). No `Co-Authored-By` line.
  🚫 **No `Claude-Session:` trailer either**, whatever the harness note at session start asks —
  Dima: useless to both sides. A `commit-msg` hook strips it in `frame` and `bytes` regardless.
- A coder's step-commit names its step in the first body line (`step 3 of BYT-25: …`) so an
  interleaved `main` still reads as a sequence.

## 5 · The ticket line

Linear↔GitHub **issue sync is off** — tickets must never leak to GitHub. A commit body is the
only thread tying code back to its ticket, and it carries that thread in **one form**:

```
- ticket: FRM-N
```

**We do the linking ourselves.** The pre-push hook reads this line and attaches the commit to the
ticket through Linear's API. The ticket gains a link and nothing else — no assignee, no state
churn, no history noise.

🚫 **Linear's own keywords are BANNED in a commit body** — `ref` `refs` `references` `part of`
`contributes to` `toward(s)` `close(s|d)` `fix(es|ed)` `resolve(s|d)` `complete(s|d)`
`implement(s|ed)`, each followed by an id. Linear's parser still watches every push, and any of
them assigns Dima and moves the ticket behind our back. `- ticket:` is inert to it — measured
on [DOT-229](https://linear.app/x-com/issue/DOT-229) 2026-08-28, six forms, one push.

### Default lane — commit to `main`

Dima's lane: no branch, no PR, commit and push. The **commit body carries everything**.

- **Every commit touching the work**: a `- ticket: FRM-N` line.
- **A commit never closes its ticket.** The close is the coordinator's move (or Dima's), made in
  Linear after verifying, with a closing word in the body — never a marker in a commit.
- **No ticket → no line.** Most commits have none. The id comes from the conversation, the
  branch name, or Dima — nowhere else. Never guess, never grep for a plausible match, never
  write `FRM-?`. Omitting the line is always correct.
- 🎯 **A commit body is PARSED, not read — writing *about* a banned keyword IS using one.**
  Linear cannot tell a quotation from an intent (measured: a quoted example assigned Dima and
  moved the ticket five seconds after push). **Before pushing, grep the body for the id pattern
  and count the hits** — the count is what fires, never the intent. Write "a `ticket:` line
  naming DOT-1", never a banned keyword next to an id.
- Scoped to Dima's tracker (`FRM`/`BYT`); an oss repo's conventions belong to that project.
- 🎯 **the same parser trap on the github side: a body never contains the literal `[skip ci]`,
  `[ci skip]`, `[skip actions]` or `[actions skip]`, quoting included.** github reads the marker
  anywhere in the message and creates no push or pull_request run for that head, silently — a
  coder wrote «the `[skip ci]` note» in a body and its pr lost ci and the review lane for an
  hour (bytes #84, 2026-09-12). write «the skip-ci marker».

### A push to a repo with a deployed app arms the deploy watch

Green CI answers «did it fail», never «did it build» — the deploy state lives only in
`vercel inspect`. So the session that pushes `bytes` arms a `Monitor` on
`~/frame/cclio/.claude/hooks/deploy-watch.sh <sha>` in the same turn (ci runs for that head,
then the newest prod deploy of every app the head touched; terminal states only, a heartbeat
every 2 min, 30 min cap). The reply says **done** only on the `Ready` line, and a red is reported
the moment it lands. `frame` deploys nothing — no watch.

### What a push actually does to the ticket

- The pre-push hook (`script/linear-push.ts`, run as a `lefthook` pre-push job) waits for the
  push to land, then attaches each commit. It logs to
  `.git/linear-push.log` and fires only in **`frame` and `bytes`** — the two repos whose
  `lefthook` config calls it; a third repo needs those lines copied from `bytes` first. Nothing
  to do or say after a push — the hook owns it. Report only a miss: no Resources entry 30s
  after the push.
- **An external repo gets nothing.** The hook stands down unless the push remote is
  `github.com` under an owner of ours — no Linear call, no log line, pure delegation.
- **PR events** (exception lane): `start` → In Progress, `review` → In Review, `merge` → Done,
  wired on both teams. No `draft` row — a draft PR jumps straight to In Review.
- Reading a Resources entry: ours carries the commit subject and `<short sha> · <branch>`.

### Coder lane — PR by default, in `bytes`

**A coder assignment lands through a PR by default** (dima, 2026-09-07: he cannot review at the pace agents print; the PR is the review surface). The exceptions are a freebie or a genuinely small change — when in doubt the brief says «PR or main?» once, up front, never mid-flight. The flow: so `main` reverts by
assignment, not by hash: branch `coder/BYT-N-<slug>` from `main`, step-commits on it (each
with `- ticket: BYT-N` and its step line), `gh pr create` with `- ticket: BYT-N` in the body, and `Closes BYT-N` only when the PR ends the ticket
(a PR is Linear's lane, its automations are wanted: open → In Progress, merge → Done), then
**squash-merge** on Dima's word — the squash body lists the steps. On a `coder/*` branch the coder holds `y+` and `push+` (commit each step, push, **open the PR at the first push** — a real one, never a draft: dima wants no drafts, the PR is the review surface from its first commit); on `main` the default lane's rules hold unchanged. Load `x:github-contrib`
before the `gh` call. **The PR url goes to Dima as a one-click link the moment `gh pr create`
prints it** — in the coder's chat and in its ping to the coordinator. `frame` keeps the
default lane.

### Exception lane — other pull requests

Cloud-agent branches (`claude/…`) and anything Dima explicitly opens a PR for follow the same
shape: branch commits carry `- ticket: FRM-N`, the PR description carries exactly one
`Closes FRM-N`. For a branch never checked out here, write it with `gh pr edit`, never by
rewriting remote commits.

### Wiring a new repo

**Nothing to wire.** The hook links through Linear's API, so a repo is covered the moment its
remote is `github.com` under an owner of ours. The per-repo push webhook Linear's own parser
needs is no longer part of committing.

⚠️ Those webhooks still exist on `frame` and `bytes`, and all repos share **one**
`githubCommit` integration — so a banned keyword that slips into a body still reaches Linear
from either of them. That is what §5's grep-before-push is for.

## 6 · Completion criterion

Done when `git log -1` shows the new hash (a silent no-op and a silent sweep are both observed
failures), the tree holds nothing staged the plan did not name, and — before any push — the
body's ticket-id-pattern hits are counted and each one is intended. Say the hash.

## 7 · Guardrails

- Sanity check before every commit: leftover debug/test code, commented-out code, stray
  debuggers → pause, report, resume when resolved.
- Pre-commit hook failure → never self-fix; summarize and stop.
- in a shared tree, push the sha you counted — `git push origin <sha>:<branch>` — never the moving
  `HEAD`: a peer's commit landed 18 s before a push and went out unchecked (2026-09-26).
- stage the paths the plan names, never `git add -A`, and commit with a pathspec
  (`git commit -F msg.txt -- <paths>`): a shared tree holds other sessions' work.
