# fleet flow — who talks to whom
**scope:** the comms model between fleet members. the per-member contracts stay in their briefs
(`x:crew-coder`, `x:crew-verifier`, `craft-spawning`); this file is the map they hang on.

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
  - talks to cclio (one ping per assignment) and to its verifier
  - hears from cclio, the verifier, and dima when he drops in
  - lands as: a linear comment + the ping
- **verifier**
  - talks to the coder, one round line per round to cclio
  - hears from the coder
  - lands as: a dispute or a round-3 stop goes to cclio
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
