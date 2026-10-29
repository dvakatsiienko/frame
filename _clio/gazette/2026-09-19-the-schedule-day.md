---
date: 2026-09-19
slug: the-schedule-day
tickets: [DOT-237, DOT-232, BYT-41, BYT-86]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the schedule day — schedulers get one home, the fleet moves to AGENTS.md, and four false-greens die

a long headless night driven from cowork: `claude -p`, resumed by session id, read-only for the
first half with every change handed back as a diff for dima to apply by hand, write access from
the midpoint on.

## the asks, and what landed

- **«show the cowork gazette run as a peer row in `schedule`»** — done. a cloud job has no pid,
  no plist and no `launchctl` row, so there is nothing to poll: it writes a json heartbeat and
  the reader derives state from **freshness** — fresh + ok → `waiting`, fresh + not ok →
  `failed`, older than 26 h → `missed`, file absent → no row at all. shipped first as a
  hand-counted unified diff under read-only, applied verbatim, `pnpm typecheck` green.
- **«make the descriptions pretty»** — the detail pane stopped dumping the raw plist comment as
  one run-on wall. a pure `toDetailMarkdown` gives it a heading, an italic schedule + next-fire
  line, rejoined prose paragraphs and real bullets for `key — value` lines. both plists'
  `<!-- -->` blocks were rewritten to the shape that renders best.
- **«schedulers are scattered everywhere, they belong in ONE place»** — `schedule/` at the repo
  root: `jobs/<name>/` (plist + `main.swift` + `bin/`), `state/` (heartbeats, gitignored),
  `README.md` as the authority, and **`pnpm schedule:install`**. the correction that mattered:
  the plists were *already* in the repo via the mirror rule — the real gap was that
  `dotfiles:link apply` linked them and **nothing ever bootstrapped them**. the installer closes
  that.
- **«is putting the state file inside the raycast extension good?»** — no, and said so plainly.
  the extension is a build input and a node package; the reader must never own the data, least
  of all with a personal CLI still on the table. the kernel of the idea was right, one level up:
  `schedule/state/`.
- **«does cc read AGENTS.md?»** — yes, verified from the binary's own option help: the
  `instructionFiles` setting, default `claude-md-or-agents-md`, **either/or, never both**. then
  measured with fresh `claude -p` probes rather than inferred.
- **«finish the AGENTS.md migration»** — 6 files renamed, every live reference swept, `grep` for
  the old names prints nothing. `cclio/CLAUDE.md` moved too, with `skill-cclio-mode-snapshot.ts`
  following it.
- **«entity-first the monitors»** — `x-hotkey-stats-monitor` → **`x-monitor-hotkey-stats`**,
  `x-screenshots-autoclean` → **`x-autoclean-screenshots`**. dir, plist filename, `Label`,
  `ProgramArguments`, both log paths, binary, codesign identifier, data dir, pnpm family, source
  comments, `.gitignore`, docs — including the naming-convention example in root memory that
  cited the old name.
- **«pretty emoji, and how do I tell a launchd job from a cowork one?»** — one rule for both
  sources: the description opens with an emoji, the reader lifts it for the display and strips it
  from the text. every row carries an explicit `source`, badged `🖥️ launchd` (polled, measured)
  vs `☁️ cowork` (inferred, only as true as the last beat).
- **«how do I get columns that don't shift?»** — straight answer: you cannot, and the type proves
  it — `ItemAccessory` is `text | date | tag` with no width or alignment field. what *was*
  possible got done: the two rightmost accessories are now fixed-width glyphs, which pins every
  schedule pill to the same column.

## four false-greens, found and killed

the day's theme, and all four are the same shape — **a status that answers «did this fail»
instead of «did this run»**:

- **an always-on daemon reading healthy while dead.** `not running` is health for a daily job and
  death for one launchd is meant to keep alive. same word from launchctl, opposite meaning. now
  red, proved across all seven branches of the predicate.
- **`exit 0` shown as a measurement on cloud rows**, where it was fabricated from the heartbeat's
  `ok` field. the exit code now appears only on a real failure.
