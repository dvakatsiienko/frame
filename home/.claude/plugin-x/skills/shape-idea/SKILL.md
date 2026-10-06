---
name: shape-idea
description: Load BEFORE anything new gets built or redesigned — «i want to build», «new app», «an idea», «should we build», «shape it», «shape-idea», «redesign», «re-shape», a feature bigger than a tweak — and before a designer brief is written. typed as `/x:shape-idea <idea or app>`.
argument-hint: "<the idea, or an existing app to re-shape>"
---

# shape-idea — nothing is built before it is shaped

the phase between dima's idea and the first design or line of code. it makes sure we build the right
thing, sharp, before any of it exists — tech debt born at the idea stage is the most expensive kind.
an existing app runs it too (a **re-shape**) when it grew from a random ask and was never shaped.

dima owns the want and every verdict; you run the steps, one at a time, and stop after each for his
word. skipping a step happens only on his word, named out loud.

## the steps

1. **the want** — his idea in his words, quoted, into `PRODUCT.md`'s opening. done when he agrees the
   quote says what he means.
2. **grill** — `mattpocock-skills:grilling` + `mattpocock-skills:domain-modeling` together (what
   matt's user-only `grill-with-docs` does), so every term the grill settles lands in `GLOSSARY.md`
   and every hard decision in an ADR as it happens; one question at a time, until the open decisions are
   settled or parked by name. always; skipped only on his word. a re-shape grills what exists: why,
   for whom, what is missing, what should go.
3. **prior art** — does it exist already, and can we use it instead of building?
   `advise-project-approach` for a plan or a stack; the research lanes (`habit-research-lanes`) for
   the market. then the lib search: per part of the build (a waveform, a hotkey, a pan/zoom surface),
   the solid, maintained libraries that already solve it — dima thinks in frontend, so the under-the-hood
   parts are the ones to hunt (2026-10-02). done when the build-or-reuse call and the lib per part are
   written with their reasons.
4. **sharpen** — `neuroarxiv` when the question is an architecture or a method; `adhd` for a name
   or a fork with no clear answer. only where one applies; say which ran and what it changed.
   then, on every shape, a plan critic: write the plan to a file and run `pnpm -C ~/frame ccrow:plan
   <file>` — a fresh one-shot on ccrow's day arm, blind to the thread; its verdict and ≤5 located
   findings go to dima beside the grill (on trial with ccrow to 10-20, FRM-336).
5. **the cut** — the smallest version worth using, and a written «out» list of what it is not.
   it names the **polish tier**: an internal tool stops at «works and clear»; a showcase app
   (the portfolio, speak, sys) gets the designer's polish phase — the last 10 % is where the
   look comes from, and a reviewer who sees a generic look clicks away.
6. **the done test** — how we will know it works, as given/when/then lines.
7. **the outputs** — `PRODUCT.md` (why, who, the cut), an `FTR.md` draft from the done test (`x:ftr`),
   `GLOSSARY.md` words (`domain-modeling`). a new app scaffolds through `x:app-essentials`. a
   re-shape of an existing app runs `domain-modeling` over its current code too, so the redesign
   starts from the real terms (dima, 2026-10-06: every app goes through it, on its next touch).

**completion criterion:** the three outputs exist in the app, dima said «shaped», and only then does
design start (`x:crew-designer-interview`) or code (`x:crew-coder`). a design brief is written from
these outputs, never from the original ask.
