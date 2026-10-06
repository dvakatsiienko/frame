# TRK-0002 — label vocabulary: block direction, standing, vet

status: accepted (dima, 2026-08-18)
context: `needs-info` named a block without saying which way it pointed — a ticket waiting on dima and a ticket waiting on an agent carried the same label and could not be filtered apart. separately, standing tickets (DOT-82) were parked in a fake perpetual In Progress because no label said "open by nature", and the TRK-0001 consequence line left that state question open. label names had also drifted toward hyphens, and team-level labels would fragment the vocabulary across DOT/BYT.

decision — one entity per id:

- **L1 `needs human`** — the agent is blocked on dima's information or decision. replaces the blocked-on-dima half of `needs-info`.
- **L2 `needs agent`** — dima is blocked on agent knowledge or research. new; the direction that had no name.
- **L3 `needs-info`** — retired. every use migrates to L1 or L2; nothing keeps the old name.
- **L4 `standing`** — the ticket is long-running by nature and stays open while active. example: DOT-82.
  - ⚠️ **amended 2026-08-19 (dima ✓), and this reverses the original reading.** L4 first said the
    label *replaced* parking such tickets in a perpetual In Progress. it does not — a `standing`
    ticket legitimately sits In Progress between rounds, and the label is precisely what marks that
    state as honest rather than stale. the exception is written into `rules/linear-flow.md`. this
    line is amended rather than rewritten so the earlier reading stays visible. the reversal is
    recorded as a decision in [TRK-0004](TRK-0004-label-system-evolution.md), which also closes the
    `needs *` family at three and bans project-meaning labels.
- **L5 `vet`** — 🧪 trial. examine an idea before committing to it. mutates into `investigate` if the shorter name does not survive use; delete the label rather than keep a dead one.
- **L6 label language** — no hyphens in label names, ever. workspace-level labels only, never team-level: one vocabulary across DOT and BYT.

consequences: L6 is what retires the `needs-info` spelling as much as L1/L2 do. the role slot in `docs/tracker/GLOSSARY.md` becomes `agent · human · needs human · needs agent`. the triage role bridge in `docs/tracker/GLOSSARY.md` remaps the mattpocock `needs-info` role onto L1/L2 by direction. L5 is under test — revisit before treating it as settled.