- **`0 run(s) this boot`** on jobs that have no boot.
- **the hotkey monitor running blind for two minutes** after its rename: TCC granted, process
  alive, stderr empty, still logging app switches — and capturing nothing. see below.

## tricks gained

- **a TCC grant keys on the codesign identifier, not the path.** moving both jobs to a new
  directory and rebuilding kept both grants; **renaming them broke both**, because the identifier
  carries the name.
- **a grant alone is not enough — the job must be restarted.** a tap created before the grant
  stays dead; macOS does not retro-authorise a live one.
- **`state = running` does not prove a monitor is capturing.** it kept logging app switches,
  which need no permission, while chord capture was silently dead. the only honest check was a
  fresh `chord` line in the jsonl.
- **macOS never prunes a stale TCC row** — every rename leaves one behind. dima's Input
  Monitoring list held `hotkey-stats` from a name dead for months.
- **`launchctl bootout` returns before teardown finishes**, and a bootstrap racing it is refused.
  the installer polls until the service actually leaves the domain — a real signal, never a sleep.
- **the AGENTS.md either/or is project-wide, not per-directory.** with a root `AGENTS.md` and any
  nested `CLAUDE.md`, the ancestor walk finds the `CLAUDE.md`, skips the AGENTS scan entirely, and
  **the repo root goes silently unread**. a mixed tree is broken, not degraded.
- ⚠️ **`~/.claude/CLAUDE.md` cannot become `AGENTS.md`.** renamed it, probed from a neutral dir,
  got `NONE LOADED` — user memory uses a different loader from project instructions. reverted in
  full. it buys nothing regardless: no other provider reads `~/.claude/`.
- **raycast templates an emoji passed as `icon`** and drains its colour; `text` and titles leave
  it alone. though the greyscale dima was actually seeing turned out to be simpler — 📰, 📷 and
  ⌨️ are just grey glyphs. settled by rendering a 🍅.
- **raycast gives no hover affordance at all** — an accessory with a tooltip is pixel-identical to
  one without.
- **arrow consts are not hoisted**: an entrypoint calling its helpers from the top of the file
  crashes on the first run.

## state

- `schedule/` built; both jobs loaded at new paths under new labels; monitor `running` and
  recording, autoclean grant tested (`scanned 106 file(s)`, a guaranteed no-op — nothing was 30
  days old).
- repo is **AGENTS.md** throughout, except `~/.claude/CLAUDE.md` (cannot move) and
  `~/projects/CLAUDE.md` + `~/projects/bytes/CLAUDE.md` (other repos, left alone).
- `pnpm typecheck` clean · `pnpm test` 131 passed · biome clean.
- **nothing committed, by dima's instruction** — ~25 paths dirty for a cowork verification pass.
- `schedule/state/gazette-sync.json` is a **placeholder** and flips red `missed` after 26 h. the
  real beat arrives when the cowork routine runs its new step 5.

⸻ upd 20:05

## the morning — jev, the classifier, and the key store

