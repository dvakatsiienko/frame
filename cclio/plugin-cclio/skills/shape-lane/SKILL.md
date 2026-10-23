---
description: load on dima's «prep», «grill <ticket>», «next chunk», or when a chunk is picked for a lane — a ticket to grill, exit lines to seal, a spawn to ask.
---

# /cclio:shape-lane — a picked chunk, prepped to dispatch

dima, 2026-10-09: «each time we prep a lane chunk, our flow is fixed for this part, and we then solve chunk-prep issues in the scope of that skill». a prep runs every step below, in order; a fix to how chunks are prepped lands here.

where the prep's state lives: the ticket body (`decided`, `exit`) once a ticket exists, the pocket item's notes before that — never both.

## 0 · read what is settled

read the ticket's wish block and its `decided` section (or the pocket item's notes) before the first question. every question cites the W-lines it settles; `node script/wish-cover.ts <PK-N> <round>` exits 0 before the round prints.

then the open children of the app's `🌠 <app> wishes` parent ticket: one that rides along — a trial, a test drive, a «carry into the next touch» — joins the brief or is named in the grill. a small UI ask goes the `craft-fleet-flow` freebie way (dima, 2026-10-11: «keep this trial reminding me to run a coder on applicable apps»).

## 1 · the chunk card

a card is an h2 heading and two plain lines: no fence (a fence means «copy me»), no blockquote, no bullets, no `·`. the shape, as raw markdown:

    ## 🔥 <chunk title> — <ticket link>

    **why we have it** — <one line>

    **what we want out of it** — <one line>

## 2 · the grill

load `mattpocock-skills:grilling` and run its ❓ round as written — the frontier only, no shape of our own (`habit-dima-comms` § grill) — whole in the reply and as orbit asks (dima, 2026-10-10: «grills print as usual in a response, orbit only sends my reply»). orbit is the only answer door: no pre-filled answer fence in the reply (reply-check blocks one). his answers fold into `decided` the same turn.

## 2.5 · the spec — side lanes, and any coder job of 3+ items

a coder job carrying three or more asks — a lane, or a pile of today's drops and finds — goes through a spec, never a run of messages: the spec holds every item with its exit line, so nothing is lost to a refresh and «done» is checkable (dima, 2026-10-12, o140: «via specs, nothing is lost and is structured»). a one-line fix stays a message.

the grill's `open` section is empty → read matt's `to-spec` and follow it (`sys-skills`: a user-only skill is plain text):
- the spec sits in `.scratch/<feature>/spec.md` and carries `wish: <ticket>`
- **the coder writes the tickets**: its brief's first step runs `to-tickets` on the spec after reading the code, so the slices follow real seams (cclio-written tickets anchor the coder to guessed seams); the brief skips `to-tickets` step 4 «quiz the user», since the grill already settled the want, and the slices go into `.scratch/<feature>/issues/`, never linear
- **the lane's order lives in one file, `~/.local/state/x/lanes/<feature>/lane-plan.md`**, outside every checkout, so an isolated coder can write it and a decamp keeps it (dima, 10-22, PK-103; the path o15 10-23, probe-proven): the coder's side (the draft, the ticks, `## unsealed`) is `x:crew-coder`'s `how-you-work.md` § the lane plan; mine: at its `[ask] lane-plan ready to seal` i reorder it against what comes after and seal it — my word is final — and re-seal on my next read after a `[progress]` ping; a step may group tickets (`01–02`). the glide card copies its ticket lines at each seal and land (by hand, until FRM-410). a lane of one ticket skips the file
- the spec and the sealed exit lines bind, the tickets are the coder's own route; the exit lines below are sealed from the spec
- a quick lane and a freebie skip it, said in one line

## 3 · the exit lines

read [exit-lines.md](exit-lines.md), then write 3–6 given/when/then lines into the ticket's `exit` section, the turn the last round lands. the last line is the **want line**: it replays dima's want or the incident behind the ticket, and the verifier grades it apart from the rest. the lines are cclio's; dima reads only the want line, printed and counted per the trial in `docs/test-drive/want-line.md`. a line that carries a decision he never made goes back to him as a grill question instead. a ticket whose script cclio's hooks call carries an exit line naming who wires it.

then the **blind critic**, on every lane, quick ones too (`docs/research/exit-lines-delegation.md`: 17 of 20 flagged lines passed the lint and missed the want): write the want plus the lines to a file and run `pnpm -C ~/frame ccrow:plan-critique <file>` — a fresh one-shot that sees only that file. each finding is folded or answered in one line before the seal.

## 4 · the seal

`x brief preflight` passes. a flag on a verb that exists is proven by one grep and said so beside the line. the target's own AGENTS.md rules are read against the exit lines: a line its rules forbid is rewritten before the seal. a board or band change carries a shot of the board with every card open and the redraw cost measured, before the brief. the print collapses the lines to one row: `🔒 N exit lines, sealed`.

## 5 · the spawn ask

the spawn ask, its own orbit ask in the shape `x:crew-lead` § the spawn ask holds, never folded into a grill answer or a plan. this skill ends here; the spawn is `x:crew-lead`'s.

**done** = the ticket carries `decided` and the sealed `exit`, and the spawn ask sits in orbit. «grilled» without sealed exit lines is reported as not ready.
