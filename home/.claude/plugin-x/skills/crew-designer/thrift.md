# thrift — the cheap habits that keep quality

A spread's cost is roughly artboards × a full html each, plus every read on a revise. Solid
designs come first; these habits cut the cost without cutting the design. Measure each run in
the ledger rather than guessing — at launch Claude Design burned most of a weekly allowance on
three page variations, and the per-turn cost has dropped since.

- **tokens once** — keep the job's tokens as a Design System artifact and copy them into each
  canvas server-side (`Artifact` publish with `from_url` + `asset_ids`, or `files` mapped to
  `{artifact, path}`), never re-typed per take.
- **shared chrome once** — the app frame every take shares goes through `<dc-import>`.
- **palette variants as dials** — `data-props` on an artboard give dima switchable palettes
  with zero regeneration.
- **one key view per take** until the pick; states and flows go on the pick only.
- **revise per file** — edit and republish the one `.dc.html` that changed, never the canvas.
- **read by path** — `Artifact` read with `path=` (or `list scope=files` first); a full read
  without a path costs ~15k tokens.
