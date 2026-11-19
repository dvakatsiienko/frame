---
kind: refresh
owner: [designer, coordinator]
artifacts:
  - home/.claude/plugin-x/skills/crew-designer-interview/SKILL.md
  - home/.claude/plugin-x/skills/crew-designer/SKILL.md
  - home/.claude/plugin-x/skills/crew-lead/references/model-cards.md
  - ~/projects/studio/AGENTS.md
  - ~/projects/studio/directions/
  - ~/projects/bytes/apps/design-loupe
script: none
groomed: 2026-11-19 (dima)
was: [refresh-branch-design]
---

# refresh-crew-designer

Keeps the fleet's design flow true: the brief, the designer, its model, the comms with dima, the tools and the evidence behind them. Born 2026-09-29 from [FRM-244](https://linear.app/x-com/issue/FRM-244).

## the want

dima, 2026-09-29:

> design is missing part entirely in our flow — let's have it but not ad-hoc — let's create a very good skill upfront, so any new thing we create or edit existing would go through the full fledged design process as we planned.

> a working way to create design protos prod grade · know how to properly prompt a designer to have best output designs · what steers work best for a designer · how to properly diversify a designer, so each take is truly unique · research will bring insights. how to remember them, so we won't re-research again?

> i want my part to be as little stress as possible because the design area is very large and new for me … help me out as your operator: how to properly query a designer and suggest to me where to look, and how to properly translate my wants to a designer.

> in your research, hunt as much as possible for top-tier tools and borrow the best parts from there. … not use neobrutalism … i'm not really into all of these design directions, so hunt for good research resources that would allow me to explore them and pick before prompting.

dima, 2026-10-02, on the design comms loop:

> we would monitor for simpler solutions than having a design loop and maintaining it, so maybe at some point we will find a simpler solution

> you print a link and I click it. It directly opens your comment … and reply to you there … very close to me in the UI, like a Speak pill

dima, 2026-11-19 (PK-457:W46–W52):

> i just want to know how fable 5.2 is better at designing than fable 5.1 was, which effort is best for fable 5.2 as a designer, and how much better or worse fable 5.2 and opus 5.5 now are as designers.

> better comms between me and the design phase. in the previous designer runs i had a lot of comms problems: a lot of context switching and back and forth, and we even built a design loop app to simplify my comms.

> research: unfold how bad my comms were in the previous design run, and propose how to search; how to query in the right way so it searches for the right thing; how to simplify the comms between the design phase and me, the operator; how to deliver the design flow to me as a smooth experience; how to translate my wishes to the designer properly. is design loop a correct solution for that or not?

## the run

- the model comparison is research only, never a live arena (dima, 2026-11-19: «i don't have a whole day for another arena run»)
- suggest a run when: a big design job is about to start, a new model ships, or Claude Design ships a major update

1. `clio:shape-recipe` steps 0–2: the grill, the lanes from `pnpm recipe:brief refresh-crew-designer`, the distill. done: its steps are done (template)
2. beside the lanes, a `retro` card reads the designer and clio transcripts of the last design job and counts dima's side: his messages, the rounds, the context switches, the minutes, where he tired. done: the count is in the print, the bar any comms change must beat (open)
3. the print answers each W46 question with a source per claim and ends with design-loupe's keep or retire verdict. done: printed (template)
4. today's line in `log.md`. done: the line is there (template)

## vectors

### research

1. model fit — fable 5.2 against fable 5.1 and opus 5.5 as a designer (benchmarks, design arenas, users' reports), and the effort that serves fable 5.2 best
2. the operator's comms — how to search for references and how to query so a search finds the right thing (W49); how a non-designer operator briefs, steers and picks with the fewest switches and rounds; how a wish is translated into a designer brief; how the flow is delivered to him; is design-loupe still the right door: can an agent pin a thread on the canvas now, does any canvas ship agent-placed pins with a decision ui
3. top AI design tools — Claude Design, paper.design, v0, Stitch, Figma Make, Subframe, Magic Patterns, Lovable: how each works now, which open parts (published skills, system prompts) to borrow
4. prompting a design agent — the brief structure and the steers that measurably change output
5. diversifying takes — how to make a spread truly different, and the right spread size
6. art direction and galleries — the design languages and where to see each, moodboard generators, the public galleries alive now (paid doors like mobbin and refero stay out, dima 2026-09-30)
7. the built-in Design type, in Claude Code and in Cowork — how it works, what it costs, which surface designs better
8. designer tooling — the npm packages behind the `design:*` scripts (contrast, oklch, CVD, scales, tokens, diffing)

### analysis

- dima's comms on the last design job: the retro count of step 2
- the run ledger (`docs/test-drive/design-run.md`): tokens, minutes, usage per spread, pick time, mash-up asks, rounds past 3
- dima's verdicts on past picks: which brief lines caused a choice, which axes produced mash-ups

### cut

- a live blind model arena: parked by dima 2026-11-19, it cost him a whole day and tired him; kept for a later run he asks for
- operator literacy, now inside vector 2; adhd and frame branching, unasked since 2026-09-29; anti-patterns, covered by the shared good and bad practices

## artifacts

- `home/.claude/plugin-x/skills/crew-designer-interview/SKILL.md` — the operator interview and the inspiration links; the comms findings land here first
- `home/.claude/plugin-x/skills/crew-designer/SKILL.md` — the designer's execution rules
- `home/.claude/plugin-x/skills/crew-lead/references/model-cards.md` — the designer's model and effort line; vector 1 lands here, under its byte cap
- `~/projects/studio/AGENTS.md` — the designer's home rules
- `~/projects/studio/directions/` — the gallery source
- design-loupe (`~/projects/bytes/apps/design-loupe`) — the designer → dima asks channel, kept or retired by vector 2

## findings

- an overhaul proposal for dima: what changes in the brief, the designer, its model, the comms, the gallery and the scripts; noop is a valid outcome
- checklist: each W46 question answered with sources · each W49 part answered, how to search and how to query among them · the comms count printed · design-loupe's verdict · every artifact touched or named «unchanged»
