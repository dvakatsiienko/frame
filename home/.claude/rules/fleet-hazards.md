# fleet-hazards — well-known pitfalls, fleet-wide

common traps any surface can hit. one section per subject; add a section only for a hazard
that bites 2+ repos or every session — a hazard that bites one repo goes to that repo's `AGENTS.md`.
every hazard names its guard — `guard: <hook | x verb>` or `guard: none`; a line dies when its guard
makes the failure impossible, a partial guard is named beside the line, so the file shrinks as the `x` cli grows. cc-only, deliberately not mirrored; the vault hazards
live in `x:notes`, copied by hand into the cloud chat leaf `/topics/obsidian.md`.
📌 **a Bash-shaped hazard becomes an `x-mod-guard` rule first** (the cc mod, `plugin-x/mods/x-mod-guard`; a ticket under FRM-304); a line lands here only for what a Bash check cannot see — a judgment call, a non-Bash tool, a browser-only look (dima, 2026-10-05).

📌 hazards that bite one subject live beside it: frame `AGENTS.md` (git-crypt), `schedule/AGENTS.md` (launchd + tcc), frame
`.claude/rules/scripts.md` (lefthook, the toolchain), bytes `AGENTS.md` (vercel), `import/raycast/extensions/AGENTS.md`, `x:github-contrib`
(github api reads), `x:notes` (the obsidian vault), `docs/knowledge/macos-apps.md` (brew casks, desktop apps).

<!-- the file-touch hazards (.gitignore, ci workflows, pnpm manifests) live in fleet-hazards-files.md, a paths: rule that loads with its file (2026-10-11 sweep) -->

## git hooks

- `rebase.updateRefs` is on since the git overhaul (2026-09-03): a safety BRANCH made before a
  rebase is dragged forward with the rewrite and stops being a recovery point — a tag or the
  reflog is the net (a coder lost its net on a reword, 2026-09-05)

## the shared working tree

- **a parallel agent in a repo with a repo-wide commit gate writes to scratch until it compiles, then moves in** — per-path ownership does not hold against a per-repo typecheck hook: a coder's own subagent dropped a half-compiled `.ts` into the tree and blocked the coder's commits for two rounds (2026-09-22). guard: `script/index-run.sh` in frame (the gates run on a private copy that sees only the commit, so a peer's staged file never reds yours — FRM-367, PK-97) and `x lane commit` waits out a peer's index lock; none in bytes until its index copy lands

## the bash sandbox

- **a worktree-isolated session runs git only through `x lane <verb>`** (commit, push, pr-open, merge-main, unlock): cc's own isolation check refuses git it cannot prove targets the tree, and no mod can lift it (FRM-356). any other text naming git or `eval` (`.git.x` in jq, `gh --jq`, an agent-browser `eval`) goes into a scratch script, run by path. guard: `x lane <verb>`

## node

- `.node-version` holds the MAJOR (`24`) in frame and bytes; fnm resolves the installed one. a `Can't find an installed Node version` prompt means a pin drifted back to a patch — repin to the major, never install the patch (2026-09-17)

## the bash tool

- **a cli new to you is probed with a bare `<cli> --help`, never `<cli> <verb> --help`** — some clis run the verb and ignore the flag. guard: `x-mod-guard` refuses it for obsidian and hints it, with the first run, for every other cli new to the session (FRM-428); partial, a hint never stops the run
- **a hand edit goes through `Edit`/`Write`; a bulk transform may script** — the tools fire the hooks (biome format, the `x-mod-holds` lock, read-before-write) and fail loud; a script sees no hook and fails silent. a change across many files (a rename, a date shift, 40 files) stays one script call, never 40 Edits. guard: `x-mod-guard` refuses a Bash write to a file `x-mod-holds` holds; a Bash write still takes no hold and fires no format hook
- **a delete names the file the grep proved, never its dir** — «TriangleSvg has no users» was true, `trash src/elements/icons` took the live `ExternalLinkSvg.tsx` with it (2026-09-21); the unit of a delete is the path the evidence named
- **a hand-kept plist or json changed for one value gets a one-line edit, never a re-serialize** —
  `plistlib.dumps` rewrote all 984 lines of the iterm prefs for one spacing value (2026-10-01)
- **vendored code gets its biome exclusion in the same commit that adds it** — the commit hook formats staged files only, ci runs `biome ci` over the repo, so a vendored skill turned main red after a green commit (2026-09-28)
- **`op run` masks secrets in its child's stdout** — a script that reads a key back from an `op-run` child gets `<concealed by 1Password>`; the child sets `OP_RUN_NO_MASKING=true` and keeps the key in memory only (speak's daemon, 15 min, 2026-09-29)

<!-- failure: obsidian delete --help deleted the active note (2026-10-07, restored) · 37 % of a week's fleet writes went through Bash and took no hold (dima, 2026-10-05, docs/test-drive/mods.md) -->

## green statuses

- **a green status answers «did this fail», never «did this run»** — three systems in one day
  (2026-09-11): github counts a skipped job as satisfying a required check, vercel reports a
  skipped deploy as `success`, our own `review:clean` went green when the reviewer filed its
  findings in one comment and no inline thread. before trusting a green, ask what would have
  been red if the thing had not run at all
- **no run at all reads exactly like checks still pending** — the inverse case: `gh pr checks`
  prints a short calm list and nothing is red. before trusting a quiet pr, ask «was a RUN
  created for this head», never «is a check green». guard: a `commit-msg` hook in frame and bytes
- **a green typecheck answers «did the configured files pass», never «are my files configured»** — `hotkeys/*.ts` sat in no tsconfig for a week and a reverted interface field left the gate green (2026-09-20). a new dir of `.ts` is proven by planting a type error and watching `pnpm typecheck` go red

<!-- failure: bytes #84 (2026-09-12), a commit body quoted the skip marker and no run was created for its head -->

## app exports

- **an app export is a secrets container until decrypted or inspected** — a raycast `.rayconfig` held the whole clipboard history and every extension's stored keys behind the passphrase typed in the export dialog; a weak passphrase is plaintext. an export never enters a repo; it lives outside git and is read by a tool (2026-09-22: two exports sat in the public dotfiles repo for a week)

## declarative tools

- **a tool that treats its config as the whole truth imports the live state before its first apply** — `gmailctl apply` deleted dima's two hand-made filters because `download` never ran first (2026-09-20). same shape: renovate's first run, `frame:link apply`, a launchd bootstrap. the first apply on a live account is preceded by the tool's own import verb.
