---
kind: refresh
cadence: ~2 months
artifacts:
  - docs/knowledge/writing-for-humans.md
  - home/.claude/plugin-x/skills/writing-for-humans/
script: none
---

# refresh-writing-for-humans

Keeps the human-voice toolchain fresh: the distilled knowledge doc, the borrowed humanize
skills, the detector lanes.
## the want (dima's, confirmed 2026-08-27)

> llm footprint on messages is a known issue — i want my outbound texts to sound like me, not
> a robot; and i don't want to re-print the same research asks every time the tech moves.

## the run

1. re-groom the research vectors above with Dima before spawning anything
2. spawn two researchers (skills+techniques · detectors), same split as run #1; think
   alongside them too — Dima's standing note: rely on existing solutions, but add your own
   read on how the skill should work
3. distill: clever-merge findings into `docs/knowledge/writing-for-humans.md` (useful old stays,
   useful new enters, no bloat, completeness first); raw researcher output dies here
4. eval + print findings to Dima: anything new to try out? skill refresh needed? upstream
   humanize moved?
5. resolve with Dima by outcome — typical moves, only as the findings warrant:
   - the pair auto-updates from the `harshaneel/humanize` marketplace (since 2026-09-27): read
     what moved, and check that `x:writing-for-humans` still names the plugin's skills
     (`humanize:humanize`, `humanize:ai-check`) and keeps the multi-lane step
   - fold new techniques into `x:writing-for-humans` and its `dima-voice.md` tells list
   - bump plugin-x, update marketplace, report

## vectors

### research vectors (dima's wording — re-groom with him each run)

- best in class already existing skills for instructing you to print clever human-voiced
  messages, using clever techniques — so we not invent something from scratch
- if skill not found, hunt clever techniques to create home-baked skill
- best (ideally free) llm-has-written-this-message tools; free tiers and apis first
- (added 2026-08-27) has harshaneel/humanize moved — new levers, new tells, new references?
- (added 2026-10-02) published style guides as rule sources: ASD-STE100 Simplified Technical
  English, Google's developer documentation style guide, Apple's style guide — which of their
  rules sharpen the skill, above all for ui text (labels, captions, empty states)

### analysis vectors (local evidence — the running agent is the instrument)

- did outbound texts written with the skill since last run sound like dima — any he flagged as
  machinic, and what tell slipped through?
- do the three skills still route correctly against real asks — drafting → writing-for-humans,
  rewriting → humanize, scoring → humanize-audit?
- have the borrowed copies drifted from their recorded upstream commit?

## artifacts (pointed at, never housed)

- `docs/knowledge/writing-for-humans.md` — the distilled knowledge: existing art, techniques,
  detector landscape
- `home/.claude/plugin-x/skills/writing-for-humans/` (+ `references/dima-voice.md`)
- `home/.claude/plugin-x/skills/humanize/` + `humanize-audit/` — the borrowed copies

## cadence

~2 months, held by the ⏰ reminder in cclio's `_reminders.md` (skill-copies freshness). Also
fires early if a run of the skill produces «machinic» output Dima flags.

## log → log.md
