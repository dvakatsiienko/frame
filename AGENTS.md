# AGENTS.md: frame

Hey.
Welcome to my repo with dotfiles. Here we improve the dotfiles by themselves, build other
interesting tools like `sline`, tweak configs, and — not least — tune and improve your own memory
and infra. Most of the internal tooling and the system overhaul (zsh, git, brew, and the rest)
cook here too. A mix.
Main environment is macOS, managed by symlinks.
This is where the agent system itself (currently Claude Code CLI) is developed (`home/.claude/`).

🚫 **`_clio/` is the coordinator's home.** A session not booted as the coordinator never cds into
or reads under `_clio/` — its memory autoloads and quietly rebrands whoever enters. Asked to boot as
cclio from here: load `x:cclio-mode`.

## the dotfiles

### the mirror rule

**A path under `home/` IS the path under `~`.** Everything symlinked into the home directory lives
at its literal relative path, so the link map is _derived by walking the tree_ rather than
hand-maintained. Anything imported by hand into an app instead of symlinked lives in `import/`.

A directory is linked wholesale **unless** the matching path in `~` is already a real directory
holding content this repo does not own (`~/.config`, `~/.claude`) — then it descends and links the
leaves. `noLink` in `script/lib/manifest.ts` names the few dirs stored here but referenced by absolute path.

📌 Two different `.claude` dirs exist here, and they are not the same thing: `home/.claude/` is the
global `~/.claude` config (the agent system, every session reads it); `.claude/` at repo root is
this project's own config. The global one nests under `home/` precisely so the two never collide.

### the link commands

```bash
pnpm frame:link apply                  # link everything not linked yet
pnpm frame:link register ~/.foo        # move a file into the mirror and link it back
pnpm frame:link untrack ~/.gitconfig   # hand a file back to ~, drop it from the repo
```

`package.json` `scripts` is the full list — read it rather than a copy here.

## one home per feature

**a feature lives in ONE directory named after it** — `schedule/` owns every scheduled job,
`hotkeys/` owns every hotkey tool; its served app is `hotkeys/chords/` — read
`hotkeys/AGENTS.md` before touching either; a new feature or mini-app gets its own root directory the day it is born. before adding a file, ask which feature it belongs to and put
it in that home; `script/`, `docs/` and `lib/` are not homes, they are where scatter starts. the one crossing: a feature's scheduled **daemon** lives under
`schedule/jobs/<name>/` (plist, source, `bin/`), its readers and tools stay in the feature's home.

<!-- failure: hotkeys sat in four places on 2026-09-19 -->

## scripts

<!-- the notes on scripts, the toolchain and the hooks moved to .claude/rules/scripts.md (2026-10-11 sweep), a paths: rule that loads with those files; this one line stays, because running a command touches no file -->

- 📌 `pnpm check` itself WRITES repo-wide — run biome on your own paths only; `x lane commit` formats the paths it commits.

## what lives in `home/.claude/` that `ls` does not explain

- **`plugin-x/`** — the personal plugin, registered as marketplace "x". `CST-SPEC.md` there is the
  single definition of the handoff format.
- **`mcp-x-cw/`** — local stdio MCP server giving `cw` handoff and transcript tools against the
  shared shelf. Build: `pnpm mcp:build`.
- **`shelf/`** — everything we bake, symlinked wholesale into `~/.claude/`: handoffs,
  transcripts, flawlog, plus the `hooks/` settings.json points at and the `sounds/` they
  play. Colocate our produce here rather than scattering it across `~/.claude`.
- **`sline/`** — this repo's statusline. Its own `AGENTS.md` loads when working under it.

## the readme stays true

`README.md` shows live facts: the badge row, the sections, the clips. **A change to what it shows
lands with its README update in the same commit** — a toolchain move (pnpm → bun), a renamed
command, a new top-level feature. `pnpm badges:sync` redraws `assets/badges/` from the repo; the
sline clip re-renders via `home/.claude/sline/showcase/` (`show.sh`, then `render-svg.ts`); the
chords shot is `hotkeys/chords/showcase.png`, retaken with agent-browser on `localhost:7373`.

## docs and tracker

- GitHub issues are retired; everything tracker-shaped lives in Linear per `rules-lazy/linear-flow.md`.
- **Multi-context layout** — `GLOSSARY-MAP.md` at root. Repo context: `GLOSSARY.md` + `docs/adr/`
  (ADR-nnnn). Tracker context: `docs/tracker/GLOSSARY.md` + `docs/tracker/adr/` (TRK-nnnn).
  Glossary vocabulary is binding in outputs (titles, proposals, test names); an output
  contradicting an ADR surfaces the conflict, never silently overrides.
