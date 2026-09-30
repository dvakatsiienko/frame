# refresh-design-branch — recipe

Keeps the fleet's design flow current: the brief, the designer, the tools and the evidence
behind them. Born from the 2026-09-29 design research ([FRM-244](https://linear.app/x-com/issue/FRM-244)).
Recipe entity per [_spec.md](_spec.md).

## the want (dima's, 2026-09-29)

> design is missing part entirely in our flow — let's have it but not ad-hoc — let's create a very
> good skill upfront, so any new thing we create or edit existing would go through the full
> fledged design process as we planned.

> a working way to create design protos prod grade · know how to properly prompt a designer to
> have best output designs · what steers work best for a designer · for multi-shot starter …
> how to properly diversify a designer, so each take is truly unique · research will bring
> insights. how to remember them, so we won't re-research again?

> i want my part to be as little stress as possible because the design area is very large and
> new for me … help me out as your operator: how to properly query a designer and suggest to me
> where to look, and how to properly translate my wants to a designer.

> in your research, hunt as much as possible for top-tier tools and borrow the best parts from
> there. … not use neobrutalism … i'm not really into all of these design directions, so hunt
> for good research resources that would allow me to explore them and pick before prompting.

## research vectors (dima's asks from the thread — re-groom each run)

1. prod-grade design protos — how the top AI design tools work now (Claude Design, paper.design,
   v0, Stitch, Figma Make, Subframe, Magic Patterns, Lovable …) and which of their open parts
   (published skills, public system prompts) to borrow
2. prompting a design agent — the brief structure and the steers that measurably change output
3. diversifying N takes — how to make a spread truly different; the right spread size
4. the operator's literacy — what a non-designer must know before briefing; the «AI look» tells
5. art direction — the design languages and where to see each; moodboard generators
6. the built-in Design type, in Claude Code and in Cowork — how it works, what it costs, which
   surface designs better, what changed since the last run
7. designer tooling — the npm packages behind the `design:*` scripts (contrast, oklch, CVD,
   scales, tokens, diffing): new versions, dead ones
8. adhd / frame branching for design — new evidence (neuroarxiv lane)
9. anti-patterns — how design work goes wrong upstream, the gates against it

## analysis vectors (local evidence)

- the run ledger (`docs/test-drive/design-run.md`): tokens, minutes, usage-window % per spread, pick time,
  mash-up requests, rounds past 3 — did the recipe's rules hold?
- dima's verdicts on past picks: which brief lines caused a choice, which axes produced mash-ups
- do the two skills still agree with the research doc line by line?

## artifacts (pointed at, never housed)

- `plugin-x/skills/crew-designer-interview/SKILL.md` — the operator interview + the inspiration links
- `plugin-x/skills/crew-designer/SKILL.md` — the designer's execution rules
- `~/projects/studio/AGENTS.md` — the designer's home rules; `~/projects/studio/directions/` — the gallery source
- the design directions gallery artifact (its link lives in the interview skill)
- `docs/research/design-process.md` — the distilled evidence, until the skills fully carry it
- the `design:*` scripts in frame `package.json`

## lanes (per habit-test-drive: reach for the live test drives first)

exa agent (effort set explicitly) · parallel core · an opus lane that reads sources (skills,
prompts, npm) · neuroarxiv for the papers · `advise-project-approach` when the flow itself is in
question. one shared brief file; the reply waits for all lanes (habit-dima-comms-pacing: a fan-out answers once).

## the run

1. re-groom the vectors with dima; add what changed in the tools since the last run
2. spawn the lanes on one brief
3. distill: clever-merge into the artifacts; raw lane output dies
4. eval + findings: an overhaul proposal for dima — what changes in the brief, the designer,
   the gallery, the scripts; noop is a valid outcome
5. resolve with dima; log the run below

## cadence

when dima says «refresh the design branch», before a big design job after a quiet month, or when
Claude Design / Cowork ships a major update.

## last run

- 2026-09-29 — the founding research: five lanes, 12 vectors, plus a Cowork-vs-CC lane (`docs/research/design-process.md`)
