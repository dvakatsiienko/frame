---
name: shape-idea
description: Load BEFORE a new app, a new feature or a change to how a product part works gets built — «i want to build», «new app», «new feature», «an idea», «should we build», «shape it», «shape-idea», «redesign», «re-shape» — when dima picks shape-idea for a wish, and before a designer brief is written. typed as `/clio:shape-idea <idea or app>`.
argument-hint: "<the idea, or an existing app to re-shape>"
---

# shape-idea — a solid ticket out of dima's wish

the phase between dima's raw wish and a ticket worth signing. it makes sure we build the right thing,
sharp, before any of it exists — tech debt born at the idea stage is the most expensive kind. it fits
non-mechanical work, better shaped granularly than solved straight: a new app, a new feature, a change
to how an existing product part works (atelier drawing collages beside dioramas: yes; a dark/light
theme: a plain ticket). the wish fold proposes «shape-idea or not» per wish, his pick decides
(rule: `craft-pm` § wishes). an existing app runs it too (a **re-shape**) when it grew from a random ask and was never shaped.
the contract around it — the sign, dispatch, where every artifact lives — is `craft-fleet-flow` § lane init.

dima owns the want and every verdict; you run the steps, one at a time, and stop after each for his
word. skipping a step happens only on his word, named out loud.

## the steps

1. **the want + the grill, one turn** (dima, 2026-10-21: the want alone was a turn too small) — the reply opens with his idea in his words, folded (`craft-pm` § wishes), bound for the ticket's wish block, and the grill's round 1 follows in the same reply; his answer to the round also says whether the quote means what he means.
   - **the want is the source fold, whole**: the pocket or ticket wish plus its raw drop if still held, one point per numbered line (W1 …), never my shorter cut (10-21: a re-cut lost ~35 % of a wish)
   - **every ❓ cites the W-lines it settles**; an uncited line prints as «settled by the wish» or waits for the next round; `node script/wish-cover.ts <PK-N|FRM-N> <round>` exits 0 first
2. **grill** — `mattpocock-skills:grilling` + `mattpocock-skills:domain-modeling` together, in rounds, each round the whole frontier of open questions at once (`habit-dima-comms` § grill), until the open decisions are settled or parked by name. every term the grill settles and every hard decision lands in the ticket (`decided`, a glossary line); codie writes them into `GLOSSARY.md` and an ADR at the build. always; skipped only on his word. a re-shape grills what exists: why, for whom, what is missing, what should go.
3. **prior art** — does it exist already, and can we use it instead of building?
   `advise-project-approach` for a plan or a stack; the research lanes (`x:research`) for
   the market. then the lib search: per part of the build (a waveform, a hotkey, a pan/zoom surface),
   the solid, maintained libraries that already solve it — dima thinks in frontend, so the under-the-hood
   parts are the ones to hunt. candidates to test drive print as a ranked top 7 in the `x:top-seven` shape, a ⭐ rating
   per line (⭐ to ⭐⭐⭐⭐⭐), one `⬅️ my pick` (dima, 2026-10-18). done when the build-or-reuse call and the lib per part are
   written with their reasons.
4. **sharpen** — `neuroarxiv` when the question is an architecture or a method; `adhd` for a name
   or a fork with no clear answer. only where one applies; say which ran and what it changed.
   neuroarxiv's per-paper reads go to a `helper-lite` or `researcher` agent (no fleet memory, ~10k a read).
   then, on every shape, a plan critic: write the plan to a file and run `pnpm -C ~/frame crow:plan-critique
   <file>` — a fresh one-shot on crow's day arm, blind to the thread; its verdict and ≤5 located
   findings go to dima beside the grill (FRM-336).
5. **the cut** — the smallest version worth using, and a written «out» list of what it is not.
   it names the **polish tier**: an internal tool stops at «works and clear»; a showcase app
   (the portfolio, speak, sys) gets the designer's polish phase — the last 10 % is where the
   look comes from, and a reviewer who sees a generic look clicks away.
6. **the done test** — how dima will know it works, as given/when/then lines: his 🎯, never sixth sense's exit lines, which dispatch writes into the spec from it.
7. **the ticket** — one shaped ticket, written through `clio:pm` (its `references/body.md` owns the sections): the wish, why, stories, decided, the cut as `out` and the polish tier, the 🎯 done test, prior art and libs under `refs`; a pocket item behind it dies that turn, `ticket: FRM-N` and a `close:` line. no files: `PRODUCT.md` is born at dispatch, the FTR lines and glossary words in the build (`craft-fleet-flow` § lane init). an app wish then goes to the designer before its sign (`x:crew-designer-interview` reads the ticket; a trial, tested on speak v2).

**completion criterion:** the ticket exists with every section step 7 names, and dima said «shaped»; it
goes to `clio:shape-lane` for his sign, and nothing is designed or built from the original ask.
