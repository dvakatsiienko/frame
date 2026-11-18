# HRD-0002: one state pattern, hand-written, for every herdr machine

The 13 Nov herdr mess hunt (`~/frame/.scratch/herdr-review/codie.md` § 1–2) found the same shape behind every slow fix: a fact dima sees (is this ask ticked, did this effort apply, did this message join) was stitched at draw time from three to six sources on different clocks, and each fix added one more priority rule or time window. FRM-628 spent a day of rounds on one key alone. We decided every herdr machine follows one pattern, written once in `x:guide-code` § state: one owner per fact, named states never pairs of flags, changes only through events named for what happened, pure transitions, a timer that belongs to a state and dies with it, and a view that draws from the one owned state. The pattern is hand-written, with no library, and the cc mods take the same rules after their own mess hunt (FRM-648, dima's o28–o32, 2026-11-18).

## Considered options

- **a library: machina 8.2.0, XState, robot3** — decided against. Herdr loads no package by name, so any library is a vendored copy with no update channel: a `pnpm` upgrade never reaches it, and it rots (dima, FRM-648:W2). Prior art: `_clio/.scratch/state-machines/prior-art-2.md`; tldraw's `StateNode.ts` and VS Code's `linkComputer.ts` hand-roll theirs.
- **keep each feature's own flags and timers** — decided against: that is the shape the mess hunt found.

## Consequences

- a machine is a pure `next(state, event)` beside a small owner that holds the state, so a test drives every edge with no timer
- code shared by two mods lives once in `home/.config/herdr-app/mods/_shared/`; `herdr-mods:land` copies each file a mod lists in its `mod.json` `"shared"` field, and a test reds a copy that drifts
- the inventory of today's machines (`~/.local/state/x/lanes/herdr-lane-2/inventory.md`) is worked worst first, one chunk each; the board's ask press is the first
- sixth sense grades any state a herdr change touches against the guide's rules
- an automatic check that reds a stray flag or timer waits until the pattern shows it helps (dima, FRM-648:W6)
- borrowing from another codebase (shepherdr) reimplements the shape on this pattern, and copies only a small pure function, with its license credit in the file (FRM-648:W15)
