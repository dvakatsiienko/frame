---
description: load when a chunk is picked for a lane — a ticket to grill, exit lines to seal, a spawn to ask — and on dima's «prep», «grill <ticket>», «next chunk». the one fixed flow from a picked chunk to the spawn ask; it never spawns.
---

# /cclio:shape-lane — a picked chunk, prepped to dispatch

dima, 2026-10-09: «each time we prep a lane chunk, our flow is fixed for this part, and we then solve chunk-prep issues in the scope of that skill». a prep runs every step below, in order; a fix to how chunks are prepped lands here.

where the prep's state lives: the ticket body (`decided`, `exit`) once a ticket exists, the pocket item's notes before that — never both.

## 0 · read what is settled

read the ticket's wish block and its `decided` section (or the pocket item's notes) before the first question. a grill that re-asks a settled answer is the 16-file pocket miss.

then the open children of the app's `🌠 <app> wishes` parent ticket: one that rides along — a trial, a test drive, a «carry into the next touch» — joins the brief or is named in the grill. a small UI ask on an app the design flow covers (atelier, speak) goes to a coder with its `DESIGN.md` and a live screenshot, no designer, and leaves one rounds line in `docs/test-drive/design-drift.md` (dima's standing trial).
<!-- 10-14: two ⏰📌 reminders (BYT-127 lottie/rive, the design-drift coder trial) sat stuck only because a ticket never fires at brief time · dima: «why keep stuck?» · this read replaced them -->


## 1 · the chunk card

a card is an h2 heading and two plain lines (dima, 2026-10-09, after a fence, a `·` and a blockquote of bullets each broke it, and an h4 read too small): no fence (a fence means «copy me»), no blockquote, no bullets, no `·`. the shape, as raw markdown:

    ## 🔥 <chunk title> — <ticket link>

    **why we have it** — <one line>

    **what we want out of it** — <one line>

## 2 · the grill

load `mattpocock-skills:grilling` for the method; the round prints in the grill shape of `habit-dima-comms-pacing` (🔥 header, numbered bold questions, a) b) with consequences, ➡️ pick). a fact the environment holds is looked up, never asked. the round prints whole in the reply, where dima reads it (dima, 2026-10-10: «grills print as usual in a response, orbit only sends my reply»); each question also goes to orbit as one answer row — `Qn <short title>` with the pick — so he ticks to agree and notes to steer; an unmarked question stays open. orbit is the only answer door: no pre-filled answer fence in the reply (dima, 2026-10-11; reply-check blocks one). his answers fold into `decided` the same turn, then the next round recomputes the frontier.

## 2.5 · the spec — feature and app lanes, and any coder job of 3+ items

a coder job carrying three or more asks — a lane, or a pile of today's drops and finds — goes through a spec, never a run of messages: the spec holds every item with its exit line, so nothing is lost to a refresh and «done» is checkable (dima, 2026-10-12, o140: «via specs, nothing is lost and is structured»). a one-line fix stays a message. x-mod-guard warns on a 3+-item coder message that names no spec path (o143).


the grill's `open` section is empty → read matt's `to-spec` and follow it (`sys-skills`: a user-only skill is plain text): the spec in `.scratch/<feature>/spec.md` carries `wish: <ticket>`. **the coder writes the tickets**: its brief's first step runs `to-tickets` on the spec after reading the code, so the slices follow real seams — its step 4 «quiz the user» is skipped and the brief says so: the grill already settled the want, the coder writes the slices into `.scratch/<feature>/issues/`, never linear, and builds (2026-10-11, a coder parked on four orbit asks after reading it); the spec and the sealed exit lines bind, the tickets are its own route (dima, 2026-10-10: cclio-written tickets anchor the coder to guessed seams). the exit lines below are sealed from the spec. a quick lane and a freebie skip it, said in one line (dima, 2026-10-10, after the stage was named nowhere and every lane skipped it).

## 3 · the exit lines

read [exit-lines.md](exit-lines.md), then write 3–6 given/when/then lines into the ticket's `exit` section, the turn the last round lands. the last line is the **want line**: it replays dima's want or the incident behind the ticket, and the verifier grades it apart from the rest. the lines are cclio's; dima reads only the want line (a test drive from 2026-10-10, `docs/test-drive/want-line.md`): it is printed to him as `want line n/5, useful?` (a `·` there gets split into bullets by the stash's list rewrite) with the count from that file, his answer is logged there, and at 5/5 the reply asks his verdict — keep it, or delegate the want line fully too. a line that carries a decision he never made goes back to him as a grill question instead. a ticket whose script cclio's hooks call carries an exit line naming who wires it.

then the **blind critic**, on every lane, quick ones too (`docs/research/exit-lines-delegation.md`: 17 of 20 flagged lines passed the lint and missed the want): write the want plus the lines to a file and run `pnpm -C ~/frame ccrow:plan-critique <file>` — a fresh one-shot that sees only that file. each finding is folded or answered in one line before the seal.

## 4 · the seal

`x brief preflight` passes. a flag on a verb that exists is proven by one grep and said so beside the line. the target's own AGENTS.md rules are read against the exit lines: a line its rules forbid is rewritten before the seal (FRM-398's «refused» exit met mods' «warn-only until a verifier's clean»). a board or band change carries a shot of the board with every card open and the redraw cost measured, before the brief (FRM-397). the print collapses the lines to one row: `🔒 N exit lines, sealed`.

## 5 · the spawn ask

its own orbit ask — `spawn <ticket> now? verifier: yes/no` — never folded into a grill answer or a plan. this skill ends here; the spawn is `x:crew-lead`'s.

**done** = the ticket carries `decided` and the sealed `exit`, and the spawn ask sits in orbit. «grilled» without sealed exit lines is reported as not ready.
