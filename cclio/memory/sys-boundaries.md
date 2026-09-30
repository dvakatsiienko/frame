# surface boundaries — what stays separate

**An agent mutates only its own memory** — `cw` and cloud `cc` keep their own stores.

**Domains never merge either**: repo context, tracker context (`docs/tracker/`, TRK-nnnn) and the
fleet vocabulary are separate by design — cross-reference by pointer, never fold one into another
(the layout itself lives in `frame/AGENTS.md`). The fleet vocabulary is a bounded-context
glossary (test drive, slay, run id, CST, freebie) belonging in ONE file every surface reads —
[DOT-220](https://linear.app/x-com/issue/DOT-220), the memory standing story, holds it (DOT-73 dissolved into it). Grow it lazily during real work; challenge
conflicting terms on sight; ADR only for hard-to-reverse, surprising decisions.

- 🎯 a «surfaces are out of sync» symptom → ask whether the two sides need to be two sides;
  never propose another sync mechanism. The old sync program died by deletion, and that was the
  fix.
- **mcp vs cli — which machine does the shell reach?** cclio's shell is the mac → cli. `cw`'s
  shell is a throwaway container → a local mcp server is its only door to the real filesystem.
  Say that inside the tool's description. Decided in [FRM-185](https://linear.app/x-com/issue/FRM-185).
- several pm leaves here are fleet-wide in a private store — placement rides
  [DOT-220](https://linear.app/x-com/issue/DOT-220), never moved unilaterally.
