# lowtide shapes — what every lowtide skill reads and prints

one home for the shared parts (PK-387:W23, W25): every lowtide skill points here, none points at another.

## the filter

- off: `someday`-labelled tickets
- scoped tickets belong to their lane: a lane's (the cli project, the mods and herdr milestones) or an app's (its project), read from linear; triage leaves them out, a lane checkup reads only them
- «signed» is the body's `## signed` lines, never the label
- the report opens with its filter line: kept, dropped, stores searched

## the lane header

one line, `**<mode emoji> <area>** — <coordinator>, with <member registry names, bold>`, then a blank line, never one bullet per part; the mode emoji is the lane's (`fleet-vibe` § lane), the members from `node ~/frame/_clio/script/clio-lanes-radar.ts`

## the chunk line

`N. [FRM-N](https://linear.app/x-com/issue/FRM-N) **S** — <what it does>`

- the size bold: XS, S or M; an unsized ticket prints `?`
- what it does: one sentence of 10–25 words in his words, clear about what is under the hood; never the ticket title pasted
- the running chunk: 🛼 leads its line, its subject bold, and one nested line: `left: <what>, ~N min (estimate)`; the estimate is steps left × today's minutes per finished step, read from the lane plan's ticks; no tick today → «not estimated»
- a step with no ticket (a rename step) prints its name in the link's place
- a blank line between lanes

## the done line — printed only on his ask

`N. [FRM-N](https://linear.app/x-com/issue/FRM-N) — <an interesting detail: what it bought us>`
