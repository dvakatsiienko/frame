---
kind: nurture
owner: coordinator
artifacts: [x:crew-dna, docs/test-drive/crew-comms.md]
script: none
groomed: 2026-11-23 (dima)
---

# nurture-crew-comms

keeps clio's inbox to what she must act on, and proves no needed line was lost: every message and machine wake of the week, graded by content. born 2026-11-23 from FRM-686.

## the want

dima, 2026-11-23, the goal:

> «the goal is to revisit how much useless messages you receive from team members, both: 1. push ones (more important, so less wakes) 2. slipstreams (too)»

> «change fleet messaging contract so you only receive what is needed to ship solid stuff, and reduce spam in your thread.»

> «empty-wakes only by count is half-useful, we need to eval actual content, what's inside. i believe we can cut a lot when content is considered and evaluated.»

- the test for one message, his: «would my wish, without them, still ship in a solid shape?»
- both halves count: «since you receive fewer messages, you will be parked a lot, so when someone truly wants to send you something, it should definitely reach you»
- the care stays, loosened: «you still must babysit everyone because it's your job, but not in as compulsive a way as i initially instructed … loosening the comms glue»
- the grade is the coordinator's: «your grading is more important than researcher, because you are a coord. so treat researcher input as suggestion, not truth. crow consult is required, not optional.»
- nothing changes without his word: at most 3 fixes a run, a text change on his tick, a mod change as a ticket line (his tick, grill 1)

## the run

- suggest a run when: the Monday boot (it replaces the bare `weekly-empty-wakes` count), or dima says the thread feels noisy
- the scope is every wake of clio's: members, crow, helga, her own background jobs and watches, stop hooks
- no outside research unless a run meets a problem we cannot solve ourselves
- a run opens with `clio:shape-recipe`'s step 0, the grill, like every recipe

1. extract (`script`): `python3 -I recipes/nurture-crew-comms/scripts/extract.py 7 recipes/nurture-crew-comms/last` writes every member message and machine notice of the week from clio's transcripts. done: its three counts printed (occurrences, deduped, notices)
2. the first grade (`template`): one `researcher` card grades every row by the six vectors, each row with its kind, how it arrived (push, mid-turn, held), what clio did next and a verdict: needed, useful, dead weight; it writes the rows and the small script that counts them. done: a `messages.tsv` and its count script in `last/`
3. clio's grade (`open`): clio reads every row that decides a change herself, at least the pushes graded useful, the dead rows and the needed rows that were held, and overrules the card where she disagrees; the card's grade is a suggestion. done: her counts written beside the card's
4. crow's consult (`template`): the proposed fixes go to crow in one message with the file's path; her answer is folded before the print. done: her answer quoted in the print
5. the print (`template`): to dima, each deciding number as one plain sentence against the last run, the top noise shapes, at most 3 fixes, each with what it removes and what could be lost. a run inside the green bar says «noop» and stops. done: printed
6. on his tick (`open`): a text fix lands in `x:crew-dna` § messages to clio; a mod fix becomes a line of an open mods ticket. done: named in the print's follow-up
7. log the run (`template`): one row in `docs/test-drive/crew-comms.md`, one line in `log.md`. done: both hold today's date

the green bar, moved only on his word: dead weight under 5 % of member messages, no needed line held, under 10 % of clio's wakes needless.

## vectors

### analysis

- dead weight: a message or a wake after which nothing would change had it never arrived
- lost or late: a needed line that was held, or that arrived after the moment it mattered
- clio's own machinery: background-job, watch and stop-hook wakes, by job; which re-fired on news she already had
- clio's briefs: lines of hers that asked for the noise
- the contract against itself: `x:crew-dna` § messages to clio, the stash mod's `MESSAGE_KINDS` and sender line, every skill and brief that names a tag
- health: a member that hung, stopped on a permission, looped or parked with no vote, and how long before clio saw it

## artifacts

- `x:crew-dna`: its § messages to clio is the contract's one home; the distill edits only that section, on his tick
- `docs/test-drive/crew-comms.md`: one row per run, so the trend reads week over week; never the findings

## findings

- every number names its count command; every verdict is marked a judgment
- the print's checklist: member messages (count, dead weight %), pushes that needed no turn, needed lines held, clio's own job wakes by kind, health events with their minutes to notice
