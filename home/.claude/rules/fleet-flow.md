# fleet flow — who talks to whom
**scope:** the comms model between fleet members. the per-member contracts stay in their briefs
(`x:crew-coder`, `x:crew-verifier`, `craft-spawning`); this file is the map they hang on.
**not here →** the path work takes (ten stages, five lanes, the done test) is the coordinator's: cclio memory, `craft-fleet-flow`. a member gets its lane as the brief's `lane:` line.

## the loop

dima steers cclio. cclio does the small nonblocking bits herself and delegates the rest, research
included. every reply to dima comes back through cclio; a member's own chat is a workbench, not a
channel — dima may step into it and steer there, and the member answers him there.

## per member — talks to, hears from, reply lands as

- **cclio**
  - talks to dima and every member
  - hears from all
  - lands as: the board in dima's tab
- **coder**
  - talks to cclio on three events only: blocked, a proposal or decision for dima, done
  - talks to its verifier freely
  - hears from cclio, the verifier, and dima when he drops in
  - lands as: a linear comment + the done ping
- **verifier**
  - talks to the coder; to cclio only on a dispute, a round-3 stop, or its exit line
  - hears from the coder
  - lands as: the coder carries `clean`; a dispute or a stop goes to cclio
- **retros** — every member writes its retro to `~/.claude/shelf/retros/`, never as a message;
  cclio folds them at the halt
- **designer**
  - talks to cclio (one ping per spread) and to dima when he drops in
  - hears from cclio (the brief) and dima
  - lands as: the canvas link, one line per take
- **cw** — a peer: either side opens the exchange, the shared store carries the handoffs
- **cc cloud**
  - hears from cclio (the brief, then `SendMessage` steers)
  - cannot talk back yet
  - lands as: a pr, read by cclio; its transcript through `--teleport` (`x:crew-cloud`)

## silence

a question dima has not answered means he is in another thread. the member does not wait on it:
a timed question goes to cclio, and cclio relays (the mechanics are in each brief). an ended turn
has no clock — a member watching for dima's answer arms its own timer.
