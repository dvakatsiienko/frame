---
description: load on dima's «prep», «sign», «re-sign», «grill <ticket>», «next chunk», «shape-lane» — a ticket or a pocket item to grill and sign before a lane, one chunk or a batch of many.
---

# /cclio:shape-lane — dima's ✍️ sign on a chunk

dima, 2026-10-09: «each time we prep a lane chunk, our flow is fixed for this part, and we then solve chunk-prep issues in the scope of that skill». this is his part of lane init: a grill that ends in his ✍️ sign. the machine part — the spec, the exit lines, the spawn — is `cclio:shape-lane-dispatch`; the contract (the states, where each thing lives, re-sign, a lane per milestone) is `craft-fleet-flow` § lane init.

it runs over any ticket: a safety-net re-grill after `cclio:shape-idea`, the real shaping for a ticket born without it. over a pocket item, the sign creates its linear ticket the same turn.

## 0 · read what is settled

read the ticket's wish block and its `decided` section (or the pocket item's notes) before the first question. every question cites the W-lines it settles; `node script/wish-cover.ts <PK-N> <round>` exits 0 before the round prints.

then the open children of the app's `🌠 <app> wishes` parent ticket: one that rides along — a trial, a test drive, a «carry into the next touch» — joins the chunk or is named in the grill. a small UI ask goes the `craft-fleet-flow` freebie way (dima, 2026-10-11: «keep this trial reminding me to run a coder on applicable apps»).

## 1 · the chunk card

a card is an h2 heading and two plain lines: no fence (a fence means «copy me»), no blockquote, no bullets, no `·`. the shape, as raw markdown:

    ## 🍫 <chunk title> — <ticket link>

    **why we have it** — <one line>

    **what we want out of it** — <one line>

## 2 · the grill

load `mattpocock-skills:grilling` and run its ❓ round as written — the frontier only, no shape of our own (`habit-dima-comms` § grill) — whole in the reply and as orbit asks (dima, 2026-10-10: «grills print as usual in a response, orbit only sends my reply»). orbit is the only answer door: no pre-filled answer fence in the reply (reply-check blocks one).

- **a batch signs in one session**: one round carries the frontier of every chunk under prep, each question naming its chunk (dima: prep 10 or even 20 up front)
- a chunk has no split rule: S by default, M allowed and watched as a trial
- his answers fold into the ticket's `decided` the same turn

## 3 · what the sign carries

dispatch runs without dima, a shift included, so before the sign the ticket holds: the 🎯 done test; the milestone («which milestone?» — a lane takes one milestone's chunks); the `lane:` kind; the repo; its order among its siblings (a `blocks` relation); and, when the chunk edits the guards, the review workflows or merge-auto, his merge pre-approval as a `## signed` line. a missing field is a question in the round, never a guess.

## 4 · the sign

his yes on the chunk: `x linear set FRM-N --add-label signed`, and a line appended to the ticket's `## signed` block, `✍️ signed <YYYY-MM-DD>` (the block's format: `cclio:pm` `references/body.md`). a line in the block is never edited: history is how a lane gets debugged.

- **re-sign**: a signed ticket that would change — his new wish, my extend, merge or split — gets a proposed re-sign in orbit; the re-sign is this skill again over the new scope, appending `✍️ re-signed <YYYY-MM-DD> — <what changed>`; a tiny change may skip the grill, never the line
- **a pocket item**: the sign creates its linear ticket through `cclio:pm`, in its milestone, and the pocket item becomes a pointer, `ticket: FRM-N` (temporary until the pocket/linear grill)

**done** = every chunk of the session carries the `signed` label and a dated `## signed` line, with every § 3 field present. «grilled» without the sign is reported as not signed. what follows is dima's «what can we dispatch?» — `cclio:shape-lane-dispatch`.