- **`x lane gate` holds the ftr line and the glossary entry at commit-msg** for an app with `FTR.md` (`x:app-author-ftr`): the ftr line always, the glossary for the files a context lists as its `contract:` in `GLOSSARY-MAP.md`; both land in the same commit as the code
- **Research** — `docs/research/<subject>.md`, subject-first filename, never a ticket-id prefix, so
  a doc survives the ticket that prompted it. `Ticket: FRM-N` on its own line at the top, mandatory — a doc no ticket owns writes `Ticket: none`. **Every research doc carries `dies-when:` frontmatter at creation** — the condition that
  retires it (distilled into an artifact, hatched into a skill/rule, or acted on). Reading a doc
  past its `dies-when` means deleting or flagging it.
- **Test drives** — `docs/test-drive/<subject>.md`, one file per tool or lane on trial (`parallel`, `review-stack`,
  `ctx-burn`, `notes-stack/` with its bench scripts). A test drive is a running measurement any session
  may append a round to, so it lives here and never under `_clio/`; it closes with a verdict line
  (adopted / dropped) and stays as the record. A research doc answers once; a test drive accumulates.
  Its flow is cclio's `cclio:shape-test-drive`; `pnpm test-drive:check` reds an overdue, undated or copied date.

## Agent skills

### Issue tracker

matt's skills (to-spec, to-tickets, implement-spec, triage) use local markdown in `.scratch/<feature>/`, gitignored — a lane's plan; linear stays the record. See `docs/agents/issue-tracker.md`.

### Triage labels

the five default roles as `Status:` strings, mapped to our linear labels. See `docs/agents/triage-labels.md`.

### Domain docs

multi-context: `GLOSSARY-MAP.md` lists every `GLOSSARY.md`. See `docs/agents/domain.md`.

## the other homes at root

- `gifs/` — dima's gif storage, one dir per gif, `gifs/AGENTS.md` is the contract.
- `brand/` — avatars and marks (`brand/avatars/fleet/` is the crew); `assets/` — the readme's own
  art, badges and clips, drawn by scripts.
- `design/` — the designer's instruments (`pnpm design:*`: contrast, palette, cvd, scale, tokens,
  diff); the designer itself lives in `~/projects/studio`.
- `gmail/` — the `gmailctl` filter set and the block list; `schedule/` — every launchd job.
- `logos/` — `@frame/logos`, the one logo store every app imports (`workspace:*`); marks enter only
  through art-kit's `logo.ts`, never into an app's own tree.
- `x/` — `x`, the personal cli (go + charm, rebuilt from source by its shim, `x/AGENTS.md` is the verb contract); on PATH
  through `home/.local/bin/x`.
- `cc` is a symlink to `home/.claude/`, a short path for the agent system.

📌 **1Password is required** for SSH signing. Vim plugins need a manual `:PlugInstall` after setup.

## hazards that bite this repo

- **a pre-commit `test` red in under 1 s on the first commit after staging is the known flake** — vitest needs ~2.5 s, and the identical retry went green both times (2026-10-04); retry once, a second red is real. guard: none, cause unknown
- a frame worktree pushes only through `x lane push` (it pushes from the main checkout; a plain `git push` there dies on the `mirror` gate, which reads `~` symlinks that point at the main checkout), and runs `pnpm` only as `CI=1 pnpm install`: a plain install moves the shared hook shims into the worktree, and only `x lane seed` puts them back
- **the encrypted set is `.gitattributes`** (the `filter=git-crypt` lines) — read it before calling a task git-crypt-blocked; every other file works in a fresh clone or a cloud session with no key. a commit that moves a file out of the set is refused by the `git-crypt-rename` pre-commit check — the new path needs its own filter line
- a git-crypt repo keeps its key in the main `.git`, so a fresh worktree holds ciphertext and even a pathspec `git add` dies on the clean filter: `x lane seed <path>` unlocks a hand-made tree (`EnterWorktree` trees unlock through `shelf/hooks/worktree-seed.sh`); the by-hand recipe lives in `x/AGENTS.md` § lane
- **biome lints `.svg` in frame** (`useSortedAttributes`) — art shipped outside `assets/` and `brand/` gets its `!path` exclusion in `biome.jsonc` in the same commit, or the commit is refused
- **launchd + tcc hazards live in `schedule/AGENTS.md`** (signing, tcc grants, plist edits) — read it before touching `schedule/` or a daemon under `hotkeys/`

<!-- failure: pnpm check reformatted hotkeys/map.html under a coder (2026-09-15) · a «frame is git-crypt, so no cloud» call was wrong, the set was one file (2026-09-28) · speak's favicon refused at commit by the svg lint (2026-09-29) -->
