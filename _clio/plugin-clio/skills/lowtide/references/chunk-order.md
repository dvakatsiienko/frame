# chunk order — the strategy every reorder runs

dima, PK-387:W28–W33 (2026-11-12): the planned chunks build in a logical, natural and efficient order; a review of what we planned shows how to get the chunks out faster.

## when it runs

- a checkup prints the order as it stands; a reorder runs on his ask: «prio X», «analyze tickets closely and propose an efficiently optimized order», a review of the planned chunks
- every sign regroups its lane the same turn (`shape-lane` § 4)
- a new chunk in a hot area (cli, mods) joins the queue, never its tail (dima, 2026-11-01: «it should be your default behavior»): first merged into a signed chunk of its area it truly fits, re-signed; a new chunk only when none fits or the fit is already too big, shaped at birth and proposed for his sign

## the weights, in order

1. **logical**: a chunk another needs goes first, its `blocks` edge says so
2. **most wanted and most useful first**, in any area; a fix ahead of a feature
3. **tiny early**: an XS that unblocks a chunk or clears a tail may jump ahead
4. **merge the tiny**: XS chunks of one area that touch the same files join into one chunk, re-signed through `shape-lane`, so one ci round carries them

## the reads behind the weights

- wanted: the ticket's priority, his W-lines in its wish block and their dates, an open orbit ask or flyway line naming it; a chunk with none of these weighs as plain useful
- useful: what its 🎯 done test or `⚖️ worth it` says it removes, and how many chunks its `blocks` edges free
- same files: the paths its spec (`.scratch/<ticket>/spec.md`) or body names; none named → the merge line says «overlap not checked»

## the print

- per lane, before → after as chunk lines (`shapes.md`), each move with its reason in ≤8 words; a merge prints `FRM-A + FRM-B → one chunk`
- one orbit ask carries it; his tick rewrites the `blocks` chain and `sortOrder` (`clio:pm` § the sorting phase), a merge goes through a re-sign
