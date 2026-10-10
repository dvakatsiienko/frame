---
description: load when a chunk is picked for a lane — a ticket to grill, exit lines to seal, a spawn to ask — and on dima's «prep», «grill <ticket>», «next chunk». the one fixed flow from a picked chunk to the spawn ask; it never spawns.
---

# /cclio:shape-lane — a picked chunk, prepped to dispatch

dima, 2026-10-09: «each time we prep a lane chunk, our flow is fixed for this part, and we then solve chunk-prep issues in the scope of that skill». a prep runs every step below, in order; a fix to how chunks are prepped lands here.

where the prep's state lives: the ticket body (`decided`, `exit`) once a ticket exists, the pocket item's notes before that — never both.

## 0 · read what is settled

read the ticket's wish block and its `decided` section (or the pocket item's notes) before the first question. a grill that re-asks a settled answer is the 16-file pocket miss.

## 1 · the chunk card

a card is an h2 heading and two plain lines (dima, 2026-10-09, after a fence, a `·` and a blockquote of bullets each broke it, and an h4 read too small): no fence (a fence means «copy me»), no blockquote, no bullets, no `·`. the shape, as raw markdown:

    ## 🔥 <chunk title> — <ticket link>

    **why we have it** — <one line>

    **what we want out of it** — <one line>

## 2 · the grill

load `mattpocock-skills:grilling` and ask in its round shape (❓ **Qn** - **title**: body, ➡️ pick, `---`). a fact the environment holds is looked up, never asked. the round ends with a pre-filled fence under «⏳ waiting on your word:», one line per question — `Qn. <short title> ➡️ <pick> ⬅️` — so dima types only his steer; an empty steer agrees. his answers fold into `decided` the same turn, then the next round recomputes the frontier.

## 2.5 · the spec — feature and app lanes only

the grill's `open` section is empty → read matt's `to-spec`, then `to-tickets`, and follow them (`sys-skills`: a user-only skill is plain text): the spec in `.scratch/<feature>/spec.md` carries `wish: <ticket>`, the tickets land as Backlog.md tasks per `docs/agents/issue-tracker.md`. the exit lines below are sealed from the spec. a quick lane and a freebie skip it, said in one line (dima, 2026-10-10, after the stage was named nowhere and every lane skipped it).

## 3 · the exit lines

read [exit-lines.md](exit-lines.md), then write 3–6 given/when/then lines into the ticket's `exit` section, the turn the last round lands. the last line is the **want line**: it replays dima's want or the incident behind the ticket, and the verifier grades it apart from the rest. the lines are cclio's; dima reads only the want line (a test drive from 2026-10-10, `docs/test-drive/want-line.md`): it is printed to him as `want line n/5 · useful?` with the count from that file, his answer is logged there, and at 5/5 the reply asks his verdict — keep it, or delegate the want line fully too. a line that carries a decision he never made goes back to him as a grill question instead.

then the **blind critic**, on every lane, quick ones too (`docs/research/exit-lines-delegation.md`: 17 of 20 flagged lines passed the lint and missed the want): write the want plus the lines to a file and run `pnpm -C ~/frame ccrow:plan-critique <file>` — a fresh one-shot that sees only that file. each finding is folded or answered in one line before the seal.

## 4 · the seal

`x brief preflight` passes. a flag on a verb that exists is proven by one grep and said so beside the line. the print collapses the lines to one row: `🔒 N exit lines, sealed`.

## 5 · the spawn ask

its own ⏳ line — `spawn <ticket> now? verifier: yes/no` — never folded into a grill answer or a plan. this skill ends here; the spawn is `x:crew-lead`'s.

**done** = the ticket carries `decided` and the sealed `exit`, and the spawn ask sits in ⏳. «grilled» without sealed exit lines is reported as not ready.
