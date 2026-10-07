# fleet-hazards — well-known pitfalls, fleet-wide

common traps any surface can hit. one section per subject; add a section only for a hazard
that bites 2+ repos or every session — a hazard that bites one repo goes to that repo's `AGENTS.md`.
every hazard names its guard — `guard: <hook | x verb>` or `guard: none`; a line whose guard
exists dies, so the file shrinks as the `x` cli grows. this file is the source of truth; the vault section is copied by hand
into the cw leaf `/topics/obsidian.md` — the rest is cc-only, deliberately not mirrored.
📌 **a Bash-shaped hazard becomes an `x-mod-guard` rule first** (the cc mod, `plugin-x/mods/x-mod-guard`; a ticket under FRM-304); a line lands here only for what a Bash check cannot see — a judgment call, a non-Bash tool, a browser-only look (dima, 2026-10-05).

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
  fallback rescues it) but dirty. on pnpm 12 `CI=1 pnpm install` no longer stops it: it still prints
  «sync hooks» and points the shims at the worktree (two sessions on #53, 2026-10-01; the FRM-278
  coder, 2026-10-02). after a worktree is removed, `pnpm exec lefthook install` in the main checkout
  points them home (a plain `pnpm install` answers «already up to date» and leaves them). guard: none · FRM-342
- `rebase.updateRefs` is on since the git overhaul (2026-09-03): a safety BRANCH made before a
  rebase is dragged forward with the rewrite and stops being a recovery point — a tag or the
  reflog is the net (a coder lost its net on a reword, 2026-09-05)

## the shared working tree

- **a parallel agent in a repo with a repo-wide commit gate writes to scratch until it compiles, then moves in** — per-path ownership does not hold against a per-repo typecheck hook: a coder's own subagent dropped a half-compiled `.ts` into the tree and blocked the coder's commits for two rounds (2026-09-22)

## the bash sandbox

- **the cause (read in a coder transcript, 2026-09-28): claude code's worktree isolation.** a
  `--bg` session in a worktree may run git only in a form cc can prove targets its own tree —
  literal arguments, run from the tree. `eval`, a variable, `cd x && git`, a pipe, or any command
  whose text names git is refused: «a worktree-isolated session's git operations must target its
  own worktree»
- ✅ **commit, push, pr-open, merge-main and unlock run through `x lane <verb>`** (frame `x/`, on PATH;
  bare `x` prints the verbs; the old plugin-x `lane` is a shim) — the git runs inside the script, so
  the command text passes (4 coders lost ~1 h before it existed, 2026-09-28); a frame worktree's
  `x lane push` pushes through the main checkout
- anything else whose text names git or `eval` (a jq path like `.git.x`, `gh --jq`, an
  agent-browser `eval`) goes into a scratch script and runs by path

## node

- `.node-version` holds the MAJOR (`24`) in frame and bytes; fnm resolves the installed one. a `Can't find an installed Node version` prompt means a pin drifted back to a patch — repin to the major, never install the patch (2026-09-17)

## the bash tool

- **the `x-mod-guard` cc mod refuses the Bash shapes that used to be listed here** — `sd` with a `$`, a dash-led `sd` find, an unbraced `$var` before `:` or non-ascii, a trailing `&`, a gate piped to `head`/`grep`, a grepped push, `sd`/`sed` on a workflow, a `HOME=` override, plus the floor commands; its refusal names the fix, `plugin-x/mods/x-mod-guard/FTR.md` lists them. guard: `x-mod-guard` itself
- **a cli new to you is probed with a bare `<cli> --help`, never `<cli> <verb> --help`** — some clis run the verb and ignore the flag: `obsidian delete --help` deleted the active note (2026-10-07, restored). guard: `x-mod-guard` for obsidian; any other unknown cli, none
- **a hand edit goes through `Edit`/`Write`; a bulk transform may script** — the tools fire the hooks (biome format, the stash holds lock, read-before-write) and fail loud; a script sees no hook and fails silent. a change across many files (a rename, a date shift, 40 files) stays one script call, never 40 Edits (dima, 2026-10-05) — 37 % of a week's fleet writes went through Bash and took no hold (`docs/test-drive/mods.md`). guard: the stash cc mod's holds veto refuses a Bash write to a held file; a Bash write still takes no hold and fires no format hook
- **biome's format-on-save deletes an import that is not used yet** — two Edits that add an import, then its use, ship a runtime ReferenceError; add the use first, then the import (2026-09-28)
- renaming a `.gitignore` path un-ignores whatever the OLD path still holds — `git add -A`
  staged a compiled binary right after a rename (2026-09-14); read the staged list before the
  commit
- **`CI=1 pnpm install` is frozen-lockfile** (pnpm's own CI detection) — a dep add or removal takes `--no-frozen-lockfile` beside it, or the lockfile never moves and the commit ships half; and pnpm 12 reads `overrides` from `pnpm-workspace.yaml` only, the `package.json#pnpm` field is ignored with a warning (2026-09-21)
- **a delete names the file the grep proved, never its dir** — «TriangleSvg has no users» was true, `trash src/elements/icons` took the live `ExternalLinkSvg.tsx` with it (2026-09-21); the unit of a delete is the path the evidence named
- **a hand-kept plist or json changed for one value gets a one-line edit, never a re-serialize** —
  `plistlib.dumps` rewrote all 984 lines of the iterm prefs for one spacing value (2026-10-01)
- **vendored code gets its biome exclusion in the same commit that adds it** — the commit hook formats staged files only, ci runs `biome ci` over the repo, so a vendored skill turned main red after a green commit (2026-09-28)
- **`op run` masks secrets in its child's stdout** — a script that reads a key back from an `op-run` child gets `<concealed by 1Password>`; the child sets `OP_RUN_NO_MASKING=true` and keeps the key in memory only (speak's daemon, 15 min, 2026-09-29)

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
- **a green typecheck answers «did the configured files pass», never «are my files configured»** — `hotkeys/*.ts` sat in no tsconfig for a week and a reverted interface field left the gate green (2026-09-20). a new dir of `.ts` is proven by planting a type error and watching `pnpm typecheck` go red
- **github's `Deploy · success` is the hook trigger, never the build** — three production builds were red for 20 minutes behind a green Actions page (2026-09-21); the build state lives only in `vercel inspect <deploy url>` (`status ● Error`), and `vercel ls <project> --prod` names the newest one

## app exports

- **an app export is a secrets container until decrypted or inspected** — a raycast `.rayconfig` held the whole clipboard history and every extension's stored keys behind the passphrase typed in the export dialog; a weak passphrase is plaintext. an export never enters a repo; it lives outside git and is read by a tool (2026-09-22: two exports sat in the public dotfiles repo for a week)

## declarative tools

- **a tool that treats its config as the whole truth imports the live state before its first apply** — `gmailctl apply` deleted dima's two hand-made filters because `download` never ran first (2026-09-20). same shape: renovate's first run, `frame:link apply`, a launchd bootstrap. the first apply on a live account is preceded by the tool's own import verb.

## ci runners

- a jq program is proven when ci compiles it — ubuntu runners ship jq 1.7, the mac 1.8; `a + b`
  as a bare object value parses locally and fails on the runner (bytes #79, 2026-09-12). a job
  that runs jq prints `jq --version` first
