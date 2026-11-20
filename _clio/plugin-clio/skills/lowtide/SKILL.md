---
name: lowtide
description: lowtide, the hunt — load when dima says «lowtide», «low tide», «solve chores», «tails», «chores and tails», «piled up stuff» — this clio lane solves its seeded chores, main or any wing, batches first, before the next big step.
---

# 🦪 lowtide — the chores cleared before a big step

lowtide is the family that hunts and fixes gaps and inefficiencies in our plans (PK-387:W18–W22): `lowtide` the hunt, `lowtide-triage` the flyway prep, `lowtide-peek-lanes` the chunk plan, `lowtide-cuts` what stays, `lowtide-flyway-sync` a flyway matched to the live state; their shared shapes: [shapes.md](references/shapes.md).

dima, 2026-10-20, folded: «before we move to something bigger, like the speak v2 revival, close every chore that would otherwise stay parked forever if i didn't ask — small, medium or big. i often find myself explaining this to you: during the memory sweep the pocket grew while we kept folding other useful stuff.»

## the start

read the flyways' notes for today's `hoist MM-DD` line:
- none → `clio:lowtide-triage` runs first; offer it in one line
- `proposing` → wait for dima's yes on that split
- `done` → work your own flyway in its order
- a wing opened after the hoist, its flyway empty → take only items no plan holds, your label on at the pick
- mark the queue run: `mkdir -p ~/.local/state/clio/queue-run && touch ~/.local/state/clio/queue-run/$CLAUDE_CODE_SESSION_ID` — reply-check then holds every reply to the next-item shape for 12 h

## each pick

- **before it**, reread every flyway: an id already in another flyway stops the pick, named to dima
- **a batch** (dima, 2026-11-07, folded: «it is good to batch them. one at a time is more for stuff that is quite bigger and wants my decision»): items passing the freebie test (`craft-pm`) run together with no ask, reported after as `PK-N → what happened`; an almost-freebie is one helper card
- **one at a time**: an unsure item, and anything irreversible or visible outside. print what it is, why it is parked, how to solve it, then wait for his steer or go
- **big stuff** goes last and is proposed for its own shaping, never started in this run, unless he asks to prioritize it
- **every done report ends with the next item**, never a bare «done» (dima, 2026-11-20 15:41: «each time that you solve stuff and print me a done report, in the same reply I want you to propose the next item right away, along with a description of what that next item to solve is and your proposal for how to solve it»): two next items from the tails queue only (my chores and tails; a lane's work, a siesta or a lane look is a parallel topic, never a next item here; the run ends at 0 tails, 0 chores: his 15:59), so his «ok» on the first still shows the second (his 15:54); the first's pick also an orbit ask. three paragraphs, an empty line between, no bullets (his 16:05, «currently reads as a wall of text»; 16:08 «my take is not on new line»; 16:11): `✅ **done:** …`, then each item one paragraph, `🧩 **next item:**` what it is in plain words, a hard break (a trailing `\`), `💡 **my take:**` the action I'd run
- **then**: fully solved, its item closed (a close carrying his asks takes the ask-guard, `craft-pm`), its flyway line moved into the done note (`node script/flyway-done.ts <PK> <fN>`), synced with main (a wing lands per its banner)

## a handover

an item moves between flyways on his want, or when another lane fits it better: the line out of one flyway, into the other, its label swapped, the other clio told in one `SendMessage`.

## how it runs

- a siesta at its usual triggers (`clio:siesta`), never one giant turn
- an item that turns out blocked or lane-bound gets its `**waiting for:**` line or lane note the same turn, and leaves the hunt
- the next big step starts only when this lane has nothing left, and after its cut pass: `clio:lowtide-cuts` weighs the step's planned tickets, its print goes to dima, his ticks land before the first chunk is signed

**done**: reread the whole pile, not only your flyway. an unclaimed item or a parked wing's unticked line is taken or named. then a «nothing left» line naming every store searched (pocket, linear FRM, linear BYT, inbox), with the counts before and after.
