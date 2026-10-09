---
kind: refresh
owner: coordinator
cadence: "~2 months, held by the ⏰ reminder in cclio's `_reminders.md` (skill-copies freshness). Also fires early if a run of the skill produces «machinic» output Dima flags."
artifacts:
  - docs/knowledge/writing-for-humans.md
  - home/.claude/plugin-x/skills/writing-for-humans/
script: none
---

# refresh-writing-for-humans

Keeps the human-voice toolchain fresh: the distilled knowledge doc, the borrowed humanize
skills, the detector lanes.

## the want

dima's, confirmed 2026-08-27:

> llm footprint on messages is a known issue — i want my outbound texts to sound like me, not
> a robot; and i don't want to re-print the same research asks every time the tech moves.

## the run

1. re-groom the research vectors below with Dima before spawning anything. done: his word on the list. (open)
2. spawn two researchers (skills+techniques · detectors), same split as run #1; think
   alongside them too — Dima's standing note: rely on existing solutions, but add your own
   read on how the skill should work. done: every researcher returned or marked failed. (template)
3. distill: clever-merge findings into `docs/knowledge/writing-for-humans.md` (useful old stays,
   useful new enters, no bloat, completeness first); raw researcher output stays in `last/` until the next run's distill. done: the doc carries the merge, or is named «unchanged». (open)
4. eval + findings print. done: the findings are printed. (template)
5. resolve with Dima by outcome — typical moves, only as the findings warrant. done: his word on each move. (open)
   - the pair auto-updates from the `harshaneel/humanize` marketplace (since 2026-09-27): read
     what moved, and check that `x:writing-for-humans` still names the plugin's skills
     (`humanize:humanize`, `humanize:ai-check`) and keeps the multi-lane step
   - fold new techniques into `x:writing-for-humans` and its `dima-voice.md` tells list
   - bump plugin-x, update marketplace, report
6. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

dima's wording:

- best in class already existing skills for instructing you to print clever human-voiced
  messages, using clever techniques — so we not invent something from scratch
- if skill not found, hunt clever techniques to create home-baked skill
- best (ideally free) llm-has-written-this-message tools; free tiers and apis first
- (added 2026-08-27) has harshaneel/humanize moved — new levers, new tells, new references?
- (added 2026-10-02) published style guides as rule sources: ASD-STE100 Simplified Technical
  English, Google's developer documentation style guide, Apple's style guide — which of their
  rules sharpen the skill, above all for ui text (labels, captions, empty states)

### analysis

the running agent is the instrument:

- did outbound texts written with the skill since last run sound like dima — any he flagged as
  machinic, and what tell slipped through?
- do the three skills still route correctly against real asks — drafting → writing-for-humans,
  rewriting → humanize, scoring → humanize-audit?
- have the borrowed copies drifted from their recorded upstream commit?

## artifacts

- `docs/knowledge/writing-for-humans.md` — the distilled knowledge: existing art, techniques,
  detector landscape
- `home/.claude/plugin-x/skills/writing-for-humans/` (+ `references/dima-voice.md`)
- `home/.claude/plugin-x/skills/humanize/` + `humanize-audit/` — the borrowed copies

## findings

- anything new to try out? skill refresh needed? upstream humanize moved?
