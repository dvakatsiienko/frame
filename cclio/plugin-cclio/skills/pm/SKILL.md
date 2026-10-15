---
name: pm
description: >-
  cclio's linear handbook. load before any ticket write — create, body edit, state or label set,
  link, close, triage, a milestone, a sort, a project update — before a close proposal, and before
  a read that decides what to do next. a plain «what does FRM-N say» needs only `x linear read`.
---

# cclio:pm — the tracker, run by cclio alone

cclio does every linear write; members read, and post one done comment (`rules-lazy/linear-flow.md`
is their whole floor, and binds here too). the words — team, project, story, label group, role,
size, run marker — are defined in `docs/tracker/GLOSSARY.md` and the TRK adrs, never restated here.
every-turn judgment (fold or drop, wishes, the pace contract, the freebie rule) is `craft-pm`;
recipes are [references/workspace.md](references/workspace.md).

## the door — `x linear`

- `x linear read <ids…> --comments --relations` — the whole ticket in one call, both relation
  sides, several ids batched, a capped page named under `capped`
- `list --team FRM --state <s> --label <l>` · `--search <w>`
- `body FRM-N` saves the body to a file, `body FRM-N --set <file>` writes it back
- `set FRM-N --state <s> --add-label <l>` — keeps every other label
- `link FRM-N blocks FRM-M` · `comment FRM-N --body-file f` · `update <project> --body-file f --health onTrack`
- `archive --days 14`, then `--apply`
- `api '<graphql>'` for the rest; `x schema linear` holds every flag
- create has no verb: `x as cclio -- linear issue create … --description-file f`, never `--state` —
  a new ticket is born in Triage, and promotion out of it is dima's (2026-08-31)
- every call acts as the cclio app (`viewer` answers `cclio, app: true`); `--as coder` writes as the coder app

traps:
- the raw cli's `issue update --label` replaces every label
- a body or comment always goes through a file; inline `"$(cat …)"` mangles `$VAR` and backticks
- linear renumbers an inline «2.» inside a list item
- a label name takes no emoji; a label or project description stops at 255 chars
- a call hanging over 15 s is a hidden keychain prompt: tell dima
- a number you state comes from a paged query (`pageInfo { hasNextPage }`): a capped page looks complete
- old `DOT-N` ids resolve to `FRM-N`, never sweep them

## every create and every update — the fields

- **one role, one kind, every touch** (the label groups are exclusive): role by readiness and by
  who waits — `agent`, `human`, `needs human` (an agent waits on dima), `needs agent` (dima waits
  on research); a blocker is a relation, never a role. a `human` ticket is dima's to start
- **priority** p3; p1 only for a real interrupt, its reason and expiry in the body; p2 or p4 only when
  its importance truly differs; **size** XS · S · M naming its closest done ticket (`size: S, like FRM-372`);
  XS (minutes, under ~80 coder turns) · S (one session, under ~400) · M (split it before a spawn),
  set as the word (`x linear set --estimate S`); L and XL are never set, an old 4 or 5 is resized when touched;
  **project**, unless it is a one-off or an idea pool; **parent** by the test «which story does it
  die with?», none → flat; **milestone** inherited from the parent
- **an assignee carries no meaning**: Linear may assign dima through a linked commit, and that is fine
  (dima, 2026-10-15); his own tickets carry the `human` label. the delegate says who works it:
  cclio starts it → `delegateId` cclio (`0e9bab8b-1e99-4d9c-90f8-57ce3166ca7a`); handed to a
  coder → the coder app (`195a6ec0-ed0c-4519-9750-948eac4e5e00`)
- **work starts** → In Progress the same turn, and the sline pin:
  `printf '{"session_id":"%s","prompt":"claim FRM-N"}' "$CLAUDE_CODE_SESSION_ID" | ~/.claude/shelf/hooks/sline-focus.sh`
- **the assumption gate**: write the size, then list what you had to believe to reach it; a fact
  dima never said makes the ticket `needs human`, the fact a `?` line in the body. it blocks the
  size, never the capture: the ticket is still born, fully fielded
- a new milestone is appended last: set its `sortOrder` the same turn and read the order back
- a project, a term or a label group that changes lands with its glossary or TRK line in the same batch
- 250 non-archived tickets is the free plan's cap: resolve faster than create, one fuller ticket
  over strands, archive closed work; near 200 → propose a restructure pass
- the approval is one batch, diff-shaped: `field: old → new` per line; silence on a line accepts it
- labels are steering, dima writes instructions into their descriptions; a canceled ticket counts
  as resolved in milestone math; a completed milestone never cleans itself up

## the body — a spec seed

`to-spec` runs on the body alone (dima, 2026-10-07). in order, a small ticket filling only the lines it has:

- `lane: <name>` — the first line
- **wish** — dima's words, folded (`cclio/memory/dima-wishes.md`)
- **dima notes** — his later asks, notes and verdicts on the ticket, folded and dated; the ask-guard reads them before any close
- **why** — what hurts today
- **stories** — 3–8 lines, «as dima, i …»
- **proposed** — his vision of the solve, open until a grill moves a line to decided
- **decided** — each call with its source (dima, a grill, an adr)
- **open** — `?` lines; a ticket goes to `to-spec` only with this empty
- **exit** — given/when/then (`cclio:shape-lane`)
- **out** — out of scope and «decided against», so nobody re-proposes it
- **refs** — research, designs, prior art
- **closing word** — at close

