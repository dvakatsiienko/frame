---
kind: refresh
owner: [designer, coordinator]
cadence: "when dima says «refresh the design branch», before a big design job after a quiet month, or when Claude Design / Cowork ships a major update; or quarterly, held by its ⏰ in cclio/memory/_reminders.md"
artifacts:
  - home/.claude/plugin-x/skills/crew-designer-interview/SKILL.md
  - home/.claude/plugin-x/skills/crew-designer/SKILL.md
  - ~/projects/studio/AGENTS.md
  - ~/projects/studio/directions/
  - ~/projects/bytes/apps/design-loupe
script: none
was: [refresh-branch-design]
---

# refresh-crew-designer

Keeps the fleet's design flow current: the brief, the designer, the tools and the evidence
behind them. Born from the 2026-09-29 design research ([FRM-244](https://linear.app/x-com/issue/FRM-244)).

## contents

- the want
- the run
- vectors
- artifacts
- findings

## the want

dima's, 2026-09-29:

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

dima, 2026-10-02, on the design comms loop:

> we would monitor for simpler solutions than having a design loop and maintaining it, so maybe at some point we will find a simpler solution

> you print a link and I click it. It directly opens your comment … and reply to you there … very close to me in the UI, like a Speak pill

## the run

1. **groom**: `x:shape-recipe` steps 0 and 2. done: his word on the list. (open)
2. spawn the lanes on one brief (per habit-test-drive: reach for the live test drives first): exa agent (effort set explicitly) · parallel core · an opus lane that reads sources (skills,
   prompts, npm) · neuroarxiv for the papers · `advise-project-approach` when the flow itself is in
   question. one shared brief file; the reply waits for all lanes (habit-dima-comms-pacing: a fan-out answers once). done: every lane returned or marked failed. (template)
3. distill: clever-merge into the artifacts; raw lane output stays in `last/` until the next run's distill. done: the artifacts carry the merge, or are named «unchanged». (open)
4. eval + findings print. done: the proposal is printed. (template)
5. resolve with dima. done: his word on each change. (open)
6. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

dima's asks from the thread:

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
10. reference galleries — which public galleries are alive and good right now (godly, land-book, dribbble search, …) for the designer's after-the-pick references; paid doors (mobbin, refero) stay out (dima, 2026-09-30)
11. the design comms loop — is there now a simpler door than design-loupe? his words are in the want (2026-10-02), the problem it exists for in the analysis below. check each run: can an agent open a pinned thread on the canvas now (`comments` capability, `composer_only`), does the editor read a url anchor or focus param, did Figma or another canvas ship agent-placed pins with a decision UI, does the Code-tab pane offer something native. the evidence so far: `~/frame/docs/research/design-review-comms.md`, `bytes/apps/design-loupe/PRODUCT.md`. a simpler door found → propose retiring design-loupe

### analysis

- the design comms loop's cost to dima: rounds, minutes and sticky hunts per spread in `docs/test-drive/design-run.md`; the bar a simpler door must beat (the story: `docs/research/design-review-comms.md`)
- the run ledger (`docs/test-drive/design-run.md`): tokens, minutes, usage-window % per spread, pick time,
  mash-up requests, rounds past 3 — did the recipe's rules hold?
- dima's verdicts on past picks: which brief lines caused a choice, which axes produced mash-ups
- do the two skills still agree with the research doc line by line?

## artifacts

- `home/.claude/plugin-x/skills/crew-designer-interview/SKILL.md` — the operator interview + the inspiration links
- `home/.claude/plugin-x/skills/crew-designer/SKILL.md` — the designer's execution rules
- `~/projects/studio/AGENTS.md` — the designer's home rules; `~/projects/studio/directions/` — the gallery source
- the design directions gallery artifact (its link lives in the interview skill)
- the `design:*` scripts in frame `package.json`
- design-loupe (`~/projects/bytes/apps/design-loupe`) — the designer → dima asks channel, kept or retired by vector 11

## findings

- an overhaul proposal for dima — what changes in the brief, the designer, the gallery, the scripts; noop is a valid outcome
