# fleet-hazards — well-known pitfalls, fleet-wide

common traps any surface can hit. one section per subject; add a section only for a hazard
that bites 2+ repos or every session — a hazard that bites one repo goes to that repo's
`AGENTS.md`. this file is the source of truth; the vault section is copied by hand
into the cw leaf `/topics/obsidian.md` — the rest is cc-only, deliberately not mirrored.

📌 hazards that bite one subject live beside it: frame `AGENTS.md` (launchd + tcc, git-crypt,
lefthook), bytes `AGENTS.md` (vercel), `import/raycast/extensions/AGENTS.md`, `x:github-contrib`
(github api reads), `docs/knowledge/macos-admin.md` (brew casks, desktop apps).

## the obsidian vault

- the vault is **not under git** — no undo, no history, a bad overwrite is gone
- icloud sync lags: changes land a few minutes after obsidian opens, and relaunching often
  forces the pull
- **never edit before the synced version has arrived** — editing a stale copy silently drops
  whatever the other device wrote (most likely when dima just printed from a mobile device)
- reads are fine anytime; writes only when he asks — never change the vault on his behalf
  unprompted
- never move or rename a vault file by plain `mv` — 231/231 wikilinks broke on the bench; the
  `obsidian` cli (`rename` / `move`) rewrites them through the running app, and it is judged by
  the file landing with a timeout, never by the process returning (it hung twice, 2026-09-10)
- icloud sync is whole-file, last-writer-wins, no conflict copy (measured 2026-09-10): a write on
  the mac while a mobile device holds a stale copy is lost on that device's next reconnect — keep
  obsidian closed on the ipad during a session, re-read before every write
- the channel recipe for every surface: raw files for read / append / property edits, the cli
  for rename / move / backlinks / search, never the rest-api plugin or an mcp; notion through
  `ntn`, never the connector for edits. on cw both doors cost ~1 % of a 5-hour window per
  paragraph (measured 2026-09-10) — cw reads, cc edits; a batch is handed to the mac

## git hooks

- a gitignore pattern with a `/` in the middle is anchored to the ignore file's directory — `.impeccable/x.json` at a repo root never matches `apps/web/.impeccable/x.json`; `**/` in front makes it match at any depth (measured with `git check-ignore -v`, 2026-09-19)
- worktrees share `.git/hooks`, and any pnpm run in one rewrites the shared lefthook shims to
  the worktree's path — including pnpm's own auto-install before ANY script, so the first gated
  commit in a fresh worktree does it by itself. harmless to gating (the shim's repo-root
  fallback rescues it) but dirty. **the guard: `CI=1 pnpm install`** — lefthook's postinstall exits early on `CI` (measured
  2026-08-30). in frame it is AUTOMATED: the `EnterWorktree` hook
  (`shelf/hooks/worktree-seed.sh`, user scope) runs it in every bg coder's fresh worktree; manual
  `CI=1 pnpm install` is needed only for a hand-made `git worktree add`. inline env for that
  one command only, never global
- `rebase.updateRefs` is on since the git overhaul (2026-09-03): a safety BRANCH made before a
  rebase is dragged forward with the rewrite and stops being a recovery point — a tag or the
  reflog is the net (a coder lost its net on a reword, 2026-09-05)

## the shared working tree

- **a parallel agent in a repo with a repo-wide commit gate writes to scratch until it compiles, then moves in** — per-path ownership does not hold against a per-repo typecheck hook: a coder's own subagent dropped a half-compiled `.ts` into the tree and blocked the coder's commits for two rounds (2026-09-22)

## the bash sandbox

- 🎯 **in a worktree session, any command that mentions `gh`, `git`, a token script or `eval`
  goes into a scratch script first, then runs by path** — the shapes below are the reason, and
  they are unfollowable while typing (a coder hit four of them with this file in context,
  2026-09-11)
- three shapes get rewritten or refused by the sandbox guard and cost a coder ~15 min of retries
  on 2026-09-08: a `jq` filter whose text contains `git`, a heredoc piped into `gh`, and a
  `HOME=` override in front of a command. write the filter or body to a scratch file first and
  pass the path (`jq -f`, `gh --body-file`); never override `HOME`
- two more shapes (2026-09-10, ~10 min each): **any command or heredoc whose TEXT contains the
  substring `git`** — `github.repository` inside a yaml body, a jq path `.git.deploymentEnabled`
  (8 refusals across two jobs, 2026-09-11) —
  — `pnpm github:agent-token` included — and `eval` outright (an agent-browser verb). both go
  into a scratch script and run from there

