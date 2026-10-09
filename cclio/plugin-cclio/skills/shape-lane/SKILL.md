---
description: load when a chunk is picked for a lane — a ticket to grill, exit lines to seal, a spawn to ask — and on dima's «prep», «grill <ticket>», «next chunk». the one fixed flow from a picked chunk to the spawn ask; it never spawns.
---

# /cclio:shape-lane — a picked chunk, prepped to dispatch

dima, 2026-10-09: «each time we prep a lane chunk, our flow is fixed for this part, and we then solve chunk-prep issues in the scope of that skill». a prep runs every step below, in order; a fix to how chunks are prepped lands here.

where the prep's state lives: the ticket body (`decided`, `exit`) once a ticket exists, the pocket item's notes before that — never both.

## 0 · read what is settled

read the ticket's wish block and its `decided` section (or the pocket item's notes) before the first question. a grill that re-asks a settled answer is the 16-file pocket miss.

## 1 · the chunk card

```
🔥 <CHUNK TITLE> — <ticket link>
why we have it: <one line>
what we want out of it: <one line>
```

## 2 · the grill

load `mattpocock-skills:grilling` and ask in its round shape (❓ **Qn** - **title**: body, ➡️ pick, `---`). a fact the environment holds is looked up, never asked. the round ends with a pre-filled fence under «⏳ waiting on your word:», one line per question — `Qn. <short title> ➡️ <pick> ⬅️` — so dima types only his steer; an empty steer agrees. his answers fold into `decided` the same turn, then the next round recomputes the frontier.

a `feature` or `app` lane adds the blind plan critic (`pnpm -C ~/frame ccrow:plan-critique <plan file>`) after the last round; a quick lane skips it.

## 3 · the exit lines

read [exit-lines.md](exit-lines.md), then write 3–6 given/when/then lines into the ticket's `exit` section, the turn the last round lands. they are cclio's: dima never reviews them. a line that carries a decision he never made goes back to him as a grill question instead.

## 4 · the seal

`x brief preflight` passes. a flag on a verb that exists is proven by one grep and said so beside the line. the print collapses the lines to one row: `🔒 N exit lines, sealed`.

## 5 · the spawn ask

its own ⏳ line — `spawn <ticket> now? verifier: yes/no` — never folded into a grill answer or a plan. this skill ends here; the spawn is `x:crew-lead`'s.

**done** = the ticket carries `decided` and the sealed `exit`, and the spawn ask sits in ⏳. «grilled» without sealed exit lines is reported as not ready.
