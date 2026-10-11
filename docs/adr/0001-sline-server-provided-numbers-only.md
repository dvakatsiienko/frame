# Sline displays only server-provided numbers

Every number sline renders (quota percentages, context usage, the value gauge)
comes from the statusline JSON Claude Code pipes on stdin — sline never computes
estimates client-side. A segment whose field is absent is omitted rather than
approximated.

Carve-out: boolean flags derived from local filesystem facts are allowed when
the JSON offers no counterpart — the ❄️ cold-cache marker reads transcript
mtime (last API activity) against the plan's prompt-cache TTL. A stat result is
a fact, not an estimate; the invariant bars invented *numbers*.

Carve-out (2026-10-11, dima's ask): the 5h pace gap — `used − elapsed share of the window`, printed 🔋 +n% under the
even pace and 🪫 -n% over it, the same figure x-mod-stash's band shows. It is arithmetic of two server fields
(`used_percentage`, `resets_at`) and the clock, with no rate extrapolated, so it cannot decay or spike the way the
removed burn rate did.

## Considered Options

A burn-rate segment (cost ÷ wall-clock duration) existed and was removed: it
decayed while the session sat idle and spiked in the first seconds. On a display
glanced at all day, honest-but-missing beats plausible-but-wrong.
