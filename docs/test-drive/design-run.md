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

→ researched 2026-09-29 (four lanes): `docs/research/design-drift.md` — the structured layer lives, comps retire as
dated references; live mode costs 75–225 % of a 5-hour window a week, selective ~7–22 %.

## ledger — one line per spread

date · app · brief version · mode · takes · artboards · tokens in/out · wall minutes · usage window % before → after ·
pick minutes · rounds

- 2026-09-29 · atelier · brief v1 · full, blind · 4 takes · 5 artboards (4 takes + 1 shared art piece) · ~68k out (session footer; in not read) · 10.7 wall min · 5h 18 → 21 %, 7d 30 → 30 % · pick min pending · round 1
- 2026-09-29 · atelier · brief v1 · full, blind · pick variants of glass-experimental · 3 artboards · out tokens from the session footer (not visible in-session) · 3.1 wall min · 5h 22 → 26 %, 7d 30 → 31 % · round 2
- 2026-09-29 · atelier · brief v1 · A/B adhd — frames from /adhd:adhd instead of the axis corners · 4 takes (remove-the-assumption, inversion, speedrunner, logistics) · 5 artboards (4 takes + 1 shared art piece) · 49.7k out, 138k cache write (session transcript) + 5 sonnet diverge branches ≈ 291k subagent tokens · 8 wall min · 5h 23 → 32 %, 7d 30 → 31 % · pick min pending · round 1
- 2026-09-29 · atelier · brief-vague (A/B vague) · full, blind · 4 takes · 5 artboards (4 takes + 1 shared art piece) · ~59.6k out (session transcript usage), in 137k cache-write + 2.5M cache-read · 9 wall min · 5h 23 → 33 %, 7d 30 → 31 % (window shared with parallel sessions) · pick min pending · round 1

## verdict — 2026-09-29: adopted (dima: «looks very good, and as a first take, almost works for me»)

- dima's comparison, a tired first look: **the gated brief got closer** (v1 best); **the vague brief gave the more different ideas**; glass over swiss

- **the flow works end to end**: interview → brief → 4 blind takes on the canvas in ~11 min → dima's pick → 3 state
  variants in ~3 min. the blinding held (no session read the app's repo or named its old art).
- **cost per spread: ~50–70k output tokens, 8–11 wall minutes** (v1 ~68k, vague ~60k, adhd ~50k + ~291k in five sonnet
  branches). the window % per spread is unreliable tonight — three spreads and four research lanes shared one window
  (18 → 33 % over the evening).
- **open, needs dima's eye**: gated brief vs vague (on-target?), axis corners vs adhd frames (more different? worth the
  extra subagent tokens?). then: adopt, reshape or drop.
- fixed on the way: the interview's question shape (x 0.11.165), the designer's ping + footer tokens (x 0.11.166), the
  12 px key floor.
