# frame

The inventory of one mac, in three tiers: the mirror (`home/` symlinked into `~`), the machine
(Brewfile, macOS defaults, launchd jobs as data), and the fleet (the Claude Code layer in
`home/.claude/`, cclio, sline, plugin-x, hotkeys).

## Maturity — read before proposing changes

Areas of this repo are at very different stages, and treating them alike produces bad advice.
A review that hardens an area still in flux is worse than one that skips it.

| area | state | how to treat it |
| --- | --- | --- |
| **sline** | solid | conventions here are settled; match them |
| **`script/`** | solid | same — the engine and the print vocabulary are load-bearing |
| **skills, `CLAUDE.md`, rules, output styles** | evolving, not in good shape yet | findings welcome, but do NOT write them into rules or ADRs as doctrine — the shape is still being found |
| **zsh — aliases, functions, rc files** | acknowledged mess, refactor pending | observations belong on DOT-36 as input, never in a guide. Nothing here is an example to follow |

Stated by Dima 2026-08-16. When an area graduates, move it and say so — a stale maturity map
misleads more than none.

## Language

### Sline

**Sline**:
This repo's implementation of Claude Code's statusline feature — the Go binary, its state file, and the settings wiring, as one subsystem.
_Avoid_: statusline (that names the official CC feature slot sline plugs into)

**Segment**:
The smallest self-contained unit of the rendered line. A segment renders only when its data source provides its field; otherwise it is omitted entirely.
_Avoid_: widget, block, part

**Alert**:
An active fault rendered in the alert segment that closes line 1 — the single place any fault appears, at one of two levels (`warn`, `crit`). The label states the fault in words; colour only reinforces it.
_Avoid_: error state, badge, marker

**Quota window**:
A subscription rate-limit period — the 5h window or the weekly window.
_Avoid_: bare "window" (ambiguous with context window)

**Context window**:
The model's token budget for one session, as reported by Claude Code.
_Avoid_: bare "window"

**Severity bar**:
A cell bar whose filled cells are colored along a green→red ramp by the percentage it displays.
_Avoid_: progress bar (nothing is progressing)

**Value gauge**:
The `~$` segment — the API-equivalent value of a session's tokens on a subscription. Not money spent; the `~` marks it as such.
_Avoid_: cost, spend

**Rollover**:
A quota window resetting while the session sits idle.

**Stale-quota guard**:
Rendering 0% instead of the pre-reset percentage once a quota window's reset time is in the past.

**Focus pin**:
The ticket this session is on — one slot, sticky, rendered `🪄 DOT-23`, dimmed once it goes 8h unrefreshed. Written by `shelf/hooks/sline-focus.sh` when Dima types `claim DOT-23` on a line of its own (alias `pin`), and by the agent itself when it moves a ticket to In Progress; `ticket fly` clears it.
_Avoid_: current ticket, active issue

**Status cache** (`focus/status-cache.json`):
Linear state for the pinned id, written only by `shelf/hooks/sline-status-fetch.sh` and read only by sline. Shared by every session, merged never replaced. Sline never fetches from a render.
_Avoid_: ticket state (ambiguous with the pin), sync

**Rule** (`~/.claude/rules/*.md`):
An always-loaded instruction file, auto-loaded into every session with no import and no hook. Distinct from a **skill**, which loads only when its trigger fires. A rule costs resident tokens everywhere, so it holds only what must be true without being asked for.
_Avoid_: guide (that names the `guide-*` skills), instruction

**Store contract**:
The normative half of `CST-SPEC.md` — the handoff store's mechanics (perms, naming, `-shared`, the sweep, membership, race tolerance), owned in one place because the implementations cannot share a library across bash, TypeScript and Go.

**Sline state file** (`sline-state.json`):
A disposable cross-render cache (emoji rotation, pnpm version). Deletable at any time without harm; never git-tracked.
_Avoid_: sline-db, database

### Artifact shelf

**Shelf**:
`~/.claude/shelf/` — the consolidated store for everything we bake — artifacts our skills produce, and the scripts and assets behind them (not Claude's own config). One subdirectory per artifact family: `shelf/handoffs/`, `shelf/yt-transcripts/`, `shelf/flawlog/`, `shelf/sounds/`, `shelf/hooks/`. It lives in this repo under `home/.claude/shelf/` and is symlinked into `~/.claude/`; each family decides for itself whether its contents are tracked.
_Avoid_: store (collides with redux/app stores mid-project), stash (collides with git stash)

**Transcript**:
A shelved text extraction of a video — the artifact the `transcript` skill family produces and recalls. Source-agnostic term: YouTube today, possibly other sources later.

### Sessions & handoffs (shared with plugin-x)

**Session**:
One Claude Code conversation — a registry entry and a peer-messaging endpoint.

**Session label**:
Sline's rendered form of a session's name — kebab-cased and truncated.

**Peer socket**:
A session's inbound message endpoint at `/tmp/cc-socks/<pid>.sock`.

**CST (Continuation State Transfer)**:
The machine-optimized context package one thread produces so another thread — in any handoff frontend — can continue it. Defined once in `CST-SPEC.md`.

**Handoff frontend**:
A surface that can produce or ingest CSTs — the `cc` `handoff*` skills, or `cw` via the `x-cw` MCP server.
_Avoid_: naming one frontend when the statement holds for all

**Handoff store**:
`~/.claude/shelf/handoffs/` — the directory all handoff frontends share. Files are transient: deleted on ingest (`-shared` kept), swept after 24h.

**Pending handoff**:
A CST file in the handoff store awaiting ingest. The handoff skill family and the `cw` MCP server own its lifecycle; sline's 📬 only observes.
