---
description: load on dima's «prep», «sign», «re-sign», «grill <ticket>», «next chunk», «shape-lane», «fast» — a ticket to grill and sign before a lane, one chunk at a time, or many at once in fast mode.
---

# /cclio:shape-lane — dima's ✍️ sign on a chunk

dima, 2026-10-09: «each time we prep a lane chunk, our flow is fixed for this part, and we then solve chunk-prep issues in the scope of that skill». this is his part of lane init: a grill that ends in his ✍️ sign. the machine part — the spec, the exit lines, the spawn — is `cclio:shape-lane-dispatch`; the contract (the states, where each thing lives, re-sign, a lane per milestone) is `craft-fleet-flow` § lane init.

it runs over any ticket: a safety-net re-grill after `cclio:shape-idea`, the real shaping for a ticket born without it.

## 0 · read what is settled

read the ticket's wish block and its `decided` section before the first question. every question cites the W-lines it settles; the round is written to its proposal file first, `.scratch/<ticket>/grill-<n>-proposal.md`, where the wish-cover hook reds a W-line it lost.

then the open children of the app's `🌠 <app> wishes` parent ticket: one that rides along — a trial, a test drive, a «carry into the next touch» — joins the chunk or is named in the grill. a small UI ask goes the `craft-fleet-flow` freebie way (dima, 2026-10-11: «keep this trial reminding me to run a coder on applicable apps»).

## 1 · the chunk card

a card is an h2 heading and two plain lines: no fence (a fence means «copy me»), no blockquote, no bullets, no `·`. the shape, as raw markdown:

    ## 🍫 <chunk title> — <ticket link>

    **why we have it** — <one line>

    **what we want out of it** — <one line>

## 2 · the grill

load `mattpocock-skills:grilling` and run its ❓ round as written — the frontier only, no shape of our own (`habit-dima-comms` § grill) — whole in the reply and as orbit asks (dima, 2026-10-10: «grills print as usual in a response, orbit only sends my reply»). orbit is the only answer door: no pre-filled answer fence in the reply (reply-check blocks one).

- **single mode is the default**: one chunk per grill, the chunks one after another, ten tickets are ten grills in a row (dima, 2026-10-23: «if we prep chunks like this, 5 at once, each chunk loses precision»)
- **fast mode, on his word «fast»**: many chunks prepped at once, speed traded for precision but still leaning to precision. first a triage prints, one line per chunk with its reason, and he may move any: a chunk fits fast only when it needs no decision of his beyond the § 3 fields; the rest go to single mode after. a fast chunk is still fully groomed: i run the grilling skill on it myself, ask its questions and answer them, and its body is complete before the sign
- a chunk's size and split rule: `craft-fleet-flow` § lane init (size)
- his answers fold into the ticket's `decided` the same turn

## 3 · what the sign carries

dispatch runs without dima, a shift included, so before the sign the ticket holds: the 🎯 done test; the milestone («which milestone?» — a lane takes one milestone's chunks); the `lane:` kind; the repo; its order among its siblings (a `blocks` relation, `sortOrder` rewritten to match); and, when the chunk edits the guards, the review workflows or merge-auto, his merge pre-approval as a `## signed` line. a missing field is a question in the round, never a guess.

## 4 · the sign

the grill and the groom come first: the chunk is healthy — good content, a good size, every question settled, the ticket groomed and reading well (dima, o108).

- **a grill he answers whole is the sign** (dima, o64): the round asks the § 3 fields too, no separate sign ask follows, and a steer on any question opens the next round. a fast chunk, self-grilled, still gets one `✍️ sign FRM-N: <title>` ask
- on the sign: `x linear set FRM-N --add-label signed --state Todo` (out of Triage; a re-sign keeps a started ticket's state)
- and a line appended to the ticket's `## signed` block, `✍️ signed <YYYY-MM-DD> · body <hash>` (the block's format: `cclio:pm` `references/body.md`)
  - the hash is the first 8 of `shasum -a 256` over the body above `## signed`
  - a line in the block is never edited: history is how a lane gets debugged

- **every body write to a signed ticket appends its `## signed` line in the same write** (o109), a wish re-fold and a moved want included: a re-sign line, or `✏️ changed <YYYY-MM-DD> — <what>, no re-sign: tiny · body <hash>`; an edit no line covers (his own edit in the linear app) shows at dispatch, where the body's hash no longer matches the last line's; a guard in `x linear body --set` that enforces it rides FRM-384

- **re-sign**: a signed ticket that would change — his new wish, my extend, merge or split — gets a proposed re-sign in orbit; the re-sign is this skill again over the new scope, appending `✍️ re-signed <YYYY-MM-DD> — <what changed> · body <hash>`; a tiny change may skip the grill, never the line; after 🚀 the `signed` label stays off and dispatch § 6 re-seals, unless a ↩️ follows the 🚀 (dispatch § 6)
- **one birth door, the fold**: shape-lane runs over a ticket. a wish he wants signed on the spot folds into its ticket, and the grill and sign follow in the same turn, a few calls in a row, never a second turn

**done** = every chunk of the session carries the `signed` label and a dated `## signed` line, with every § 3 field present. «grilled» without the sign is reported as not signed. what follows is dima's «what can we dispatch?» — `cclio:shape-lane-dispatch`.
