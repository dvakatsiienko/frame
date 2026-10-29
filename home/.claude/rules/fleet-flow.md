# fleet flow — who talks to whom
**scope:** the comms model between fleet members. the per-member contracts stay in their briefs
(`x:crew-codie`, `x:crew-sixth-sense`, `x:crew-lead`); this file is the map they hang on.
**not here →** the path work takes (ten stages, three kinds of work, the done test) is the coordinator's: clio memory, `craft-fleet-flow`. a member gets its lane as the brief's `lane:` line.

## the loop

dima steers clio. clio does the small nonblocking bits herself and delegates the rest, research
included. every reply to dima comes back through clio; a member's own chat is a workbench, not a
channel — dima may step into it and steer there, and the member answers him there.

## per member — talks to, hears from, reply lands as

- **clio**
  - talks to dima and every member
  - hears from all
  - lands as: the board in dima's tab
- **codie**
  - talks to clio on four events that push: blocked, a proposal or decision for dima, `[ask] lane-plan ready to greenlight`, done; `[progress]` slipstreams beside them
  - talks to its sixth sense freely
  - hears from clio, sixth sense, and dima when he drops in
  - lands as: a linear comment + the done ping
- **sixth sense**
  - talks to codie; to clio only on a dispute, a round-3 or not-checkable stop, or its exit line
  - hears from codie
  - lands as: codie carries `clean`; a dispute or a stop goes to clio
- **retros** — every member writes its retro beside its lane plan (path: `crew-dna` skill § the retro), never as a message;
  clio folds each when its lane ends, and the halt gathers what is left
- **designer**
  - talks to clio (one ping per spread) and to dima when he drops in
  - hears from clio (the brief) and dima
  - lands as: the canvas link, one line per take
- **cloud chat** — a peer: either side opens the exchange, the shared store carries the handoffs
- **fork** (of a member)
  - talks to dima in its own tab
  - its closing report lists «dima's asks here» and every external write
  - lands as: clio folds the report when dima archives the fork
- **cloud code**
  - hears from clio (the brief, then `SendMessage` steers)
  - cannot talk back yet
  - lands as: a pr, read by clio; its transcript through `--teleport` (`x:crew-cloud`)

## silence

a question dima has not answered means he is in another thread. the member does not wait on it:
a timed question goes to clio, and clio relays (the mechanics are in each brief). an ended turn
has no clock — a member watching for dima's answer arms its own timer.
