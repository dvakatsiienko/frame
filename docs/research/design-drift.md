---
dies-when: dima picks a drift policy, it lands in `x:crew-designer` + `studio/AGENTS.md`, and the one-week test below has run
---

# design drift — keep comps alive, or throw them away

Ticket: [FRM-244](https://linear.app/x-com/issue/FRM-244)

researched 2026-09-29, four lanes on one brief: exa agent · parallel core · an opus lane reading primary sources ·
neuroarxiv (20 arXiv papers). the input number: one 4-take spread = ~68k output tokens, ~10.7 min, ~3 % of a 5-hour
window (atelier v1, `docs/test-drive/design-run.md`).

## the verdict — all four lanes agree

**the structured layer lives, pixel comps retire.** no product and no paper keeps page-level comps in sync with an
evolving app; everything that syncs, syncs components and tokens.

- **alive:** the code (components), the tokens, and `DESIGN.md` derived from the shipped app (impeccable's `document`;
  Stitch open-sourced the same format)
- **kept, not synced:** the approved comp stays as a dated reference with its `decision.md` — dima's polished mock is
  never lost, it simply stops being the source of truth once built
- **a new view or flow** starts from the living layer + a **screenshot of the live app**, never from an old comp
- **a small ask** (copy, spacing, a state, a component variant) goes to the coder with `DESIGN.md` + a screenshot review,
  no designer

## what others do (opus + exa + parallel)

- Subframe syncs components one way and exports pages once, «pages are typically modified with business logic»
- v0 makes the design system (shadcn registry + tokens) the source of truth; Figma Code Connect maps design components to
  repo components
- Claude Design's `/design-sync` (2026-06-17) syncs **components**, user-triggered, React only; the first sync on a big
  repo «can take hours»
- Figma Code-to-Canvas and Paper pull a live UI onto a canvas on demand; Builder.io's critique: the layers carry no logic,
  so each design update is redone by hand in code
- **no product runs a designer per change by default**; every round-trip tool is on demand

## the evidence (neuroarxiv + parallel)

- structure beats image-only for design-to-code (2604.13648, 2604.01226, 2603.14724; SpecifyUI 2509.07334)
- a reference earns its keep as a **check target** while building — render, compare, refine (2511.08195, 2602.05998,
  2608.24138: one scoped fix per round, or fixes regress elsewhere)
- multi-turn UI editing degrades: 74.9 % single-turn pass vs 37.3 % over five turns (EvoGenUI-Bench 2608.29387) — a
  long-lived artifact edited turn by turn rots
- green tests overstate design quality: fewer than half of resolved issues fully meet the design constraints (2604.05955)
- **missing:** no study of an agent designer in the loop over time, no measured cost of keeping comps in sync, no UI
  design-debt study

## the cost of dima's live mode (a designer on every ask)

at 5–15 UI asks a day, one spread per ask:

- **live mode:** 25–75 spreads a week, 1.7–5.1M output tokens, **75–225 % of one 5-hour window a week** (exa, parallel;
  opus: 1–3 full windows)
- **selective** (designer for new views, flows, redesigns, a new shared pattern; ~10 % of asks): 2.5–7.5 spreads a week,
  **~7–22 % of one window**
- a **single-take pass** on a known component library would be far smaller than a spread — ~10–20k tokens is **an
  estimate** (opus lane), never measured

## where the lanes split

- exa: a new flow gets 2–4 **targeted** takes, not a full 4-corner spread
- parallel: the 10 %-of-asks trigger rate is a planning assumption, to be replaced by the log
- neuroarxiv: the designer should also output a small spec next to the comp (components + tokens) — ours is `contract.md`
- opus: skip `/design-sync` until a canvas pass needs real components (it needs a React package or storybook)

## the disprovable first test (opus + exa, merged)

one week: every small UI ask goes to the coder with `DESIGN.md` + a live screenshot, no designer; the designer runs only
for new views and flows. log each ask and whether dima rejected the result for a visual reason. **over 25 % visual
rejections, or a mid-way ask for a comp → the policy is wrong**, and a single-take designer pass becomes the default for
small asks (measure its real cost on the first one).
