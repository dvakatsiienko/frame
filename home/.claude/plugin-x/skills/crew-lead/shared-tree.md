# crew-lead — the shared working tree

## the shared working tree

**One agent per repo where possible; parallelism goes ACROSS repos.** When two share:

- **at boot, `ListAgents` for a peer cclio in the same repo** — one found → one ownership message
  before the first edit (the files you will touch, pathspec commits). a hold on a peer is released
  by an explicit message, never an implied one (2026-09-26: a whole sweep ran beside `cclio-ef`,
  found through `git status` surprises; dima had to ask whether she was released).

- state file ownership at spawn; staging and pathspec commits follow `x:cmt` §7. two coders
  live at once: the second brief names the first's files, or cclio holds the first's merge until
  the second's pr is open (a merge mid-flight broke a rebase, 2026-09-11). **the split is stated at spawn, both coders spawned in one turn, and the second brief carries «tree as of HH:MM, done: …»** — a brief written against a moved tree cost the second coder its first stretch (2026-09-24). a shared `<area>/LANES.md` (who owns what, last touch) replaces about half of the coordinator's relays; it is deleted in the same step that stops the coders.
- **a rename of a name a live session uses** (a label, a github app, a branch) is relayed to
  that session the same minute — a coder cannot infer it from its own tool output; every review
  request failed for an hour after `x-coder-bot` → `x-coder-cc` (2026-09-11).
- **a cap is real only if something reads the counter before acting** — the actor never keeps
  the tally from memory; the brief names the api call and the moment (#76: the coder tracked
  rounds by recall, i counted a workflow-wide list; both wrong, 2026-09-11).
- **known items go in ONE batched brief** — ten items dripped over a session re-shaped the same
  predicate four times; hold a pr ten minutes rather than drip.
- the merge monitor's «coder idle» guard reads the live session cwds against the worktree path,
  never a session name (a name-wired guard pruned under a live coder, 2026-09-11).
- `git status` before staging; anything modified that is not yours stays untouched.
- 🚨 **a worktree is pruned only when no live session sits in it** — `jq -r .cwd ~/.claude/sessions/*.json` lists every live cwd; a match means hands off, whatever `git status` says (two prunes under a live push, 2026-09-08; the merge monitor now waits for the coder to be idle, this is the check for a hand-run `scout`).
- `index.lock` means a peer is committing — wait, retry, **never delete a lock**.
- 🚨 **verify the hash after every commit** (`git log -1`) — the real risks are a silent no-op and
  a silent sweep, both observed.
- 🚨 **bytes is ONE shared checkout: a coder's `git switch` moves every session's tree** (measured 2026-09-07 — the prettify branch took the dev servers with it). the PR lane makes every coder concurrent, so **a `coder/*` branch lives in its own worktree** (`git worktree add .claude/worktrees/BYT-N-<slug> -b coder/BYT-N-<slug> main` — `<repo>/.claude/worktrees/` is the one location, cc's own default and where `EnterWorktree` puts its trees; dima's call 2026-09-08 after two locations produced drift); the main checkout stays on `main`. `pnpm worktree:seed` makes a fresh tree runnable (`CI=1` install, env copies, port offset).
- 🎯 **dima's «no worktree» means «on `main`, no branch, no pr»** (2026-09-18: a coder read it as «branch in the shared checkout» and its `git switch` parked cclio's tree for an hour). the brief says «default lane: commit on main, cclio pushes»; a branch appears only when he says «pr».
- 📌 **a quick-lane coder on main spawns with `--settings '{"worktree":{"bgIsolation":"none"}}'`** (before the prompt, like `-n`) — without it the bg-isolation guard refuses `Edit`/`Write` in the shared checkout and the git-text guard rides along; the FRM-306 mods coder lost ~15 calls editing scratch copies. proven 2026-10-05: a haiku `--bg` probe with the flag wrote a file to frame main, cc 2.1.289. only the pr lanes (feature, app/redesign) get a worktree; with `"none"` main has no protection, so two coders on main still need disjoint files (wayfinder FRM-312). `bgIsolation` has no per-path exemption; a main-lane bg session that started without the flag edits through `scratch-edit pull <paths>` → Edit/Write the printed copies → `scratch-edit push` (plugin-x bin; push refuses a file the repo changed since the pull).
- Worktrees at ~5+ agents or genuine concurrent edits, not before. a worktree brief's step 0 is
  `CI=1 pnpm install` (inline, that command only) — kills the shared-hooks rewrite
  (`rules/fleet-hazards.md`, git hooks).
- ⚠️ a frame worktree pushes only through `x lane push` (a plain `git push` dies on the mirror gate) and runs `pnpm` only as `CI=1 pnpm install` (`rules/fleet-hazards.md`, git hooks); dima or cclio merges. 📌 before a frame pr-lane spawn, push main first — a coder's `x lane merge-main` merges origin, and a local main ahead of origin stalled the v1.1 coder 17 min (retro run 1, 2026-10-06).