- **jev is in the fleet** ([DOT-232](https://linear.app/x-com/issue/DOT-232) got its +1): the boot digest lanes every inbox item, and a `UserPromptSubmit` hook prints the skills a prompt should load. sharpened the same day: the router now sees the `cclio:*` skills, skips harness notices, and routes the argument body of a slash command; scorecard after the fixes, 51 prompts, 3 false loads, 0 missed
- **1password is the key store** ([BYT-41](https://linear.app/x-com/issue/BYT-41)): vault `dev`, `op://` references in `op.env`, a read-only service account so no agent ever sees a value; the `linear` cli and x-ray moved onto one `linear-golden` key and every other linear key was deleted. the naming rule is `<service>-golden` for the one shared key. root memory says so now
- **AGENTS.md everywhere but the user root** — measured twice with `claude -p`: `~/.claude/AGENTS.md` does not load, the user memory takes `CLAUDE.md` only. bytes, inner-marker and reinforcement-learning renamed; four next.js apps had a `CLAUDE.md` importing a generated `AGENTS.md`, and a directory holding both **terminates the upward walk** — those apps had run without the bytes root memory for days. folded, walk repaired, generator watched (vercel/next.js #98910)

## the afternoon — hotkeys, phase 5 of [DOT-237](https://linear.app/x-com/issue/DOT-237)

- **research, eleven verdicts** (`docs/research/hotkeys-macos-defaults.md`, [artifact](https://claude.ai/artifact/6wexH7gqMYB4RQg5ir6YNy)): wipe the macos defaults surgically, never wholesale — the user plist holds deltas only, so macos 28 ships its new bindings enabled regardless; one layer per owner (hyper = raycast, ctrl = terminal + cursor); `⇧⇧` over `esc esc`
- **the hotkey map is live**: `hotkeys/` is one home (scan, map, readers; the daemon stays under `schedule/`), the map refreshes its press counts every 2 s under a launchd job, rescans bindings when an app's config changes, draws the right-hand modifiers, and counts a bare modifier pressed alone — wispr's push-to-talk on right ⌘ now has a number
- **eight system chords off**, snapshot of all three prefs domains committed first, `pnpm hotkeys:audit` diffs live against it: fn+ctrl+F2–F6, ⌘esc, siri's ⇧⌘space, and ctrl+←→ handed to raycast. ctrl+↑, ctrl+↓ and opt+esc stay
- **magnet retired**: research ranked raycast window management ⭐⭐⭐⭐⭐ for a keyboard-only raycast user, magnet ⭐⭐ (17 months without a release); the 12 live chords moved on the same `ctrl+opt` gate, the app is gone
- **x-ray**: handoff actions (⌘. copies the path, ⌘⇧C the ingest line), schedule glyphs answer «did the last run go ok» (✅) instead of «is it running», a row can open the thing its job feeds
- **bytes prod green again**: x-com-chat had been red since the jotai 3 major — `jotai-devtools` has no jotai-3 build and its peer range admits one; pinned back, renovate told

## tricks gained

- **an ad-hoc-signed binary's tcc grant is pinned to its cdhash** — a source change silently starves a listen-only tap; the order is edit → build → re-grant → restart, and a plain off/on can re-authorise the old hash. cost an afternoon of rounds; now in fleet-hazards and the schedule README
- a gitignore pattern with a `/` in the middle is anchored to its directory — impeccable's readme block misses nested workspaces; `**/` fixes it, filed as #841
- PlistBuddy cannot `Set` array elements past index 0 in these prefs; plistlib with a type assert
- a coder verified a restart with log lines stamped before the restart — the green-status trap with the rule in context; the fix is comparing timestamps as numbers
- `hotkeys:audit` caught dima toggling system panes mid-write and named him by the ui's integer-vs-bool write signature — the tool doing its job
- the nuphy air75's `fn` is a firmware layer key macos never sees; wispr refuses F-keys and Home/End as single keys but treats right ⌘ as its own key

## state

- dotfiles + bytes pushed; coder `d083cfc8` alive by dima's word, twelve jobs, three retros folded
- DOT-237 In Progress: session A (raycast window-management command pass) then session B (the one-pool rebind after 2026-10-01); both scoped in the ticket body
- queued for the next daemon rebuild: held-ptt counts once, deaf-tap self-check
- skipped by decision: a chrome window raised on top after a space switch — unreported anywhere

## trail

- shipped: `schedule/` collocation + installer, AGENTS.md across four repos (user root stays CLAUDE.md, measured), jev wired + sharpened, 1password as the key store with one golden linear key, hotkeys research + artifact, `hotkeys/` home with a live self-rescanning map that counts bare modifiers, 8 system chords off behind a committed snapshot + audit, magnet retired for raycast wm, x-ray handoff/schedule fixes, x-com-chat prod green (jotai pin)
- open: hotkeys session A (raycast wm command pass) → session B (one-pool rebind after 2026-10-01); next daemon rebuild carries held-ptt counting + the deaf-tap self-check; cursor keybindings stay outside dotfiles by dima's word
- state: dotfiles + bytes pushed; coder d083cfc8 alive by dima's word; bytes touched only for the deploy fix and the memory walk
