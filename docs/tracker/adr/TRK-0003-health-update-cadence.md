# TRK-0003 — health update cadence

status: accepted (dima, 2026-08-18)
context: project health updates had no cadence, so they were written when someone remembered. an update that lands only on a schedule goes stale between real events; one that lands only on events leaves quiet projects looking dead.

decision: both, not either.

- **weekly per active project** — the floor. every project with movement gets one update a week.
- **event-driven on real state changes** — on top of the floor. a project born or dissolved, a story finished, a decision that changes direction. never for routine ticket churn.

consequences: dispatch owned the writing; clio owns it now (`rules/dispatch.md` retired). a quiet project produces no weekly update and that is the signal, not a gap. health updates are a tracked surface — see the glossary entry, including the mandatory markdown links.
