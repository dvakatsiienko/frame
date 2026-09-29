# AGENTS.md: frame

Hey.
Welcome to my repo with dotfiles. Here we improve the dotfiles by themselves, build other
interesting tools like `sline`, tweak configs, and — not least — tune and improve your own memory
and infra. Most of the internal tooling and the system overhaul (zsh, git, brew, and the rest)
cook here too. A mix.
Main environment is macOS, managed by symlinks.
This is where the agent system itself (currently Claude Code CLI) is developed (`home/.claude/`).

🚫 **`cclio/` is the coordinator's home.** A session not booted as the coordinator never cds into
or reads under `cclio/` — its memory autoloads and quietly rebrands whoever enters.

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
it in that home; `script/`, `docs/` and `lib/` are not homes, they are where scatter starts (hotkeys
sat in four places on 2026-09-19). the one crossing: a feature's scheduled **daemon** lives under
`schedule/jobs/<name>/` (plist, source, `bin/`), its readers and tools stay in the feature's home.

## scripts

- **`script/lib/manifest.ts`** decides (walks `home/`, derives the expected link set), `frame-link.ts`
  acts — status / apply / untrack, idempotent, refuses to clobber a real file. Never run the
  manifest directly.
- **`macos-setup.ts`** — `brew bundle` against the root `Brewfile`, the macOS defaults this repo
  owns, `duti` bindings, vim-plug. Packages live in the `Brewfile`, never in the script.
- **Scripts are `.ts`, run by node 24 directly** — no `tsx`, no build. `tsconfig.json` sets
  `erasableSyntaxOnly`, which bans any syntax needing real compilation. `pnpm typecheck` checks.
- **`pnpm typecheck` is the type gate, never a build** — `ray build` bundles with esbuild and reports success over type errors (typescript 7 is the native port, ray finds no compiler api to call); root typecheck recurses into every workspace member.
- **`biome.jsonc` stops descending at an excluded directory** — re-including anything under `!**/import` names every ancestor; and probe the real config, never a minimal repro, because `extends` supplies patterns a repro lacks.
- **`pnpm toolchain:sync`** writes `.node-version` (major), `packageManager` and `engines` in frame + bytes from the installed node and pnpm; renovate is told off those pins. run it after any `fnm install` or pnpm bump.
- Anything directly under `script/` is a runnable entrypoint with a matching `pnpm` script;
  `script/lib/` is library code, never invoked directly.
- Formatter and linter is **biome** (`pnpm check`). Git hooks run through **lefthook** — biome on
  staged files plus `pnpm typecheck` and `pnpm test` at commit, `frame-link` at push. Nothing in
  a hook writes to your files. 📌 `pnpm check` itself WRITES repo-wide — run biome on your own
  paths only; lefthook already formats what you stage (it reformatted `hotkeys/map.html`
  under a coder, 2026-09-15).

## what lives in `home/.claude/` that `ls` does not explain

- **`plugin-x/`** — the personal plugin, registered as marketplace "x". `CST-SPEC.md` there is the
  single definition of the handoff format.
- **`mcp-x-cw/`** — local stdio MCP server giving `cw` handoff, transcript and pm tools against the
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

- GitHub issues are retired; everything tracker-shaped lives in Linear per `rules/linear-flow.md`.
- **Multi-context layout** — `CONTEXT-FTR.md` at root. Repo context: `CONTEXT.md` + `docs/adr/`
  (ADR-nnnn). Tracker context: `docs/tracker/CONTEXT.md` + `docs/tracker/adr/` (TRK-nnnn).
  Glossary vocabulary is binding in outputs (titles, proposals, test names); an output
  contradicting an ADR surfaces the conflict, never silently overrides.
- **an app with `FTR.md` updates its ftr line, and any new domain word its `CONTEXT.md`
  entry, in the same commit as the code** (`x:ftr`).
- **Research** — `docs/research/<subject>.md`, subject-first filename, never a ticket-id prefix, so
  a doc survives the ticket that prompted it. `Ticket: FRM-N` on its own line at the top, mandatory — a doc no ticket owns writes `Ticket: none`. **Every research doc carries `dies-when:` frontmatter at creation** — the condition that
  retires it (distilled into an artifact, hatched into a skill/rule, or acted on). Reading a doc
  past its `dies-when` means deleting or flagging it.
- **Vets** — `docs/vet/<subject>.md`, one file per tool or lane on trial (`parallel`, `review-stack`,
  `ctx-burn`, `notes-stack/` with its bench scripts). A vet is a running measurement any session
  may append a round to, so it lives here and never under `cclio/`; it closes with a verdict line
  (adopted / dropped) and stays as the record. A research doc answers once; a vet accumulates.

