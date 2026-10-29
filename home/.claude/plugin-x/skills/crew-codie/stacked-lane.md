# a stacked lane — read only when the brief says `pr mode: stacked`

stacked prs are on trial (`docs/test-drive/stacked-prs.md`): the lane exists to measure them, so its hand steps are data.

- one layer per dependent part, each its own branch and pr: `x lane pr-open --base <the layer below>`; the bottom layer goes onto main; each layer stays one concern, reviewable alone
- once the layers are open, `x lane stack link --apply` links them and `x lane stack view` reads them back
- main moved or a lower layer changed: restack, never merge main into an upper layer — `x lane restack`, until it lands `x lane rebase-main` per layer bottom-up; here § 4's «never a rebase of a pushed branch» is lifted for your own layers only (dima, 2026-10-23)
- a fix that belongs to a lower layer lands there, then the stack restacks; a scope add on a lower layer's code that arrives once that layer is verifier-clean lands on the top layer instead (FRM-423)
- clio merges the stack in one call; you never merge a layer
- at every layer's land, your retro gains a «stack» block apart from its 12 lines: the layer and its size, the hand steps only the stack cost (restacks, retargets, re-reviews) with their minutes, and your verdict in plain words — did the stack help or get in the way, would you pick it again
