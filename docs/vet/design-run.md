# design run — the designer flow on trial

Ticket: [FRM-244](https://linear.app/x-com/issue/FRM-244)

the flow under test: `x:crew-designer-interview` → `brief.md` → `x:crew-designer` in `~/projects/studio` → 4 takes on
the Claude Design canvas → dima's pick → 2–3 variants → impeccable builds. evidence behind it:
`docs/research/design-process.md`. verdict line at the end: adopted, reshaped, or dropped.

## what the first run tests (atelier, blind)

- **the brief gate** — do ~10 pick-questions give a brief the designer acts on without asking back?
- **the canvas** — does the Design type fill from files in `jobs/<app>/takes/`, or only its own way?
- **a real spread** — are the 4 takes truly different, labelled by corner? any mash-up ask?
- **pick time** — minutes from the canvas link to dima's pick
- **rounds** — the pick reached in ≤3 iteration rounds?
- **the blinding** — does any of today's atelier look leak into a take?
- **cost** — tokens in/out, wall minutes, usage-window % per spread (the ledger below)
- **comp → build** — how much impeccable loses between the comp and the code (the finish review)
- **two A/Bs, after the pick**
  - axis frames vs `/adhd` frames
  - a picked brief vs a deliberately vague one

## after the first run: the drift research

planned, not yet a recipe vector — dima 2026-09-29: «let's test a designer … have first output — designed atelier, then
research, then decide to fold into recipe or not.»

the question: apps evolve and drift from their prototypes. keep the design alive and in sync, or treat comps as
throwaways? dima's asks, near-verbatim:

- how do other people solve it? does any modern llm-based dev flow work this way?
- the live mode he would pick with no quota limit: every coder + verifier spawn also gets a designer; an ask («add a
  button») goes to the designer first, dima approves the drawing, then the coder builds it
- his main concern is the token cost — without it, he would just adopt the live mode and test it in place
- the flow is llm development **with a human in it**: dima is often present and steers designs and apps
- a solid mock is expensive on his side too (he thinks through and picks an art direction each time), so he would not
  want to lose a polished prototype
- «thoroughly researched and verified, along with neuroarxiv»
- input from the first run: the ledger's cost per spread is the number the live mode multiplies

lanes when it runs: `pnpm research:lanes` (exa + parallel) + an opus source lane + neuroarxiv (`habit-research-lanes`).

## ledger — one line per spread

date · app · brief version · mode · takes · artboards · tokens in/out · wall minutes · usage window % before → after ·
pick minutes · rounds
