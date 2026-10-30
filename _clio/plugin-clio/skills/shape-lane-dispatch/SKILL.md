---
description: load on dima's «what can we dispatch?», «dispatch», «start a lane», his pick of signed chunks, a shift starting from signed chunks, or a signed chunk joining a running lane — the spec, the exit lines, the seal and the summon.
---

# /clio:shape-lane-dispatch — signed chunks become a running lane

the machine part of lane init, clio's alone: dima signed the chunks in `clio:shape-lane`, his pick starts them, and nothing below waits on him. the contract (the states, where each thing lives, a lane per milestone, shift safety) is `craft-fleet-flow` § lane init; a fix to how a lane starts lands here.

## 1 · the offer

«what can we dispatch?» → the signed chunks of both teams (`x linear list --team FRM --label signed` and `--team BYT`) with no open blocker, no `lane: main` (ours, never codie's) and no `human` or `needs human` label, grouped by milestone in the initiative's milestone-queue order, each with its sign age; a body hash off its last `## signed` line means an edit after the sign: offered with a re-sign instead; a lane walks its area's milestones one after another, each one's chunks in their `blocks` chain (codie's ticket order inside a chunk is its lane plan). his pick is the summon word: no second ask. a sixth sense comes by default; a quick lane's pick also says sixth sense yes or no. a quick lane needs no sign: he names the ticket, which promotes a Triage one (Todo); a quick chunk that edits the guards, the review workflows or merge-auto asks his merge pre-approval in the pick, the line a sign would carry.

## 2 · the spec

read matt's `to-spec` and follow it (`sys-skills`: a user-only skill is plain text):
- the spec sits in `.scratch/<feature>/spec.md`, one section per chunk, each section opening with its own `wish: <ticket>` line; every lane with a member gets one, a quick lane too
- the code is read against each chunk's `decided`: a signed decision the code has broken stops that chunk for a re-sign (`clio:shape-lane`); in a shift it parks with its reason in the spec and the next chunk runs
- `PRODUCT.md` is written here when the chunk makes or changes an app, a skill or a fleet tool — it opens with his words, so it stays mine
- every rider rides in the spec, named at dispatch or added as a steer; a rider found only in a commit is a sixth sense finding

## 3 · the exit lines

read [exit-lines.md](exit-lines.md), then write 3–6 given/when/then lines per chunk into the spec. the last line is the **want line**, seeded from the ticket's 🎯 done test: it replays dima's want or the incident behind the ticket, and sixth sense grades it apart from the rest. dima reads only the want line, printed and counted per the trial in `docs/test-drive/want-line.md`. a line that carries a decision he never made parks the chunk for a re-sign. a chunk that makes or changes an app carries a line for its FTR lines and glossary words. a ticket whose script clio's hooks call carries a line naming who wires it.

then the **blind critic**, on every lane (`docs/research/exit-lines-delegation.md`: 17 of 20 flagged lines passed the lint and missed the want): write the want plus the lines to a file and run `pnpm -C ~/frame crow:plan-critique <file>`; each finding is folded or answered in one line before the seal.

## 4 · the seal

`x brief preflight` passes; it reads the exit lines from the spec (FRM-423). a flag on a verb that exists is proven by one grep and said so beside the line. the target's own AGENTS.md rules and its `FTR.md` decisions are read against the lines: a line they forbid is rewritten. a board or band change carries a shot of the board with every card open and the redraw cost measured. the chunk is now 🦭 sealed; the print collapses it to one row: `🦭 **sealed**, N exit lines`.

## 5 · the summon and the greenlight

- the summon is `x:crew-lead`'s (load it): the brief's first step has codie run `to-tickets` on the spec after reading the code, so the slices follow real seams; the brief says «skip the quiz step of to-tickets», since the sign settled the want; the slices go into `~/.local/state/x/lanes/<feature>/issues/`, never linear or the worktree
- **the marks**, right after the summon: `x lane dispatch <ids…> --session <codie sid> --lane <feature>`, then the same with `--apply` (the `signed` label off, In Progress, the codie delegate, `🚀 dispatched <YYYY-MM-DD>`); his sign was its promotion out of Triage
- a cancelled signed chunk, before or after dispatch: the `signed` label off, Canceled through `clio:pm`'s `references/closing.md`, and `🚫 cancelled <YYYY-MM-DD> — <why>` in its block; after 🚀: stop its members (`x:crew-lead` watching), close its pr and decamp, drop its spec section, end its glide step
- **the lane plan**, `~/.local/state/x/lanes/<feature>/lane-plan.md` (outside every checkout, so an isolated codie can write it and a decamp keeps it): codie's side (the draft, the ticks, `## not greenlit`) is `x:crew-codie`'s `how-you-work.md` § the lane plan; mine: at its `[ask] lane-plan ready to greenlight` i reorder it against what comes after and 🟢 greenlight it — my word is final — and greenlight again on my next read after a `[progress]` ping; a step may group tickets (`01–02`). the glide card copies its ticket lines at each greenlight and land (by hand, until FRM-410). a lane of one ticket skips the file

## 6 · while it runs

- **a joiner**: a signed chunk from a milestone the lane walks joins a running lane as a new spec section and a new glide step, gets § 5's marks in the turn of the steer (its sixth sense a `next:` message, `x:crew-sixth-sense` § the next chunk), and codie hears it as a steer naming that section plus a `## not greenlit` line, then re-runs `to-tickets` on it; an unsigned one waits for its sign
- **a wish of dima's mid-lane** goes into the ticket's wish block as W-lines, with a proposed re-sign of its chunk, and the spec cites them; never a bare message; every steer to a lane's codie also lands in its lane plan's `## not greenlit` that turn (`x:crew-lead` briefing); one changing the how, the spec too; a one-chunk lane has no lane plan: its steer goes into the spec section
- **a ↩️ back-to-Todo ticket** returns by a re-sign naming its left asks, which puts `signed` back so the offer carries it
- **a re-sign after 🚀** never puts the `signed` label back (the chunk is running), unless a ↩️ follows the 🚀 (the line above): it re-runs § 3–4 for that chunk (the spec section and its preflight copy) and steers codie to the changed lines
- **a park** — his weekly window out, the 5h pace, his pause, a decision only he can make — writes its reason into the spec; a shift then takes the next signed chunk, and a merge his sign pre-approved never stops it; the next siesta back on pace resumes a pace park

**done** = each picked chunk, a joiner included, has its spec section with sealed exit lines, its `🚀 dispatched` line, a summoned codie (a sixth sense unless his pick said no), and a greenlit lane plan.
