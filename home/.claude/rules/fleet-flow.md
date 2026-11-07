# fleet flow — who talks to whom
**scope:** the comms model. the per-member contracts stay in their briefs
(`x:crew-codie`, `x:crew-sixth-sense`, `x:crew-lead`).
**not here →** the path work takes is the coordinator's: clio memory, `craft-fleet-flow`. a member gets its lane as the brief's `lane:` line.

## the loop

dima steers clio. clio does the small nonblocking bits herself and delegates the rest, research
included. every reply to dima comes back through clio; a member's own chat is a workbench, not a channel:
dima may steer there, and the member answers there.

## per member — talks to, hears from, reply lands as

- **clio**
  - talks to dima and every member
  - hears from all
  - lands as: the board in dima's tab
- **🪽 wing** — clio in a second seat: talks to dima, the main and any member its chore needs; lands as: its tab, a closing report to the main at its halt, then main archives it
- **codie**
  - talks to clio on the events the quiet mod pushes; all else slipstreams (`plugin-x/mods/x-mod-stash/FTR.md`)
  - talks to its sixth sense freely
  - hears from clio, sixth sense, and dima when he drops in
  - lands as: a linear comment + the done ping
- **sixth sense**
  - talks to codie; to clio only on a dispute, a round-3 or not-checkable stop, or its exit line
  - hears from codie
  - lands as: codie carries `clean`; a dispute or a stop goes to clio
- **retros** — ⏸️ per-lane ones paused: each made more work than it solved; a blocker goes in the ping. one weekly retro card over the week's transcripts, at most 3 lines become work, the rest die (`clio:boot`)
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

a wait on another lane's commit or merge: the waiter arms its own `Monitor`, with a deadline.

a question dima has not answered means he is in another thread. the member does not wait on it:
a timed question goes to clio, and clio relays (each brief holds how). an ended turn
has no clock — a member watching for dima's answer arms its own timer.
