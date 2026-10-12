# x traces every call locally, keeping names and never values

telemetry decides which verbs live (`PRODUCT.md`: a thin verb lives while the trace shows it used), so it was built first, before the hot families. each call appends one json line under `~/.local/state/x/trace/` at exit: no network, no daemon, 90 days, `X_TRACE=0` turns it off. a line keeps verb and flag names, entity ids, the caller, time and the error kind — never a flag value, a body or a path outside the repos — so a trace file can never leak a secret or a ticket's text.

- a **dev build** is marked at build time by its diff against its merge base with `origin/main`, and `x stats` leaves it out unless `--dev`. the go `-dirty` version was rejected as the signal: main's own x reads dirty whenever the frame tree holds any uncommitted file, which is almost always (dima, 2026-10-08)
- a raw-door call keeps its **shape** (operation kind and top-level fields), never its query text