## the other homes at root

- `gifs/` — dima's gif storage, one dir per gif, `gifs/AGENTS.md` is the contract.
- `brand/` — avatars and marks (`brand/avatars/fleet/` is the crew); `assets/` — the readme's own
  art, badges and clips, drawn by scripts.
- `gmail/` — the `gmailctl` filter set and the block list; `schedule/` — every launchd job.
- `cc` is a symlink to `home/.claude/`, a short path for the agent system.

📌 **1Password is required** for SSH signing. Vim plugins need a manual `:PlugInstall` after setup.

## hazards that bite this repo

- **frame's lefthook stashes unstaged changes only for PARTIALLY staged files** — a fully-unstaged wip file stays live during `pnpm test` and can fail the gate (the cw `/profile.md#fleet` size check, 2026-09-23); wrap the commit in a path-limited `git stash push -- <files>`
- a git worktree of `frame` cannot push (the `mirror` gate reads `~` symlinks that point at
  the main checkout)
- **the encrypted set is `.gitattributes`** (the `filter=git-crypt` lines) — read it before calling a task git-crypt-blocked; every other file works in a fresh clone or a cloud session with no key (a «frame is git-crypt, so no cloud» call was wrong on 2026-09-28: the set was one file)
- a git-crypt repo keeps its key in the main `.git`, never under `.git/worktrees/<n>/`, so a fresh worktree holds ciphertext and **even a pathspec `git add` dies on the clean filter** (the index refresh runs it over every locked file). `EnterWorktree` trees are unlocked by `shelf/hooks/worktree-seed.sh`; a hand-made `git worktree add` takes `-c filter.git-crypt.smudge=cat -c filter.git-crypt.required=false`, then, inside the tree, the unlock with the same two filters off — `GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=filter.git-crypt.clean GIT_CONFIG_VALUE_0=cat GIT_CONFIG_KEY_1=filter.git-crypt.required GIT_CONFIG_VALUE_1=false git-crypt unlock "$(git rev-parse --git-common-dir)/git-crypt/keys/default"` — because the unlock runs `git status`, which dies on the clean filter (the bare unlock failed on the chords-run probe, 2026-09-27); the main key file unlocks in one step, no copy. a tree still locked: `git -c filter.git-crypt.clean=cat -c filter.git-crypt.required=false add|commit` is safe ONLY after `git hash-object --no-filters <locked file>` equals its `git ls-files -s` blob — same ciphertext, nothing plaintext can be staged
- **biome lints `.svg` in frame** (`useSortedAttributes`) — art shipped outside `assets/` and `brand/` gets its `!path` exclusion in `biome.jsonc` in the same commit, or the commit is refused (speak's favicon, 2026-09-29)

### launchd + tcc (`schedule/`, `hotkeys/`)

- **every daemon build signs through `script/lib/sign.sh`** — the one self-signed identity «x-speak local signing» (to 2036), so a tcc grant pins to the certificate leaf and survives rebuilds, source changes included (x-speak, 2026-09-29). **ad-hoc is the failure case**: its grant pins to the cdhash, the next source change silently drops Input Monitoring, and a listen-only tap still «succeeds» and hears nothing (chord lines stop, app-switch lines continue — the tell). a re-grant still runs edit → build → **re-grant** → restart; a tap created before the grant stays deaf. a plain off/on of the row can re-authorise an old hash — remove the row and add the binary back (2026-09-19)
- **macOS 27 renamed the Accessibility list to «Device Control and Data Access»** (Privacy & Security); the old deep link still lands on it — `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"` (x-speak's grant, 2026-09-29)
- **PlistBuddy cannot `Set` array elements past index 0** in these prefs (`Cannot Perform Set On Containers`; index 0 works, which makes it look transient) — write with python `plistlib` and assert the value's type first (2026-09-19)
- **FDA on an ad-hoc-signed launchd binary does not unlock `FileManager.trashItem` on an iCloud-managed
  folder** (`~/Desktop` with Desktop & Documents in iCloud): reads and a plain `moveItem` into `~/.Trash`
  work, the trash call is brokered and refused — read + a `folder writable` line in the error path told
  it apart from a permission deny in one run (2026-09-18). a bare «trashed 0 / exit 0» on a folder with
  nothing old enough reads identical to a deny: log the scanned count
- `plutil -convert json` drops xml comments — prose in a plist is read from the raw file; `launchctl
  print` repeats `state =` in nested blocks — anchor the parse on the top-level line
- `pnpm frame:link apply` links new leaves and never prunes a dangling old symlink after a rename
