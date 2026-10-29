---
name: cmt
description: «/cmt», «commit», «slay» — load on sight, even mid-sentence or after another instruction («approve, /cmt y, and next», «ask codie to sync, then commit and slay», «you can commit them too», «vibe», «mana»). Load EVERY time a git commit is about to be created, in any repo.
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

**Every keyword grants permission, never timing.** A commit lands when the work is complete and
verified, at a boundary a reader would want to bisect on. When Dima wants it this instant he says
so in words — "commit now", "push it".

### 1.1 · Never push mid-session

Commits accumulate locally; the remote is touched once, at the end.

- Without `push`: commit only — never push, never offer to.
- At session end say how many commits are unpushed and ask once whether to push.

### 1.2 · The standing grants — `y+` and `push+`

Each keeps its grant for the rest of the session, however a later commit is invoked; both die at
session end, a `/clear`, or Dima's revoke, never carried across a handoff.

- independent: `y+` covers only the confirm (a standing yes never reaches a remote); `push+`
  covers only the push (the draft is still shown unless `y`/`y+` is on too)
- while `push+` is on, §1.1 and the end-of-session unpushed count are suspended

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
  generated migration, a repo-wide rename. Volume alone never forces a split.
- Mechanics: one path set per commit, ordered so each commit leaves the tree working. Print the
  whole plan as subject lines before the first commit; one confirm covers the set.

## 3 · Author identity

**Commit under Dima's configured git identity, with no identity flags** — GitHub verifies only an
identity it can match to an account, and Dima wants verified commits (the investigation: the
header of `x/go/linear_push.go`, retired in `7e9ad33f` — `git show 7e9ad33f^:x/go/linear_push.go`).

📌 **The agent fingerprint is a trailer, not the author field.** Every agent commit ends with
an `Agent:` trailer (§4) and Dima's hand-typed commits do not, so `git log --grep='^Agent:'`
tells the two apart; older history carries `Co-Authored-By: Claude …`, and `git who` counts both.
In `frame` and `bytes` the `commit-msg` hook stamps it (`script/commit-agent-trailer.ts`, the why inside); elsewhere write it yourself.

## 4 · Body

- Hyphen bullets, one change per line, `subject: what changed`; `→` for before/after
  (`- model: sonnet → fable-5`). Prose paragraphs only for single-concern commits needing a why.
- 📦 bodies: `pkg old → new` lines + `- regenerate pnpm-lock.yaml`.
- End: the trailer `Agent: <role> · <model>` (`Agent: codie · Claude Fable 5.1`), stamped by the
  hook where it runs, one spelling. No `Co-Authored-By`, no `Claude-Session:` (Dima: useless to both sides; a
  `commit-msg` hook strips it in `frame` and `bytes`).
- Codie's step-commit names its step in the first body line (`step 3 of BYT-25: …`) so an
  interleaved `main` still reads as a sequence.

<!-- twelve trailer spellings once made `git who` a zoo (2026-09-03). -->

## 5 · Linear and the parser traps

A commit carries **no ticket line**: a PR is what links to Linear — its branch name
(`codie/<ticket>-<slug>`) and one `- ticket: FRM-N` line in its body; the id comes from the
conversation, the branch name or Dima, never a guess.

- **no closing keyword next to an id** — `close(s|d)` `fix(es|ed)` `resolve(s|d)` `complete(s|d)`:
  Linear's GitHub integration reads every push and would close the ticket; the close is clio's
  (or Dima's), made in Linear with a closing word
- **never the literal skip-ci markers** (`[skip ci]`, `[ci skip]`, `[skip actions]`,
  `[actions skip]`), quoting included: github reads them anywhere in the message and silently
  creates no run; write «the skip-ci marker»

<!-- bytes #84, 2026-09-12: «the [skip ci] note» in a body cost a pr its ci and review lane for an hour. -->

### The lanes

- **default: `main`** — no branch, no PR, the commit body carries everything
- **a codie lane: a PR** in its own worktree — the flow is `x:crew-codie`; the branch name `codie/<ticket>-<slug>` links it in Linear by itself, and its
  url reaches Dima as a one-click link the moment it prints
- **any other PR** (`claude/…` cloud branches, one Dima opens) — the same `- ticket:` line in its
  body, never a closing keyword; a branch never checked out here is worded with `gh pr edit`, never by rewriting
  remote commits

### A push to a repo with a deployed app arms the deploy watch

Green CI answers «did it fail», never «did it build» — the deploy state lives only in
`vercel inspect`. So the session that pushes `bytes` arms a `Monitor` on
`~/frame/_clio/.claude/hooks/deploy-watch.sh <sha> ~/projects/bytes` in the same turn (ci runs for
that head, then the newest prod deploy of every app the head touched; terminal states only, a
heartbeat every 2 min, 30 min cap). The reply says **done** only on the `Ready` line, and a red is
reported the moment it lands. `frame` deploys nothing — no watch.

## 6 · Completion criterion

Done when `git log -1` shows the new hash (a silent no-op and a silent sweep are both observed
failures), the tree holds nothing staged the plan did not name, and no closing keyword sits
next to an id in the body. Say the hash.

## 7 · Guardrails

- Sanity check before every commit: leftover debug/test code, commented-out code, stray
  debuggers → pause, report, resume when resolved.
- Pre-commit hook failure → never self-fix; summarize and stop. One exception: frame's known
  flake gets one identical retry (`~/frame/AGENTS.md`).
- a commit's output reaches you whole — the hooks print the only error channel there is; never
  `>/dev/null` a commit.
- in a shared tree, push the sha you counted — `git push origin <sha>:<branch>` — never the moving
  `HEAD`.
- commit only the paths the plan names, never `git add -A`: a shared tree holds other sessions' work.
- in a biome repo (frame, bytes) commit through `x lane commit msg.txt -- <paths>`, never a raw
  `git commit -- <paths>`, which also takes those files' unstaged hunks: it formats exactly those
  paths before staging, so a Bash-written file never meets the hook's format refusal.

<!-- >/dev/null turned a biome refusal into a bare «exit 1» (2026-09-27). a peer's commit landed 18 s before a push and went out unchecked (2026-09-26). the format refusal: 19 flawlog sightings by 2026-10-04. -->