**the ticket ↔ spec rule, its one home** (dima, 2026-10-10: «i still worry that it is somewhat scattered across places»): the want lives in the ticket's wish block, always — a moved want is edited there, before and after dispatch. the how is the body's `proposed` / `decided` until dispatch; `to-spec` then moves it into `.scratch/<feature>/spec.md`, which opens with `wish: FRM-N` in place of a problem statement and never restates the want; steers on the how land in the spec, and its outcome folds into the closing word when the run lands. the run check, logged in `docs/test-drive/spec-pipeline.md`: «did `to-spec` need anything outside the body?» the slices `to-tickets` cuts live in `.scratch/<feature>/issues/`, never in linear.

- 🚨 **dima's words never go into a comment**: the body is read by everyone, a comment by a
  graphql fetch. comments carry trail only — run stamps, «done, see commit», a member's done report
- a `standing` ticket carries no comments: a round on it is a child ticket, which takes the state,
  the pr and the done report; a coder brief names the child, never the
  standing ticket (dima, 2026-09-30, BYT-105)

## writing — pretty, short, true

- lowercase register, emoji and ascii art welcome
- a title is subject-first and assertive, like a commit subject: «prune brew of unused formulae»;
  a blurry ask gets a sharp title proposed, never filed as mush
- the body holds key data, a list by default; prose stays where it carries what a list would drop
  (a decision's reasoning, a grill summary). one recommendation, the runner-up a clause
- no dates or lineage: linear stores dates, a relation replaces «split out of …»; a date that IS
  the fact (an expiry, a deadline) stays
- 🚨 **a rewrite starts with a full-body fetch the same turn** (`x linear body`) — linear keeps no
  description history (DOT-228). merge new into old, drop only the stale
- 🚨 **dima's text survives every edit** — his notes, asks, takes: restructure around them; one
  that looks stale goes to him first, the original beside the change. an approved fold is not an
  approve to drop his words
- a suspected wall of prose is flagged to him, never stripped on a heuristic
- tracked means every surface: project descriptions and overviews, health updates (their ids do
  not auto-link — write full links), label names and colours, team descriptions; a new project gets dima as lead, its
  real status, an emoji-led lowercase description and a short overview
- drafts go out as one batch for one approval, never edit ping-pong
- 🚨 every id is a link (`rules/fleet-output-format.md`) — the most-repeated slip on this surface: scan before sending

## run markers

mint one per session at the first write, reuse it all session: `<surface>·<YYYYMMDD>·<slug>`
(`cc·20260819·batch1`); a pulled session continues the run from the CST META. it is the last line
of a body cclio creates and of every comment cclio writes:

```
⸻ 🪪 cc·20260819·batch1 · <model name> · agent run stamp — please keep 🙏
```

- before a create, search the marker plus the title stem: a hit is updated, never filed twice
- a ticket dima wrote never gets a stamp; an existing ticket gets it on the comment only

## reading — how deep

- every touch pulls hop 1 (`--relations`, ~20 tokens each); a hop-1 body is read when its title
  says it decides something about the task; hop 2 is weighed, never automatic — the graph has cycles
- a closed ticket with a closing word is read, done or canceled alike: a dropped ticket carries the
  reason nobody should re-propose it. never filter relations by state
- relations are hunted on every touch — parent, sub-issue, related, blocks, blocked by, duplicate —
  and set in the same batch; the test: «would this change how i do the other one?»
- a research doc that answers a ticket's open line writes «→ research says …» under it the same session

## closing — proposed, never performed

auto-close is for three named cases, each said out loud: **stale** (the body proves it), **dupe**
(the surviving id named), **freebie done in place** (shipped this turn). everything else goes to a
printed «closable, because …» list and waits for his word.

- each entry passes the close test: what became better (the closing word), what strays (findings,
  sub-items, dima notes the close would orphan)
- 🙋‍♂️ **the ask-guard, above every skill template**: a close, cancel, merge or reshape of a ticket
  carrying dima's asks prints them first, one line each with its destination (answered here, moves
  to X, dies); the ticket cannot close until he verdicts each — «yes let's do», «not important anymore», or a steer; no answer, not resolved
- his «close all listed» closes the batch; silence closes nothing; an approved close still gets
  its closing word in the body

## the sorting phase

dima, 2026-09-03: *«we plan a lot, and then when we get to a bunch, we have a pile of unsorted
tickets.»* every new branch and milestone opens sorted: after its tickets exist and before any
work, cclio proposes the order, dima corrects it, it lands in `sortOrder` (recipe in
`references/workspace.md`). priority stays importance, never sequence; re-sort when the milestone
changes shape, never mid-ticket.

## app stash pairs

each app keeps «<app> wisps» (fixes, p2) + «<app> wishes» (features) — trophy-sys BYT-88/89,
atelier BYT-115/105, chords FRM-277/255, speak FRM-281 (**✨ wisp**: `rules/fleet-vibe.md`). bugs
should not exist (dima, 2026-09-30): any round that touches an app carries its open wisps into the
same brief, first. `standing` is for the fleet's records (pm, memory, nvim, skills), never an app's list.

## the app identity — notifications

every app write notifies dima: linear treats cclio and coder as other people (2026-09-28: 68 unread
in two days, all ours). cclio comments when something waits on dima, or to stash what the fleet
will need later; trail that the gazette or a pr already carries stays out. dima wants the
notifications, just not the spam — marking them read for him is parked, his call.

**done** = every touched ticket carries role, kind, priority, size or its blocking `?`, project,
parent and milestone where they apply, and the batch or the one-line confirmation names what was set.
