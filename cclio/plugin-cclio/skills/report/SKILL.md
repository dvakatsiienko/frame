---
description: load when dima says «sup», «where are we», «status», or asks for the session board — one compact status message.
---

# /cclio:report

loads on `/cclio:report`, or when dima asks «sup» / «where are we» / «what's next» / «report».

ONE message, this shape, nothing more:

📊 **run** `<run id>` — **elapsed** `<time>`

🟢 **done** — `N / ~M`
- **<area>** — value with `backticked` artifacts and https ticket links
  (2-4 biggest, one line each)

🚧 **in flight** — what runs right now
⏸️ **left** — next 2-3 concrete items, in order
🟩 **freebies** — `N` ready — the 1-2 juiciest, id + one-line what; «none open» if empty
❓ **on dima** — open calls; «nothing blocked» if none
🃏 one-liner mood

## jev
«how did jev do» → `pnpm jev:report`, pasted as is — one block per flow, then the session and health lines.

## freebie sweep — mandatory
any «sup / what's next / where are we» triggers a FRESH linear query for open issues carrying
the `freebie` label. GraphQL, never `issue view`, never from memory.
- `freebie` = pre-approved by dima. an agent may just do it and close it, no ask needed.
- offer to run the cheap ones now. strip the label from anything already done.

## strays sweep — the wide look, live every report
one fresh query, three hunts (this exact query RAN 2026-08-26):

```
linear api 'query { urgent: issues(filter: { state: { type: { nin: ["completed","canceled"] } }, priority: { lte: 2, neq: 0 }, updatedAt: { lt: "-P4D" } }, first: 15) { nodes { identifier title } } orphans: issues(filter: { state: { type: { nin: ["completed","canceled"] } }, projectMilestone: { null: true }, project: { null: false } }, first: 20) { nodes { identifier project { name } } } stale: issues(filter: { state: { type: { eq: "started" } }, updatedAt: { lt: "-P3D" }, labels: { every: { name: { neq: "standing" } } } }, first: 10) { nodes { identifier title } } }'
```

render as one block: `🔭 **strays**`, then one bullet each — `urgent N (>4d)`, `no-milestone N`,
`stale-in-progress N (>3d)`
— always print the day-thresholds so the numbers carry their meaning. expand only the urgent ones
(id + title + days-stray, linked), cap 3; the counts alone carry the other two hunts. orphans are
mostly healthy backlog — a count is a pulse, never a to-do list. stale-in-progress non-zero →
name the ids, they are lying state.

## strays steering — hunt → suggest → approve → flush

the strays are not just a number: cclio sees the whole picture through this query, so it also
**proposes**. dima's contract: everything below is suggestion-first — 🚫 no linear remixes
without his approval.

- **roadmap steer**: strays clustering around a theme → suggest shaping a milestone from them
  (or attaching them to a step), with a proposed priority
- **mild restructure**: a stray obviously misplaced → suggest the better project/parent;
  storify only where a real story emerges — mildly, only where something is obviously off
- **verdicts per stray**, offered not executed — one of: wrong place, poorly formatted, stale,
  close-on-sight (no relevance anymore), fine-where-it-is
- batch the suggestions, ONE approval round, then flush — the craft-pm one-flush rule holds
- **bold keys**, plain values, `backticks` for ids/files/commands
- every ticket id a link plus a short tldr, in the `rules/fleet-output-format.md` form, never bare
- counts come from real state (pocket statuses, linear, git), never guessed
- ≤16 lines. no history retelling.
