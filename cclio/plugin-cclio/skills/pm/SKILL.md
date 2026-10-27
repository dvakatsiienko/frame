---
name: pm
description: >-
  cclio's linear handbook. load before any ticket write — create, body edit, state or label set,
  link, close, triage, a milestone, a sort, a project update — before a close proposal, and before
  a read that decides what to do next. a plain «what does FRM-N say» needs only `x linear read`.
---

# cclio:pm — the tracker, run by cclio alone

cclio does every linear write; members read, and post a done report or a clean verdict (`rules-lazy/linear-flow.md`
is their whole floor, and binds here too). the words — team, project, story, label group, role,
size, run marker — are defined in `docs/tracker/GLOSSARY.md` and the TRK adrs, never restated here.
every-turn judgment (fold or drop, wishes, the pace contract, the freebie rule) is `craft-pm`;
recipes are [references/workspace.md](references/workspace.md).

## the door — `x linear`

- `x linear read <ids…> --comments --relations` — the whole ticket in one call, both relation
  sides, several ids batched, a capped page named under `capped`
- `list --team FRM --state <s> --label <l>` · `--search <w>`
- `body FRM-N` saves the body to a file, `body FRM-N --set <file>` writes it back
- `set FRM-N --state <s> --add-label <l> --milestone <name>` — keeps every other label
- `link FRM-N blocks FRM-M` · `comment FRM-N --body-file f` · `update <project> --body-file f --health onTrack`
- `archive --days 14`, then `--apply`
- `api '<graphql>'` for the rest; `x schema linear` holds every flag
- create has no verb: `x as cclio -- linear issue create … --project <name> --milestone <name> --description-file f`, never `--state` —
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

- **one executor, one kind, every touch** (the label groups are exclusive, `docs/tracker/GLOSSARY.md` § label): executor `agent` or `human`; a blocker label only while blocked — `needs human` (an agent waits on dima), `needs agent` (dima waits
  on research). a `human` ticket is dima's to start
- **priority** p3; p1 only for a real interrupt, its reason and expiry in the body; p2 or p4 only when
  its importance truly differs; **size** XS · S · M naming its closest done ticket (`size: S, like FRM-372`);
  XS (minutes, under ~80 coder turns) · S (one session, under ~400) · M (allowed, on trial: `craft-fleet-flow` § lane init),
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
- a milestone's name: `<emoji> <the done state, ≤4 words>`, lowercase, the emoji naming its kind, one per kind across projects: 🐉 tooling and the cli; 🫟 a design or redesign; 🪸 a merge or a move; 🌞 a ship to dima's hands; 🧞‍♂️ a trial; 🐋 memory and the fleet's own flow (dima, 2026-10-22, PK-103 W98, on trial) — `🐉 prs land themselves`, `🌞 speak v2 shipped`; its description opens with its done test (≤255 chars)
- the name is the outcome dima notices, never a lane or step number (the boot flags one); the scope gathers one flow's related tickets — speak v2 holds its redesign, wisps, design and new features together — so the name stays wide enough for the whole family (dima, 2026-10-23: «Milestone scope should be grouped by collocating related tickets together inside of a milestone by a flow type»)
- a project, a term or a label group that changes lands with its glossary or TRK line in the same batch
- 250 non-archived tickets is the free plan's cap: resolve faster than create, one fuller ticket
  over strands, archive closed work; near 200 → propose a restructure pass
- the approval is one batch, diff-shaped: `field: old → new` per line; silence on a line accepts it
- labels are steering, dima writes instructions into their descriptions; a canceled ticket counts
  as resolved in milestone math; a milestone has no close: linear computes `status` done from its tickets, and the only removal is `projectMilestoneDelete` — a delete, asked per milestone (root invariant 8)

## write and close — read the reference first, every time

- 📖 **a create, a body rewrite or a comment → read [references/body.md](references/body.md) first**: the body order (lane, wish, dima notes … closing word), writing, run markers. no body is written from memory of this section
- 📖 **a close, cancel, merge or reshape → read [references/closing.md](references/closing.md) first**: the three auto-close cases, the close test, the ask-guard
- what holds even without the read: a rewrite starts with a full-body fetch (`x linear body`); dima's words survive every edit and never go into a comment; every id is a link; a body cclio creates and every comment cclio writes end with the run marker `⸻ 🪪 <run> · <model> · agent run stamp — please keep 🙏`

## reading — how deep

- every touch pulls hop 1 (`--relations`, ~20 tokens each); a hop-1 body is read when its title
  says it decides something about the task; hop 2 is weighed, never automatic — the graph has cycles
- a closed ticket with a closing word is read, done or canceled alike: a dropped ticket carries the
  reason nobody should re-propose it. never filter relations by state
- relations are hunted on every touch — parent, sub-issue, related, blocks, blocked by, duplicate —
  and set in the same batch; the test: «would this change how i do the other one?»
- a research doc that answers a ticket's open line writes «→ research says …» under it the same session

## the sorting phase

dima, 2026-09-03: *«we plan a lot, and then when we get to a bunch, we have a pile of unsorted
tickets.»* every new branch and milestone opens sorted: after its tickets exist and before any
work, cclio proposes the order, dima corrects it, it lands in `sortOrder` (recipe in
`references/workspace.md`). a milestone's `blocks` chain is the order, and its `sortOrder` is
written from it at every sort and sign, so the boot's «next» and dispatch agree. priority stays
importance, never sequence; re-sort when the milestone changes shape, never mid-ticket.

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