## node

- `.node-version` holds the MAJOR (`24`) in frame and bytes; fnm resolves the installed one. a `Can't find an installed Node version` prompt means a pin drifted back to a patch — repin to the major, never install the patch (2026-09-17)

## the bash tool

- a trailing `&` inside a Bash tool call is safe only when something after it keeps the shell
  alive (`wait`, a `sleep`) — the wrapper exits and kills the child, exit 0, empty log, and it
  reads as «feature broken» (twice in one day, 2026-09-14). in a `run_in_background` call the
  wrapper IS the backgrounding
- renaming a `.gitignore` path un-ignores whatever the OLD path still holds — `git add -A`
  staged a compiled binary right after a rename (2026-09-14); read the staged list before the
  commit
- **`CI=1 pnpm install` is frozen-lockfile** (pnpm's own CI detection) — a dep add or removal takes `--no-frozen-lockfile` beside it, or the lockfile never moves and the commit ships half; and pnpm 12 reads `overrides` from `pnpm-workspace.yaml` only, the `package.json#pnpm` field is ignored with a warning (2026-09-21)
- **a delete names the file the grep proved, never its dir** — «TriangleSvg has no users» was true, `trash src/elements/icons` took the live `ExternalLinkSvg.tsx` with it (2026-09-21); the unit of a delete is the path the evidence named
- **`${var}` before any non-ascii character** — bash reads `«$var»` as a variable named `var»` and dies
  on «unbound variable» under `set -u` (twice in one session, 2026-09-26); brace every variable that
  touches a guillemet, an emoji or a dash glyph
- an `sd` replacement never carries a `$` — inside a double-quoted argument the shell expands
  `$dir` / `$line` to nothing and the line ships hollow (three sightings, 2026-09-17/18). that
  edit goes through the Edit tool or a python literal

## green statuses

- **a green status answers «did this fail», never «did this run»** — three systems in one day
  (2026-09-11): github counts a skipped job as satisfying a required check, vercel reports a
  skipped deploy as `success`, our own `review:clean` went green when the reviewer filed its
  findings in one comment and no inline thread. before trusting a green, ask what would have
  been red if the thing had not run at all
- **no run at all reads exactly like checks still pending** — the inverse case: `gh pr checks`
  prints a short calm list and nothing is red. before trusting a quiet pr, ask «was a RUN
  created for this head», never «is a check green» (bytes #84, 2026-09-12: a commit body that
  quoted the skip marker; the guard is a `commit-msg` hook in both repos)
- **a gate is read by its exit code, never by grepping its output** — `pnpm --silent --filter chords typecheck | head` printed nothing on 4 type errors and the commit hook caught them a minute later (2026-09-22); `--silent`, a pipe, or a `grep` for «error» all turn red into quiet
- **a green typecheck answers «did the configured files pass», never «are my files configured»** — `hotkeys/*.ts` sat in no tsconfig for a week and a reverted interface field left the gate green (2026-09-20). a new dir of `.ts` is proven by planting a type error and watching `pnpm typecheck` go red
- **github's `Deploy · success` is the hook trigger, never the build** — three production builds were red for 20 minutes behind a green Actions page (2026-09-21); the build state lives only in `vercel inspect <deploy url>` (`status ● Error`), and `vercel ls <project> --prod` names the newest one

## app exports

- **an app export is a secrets container until decrypted or inspected** — a raycast `.rayconfig` held the whole clipboard history and every extension's stored keys behind the passphrase typed in the export dialog; a weak passphrase is plaintext. an export never enters a repo; it lives outside git and is read by a tool (2026-09-22: two exports sat in the public dotfiles repo for a week)

## declarative tools

- **a tool that treats its config as the whole truth imports the live state before its first apply** — `gmailctl apply` deleted dima's two hand-made filters because `download` never ran first (2026-09-20). same shape: renovate's first run, `frame:link apply`, a launchd bootstrap. the first apply on a live account is preceded by the tool's own import verb

## ci runners

- a jq program is proven when ci compiles it — ubuntu runners ship jq 1.7, the mac 1.8; `a + b`
  as a bare object value parses locally and fails on the runner (bytes #79, 2026-09-12). a job
  that runs jq prints `jq --version` first
- `sd` / `sed` silently drop `${{ … }}` from a workflow line — a workflow file is edited with the
  Edit tool only (two expressions eaten on #79, caught only by printing the result)

