---
id: PK-57
title: a foldable mods settings gui replaces the breather — grill dima first
status: done
assignee: []
created_date: '2026-10-11 07:40'
updated_date: '2026-10-11 09:37'
labels:
  - m
dependencies:
  - PK-20
priority: now
type: wish
ordinal: 1300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ticket: FRM-391 (sealed 12:02, 6 exit lines, preflight ok; spec `.scratch/stash-settings/spec.md`)
inbox 2026-10-11, dima, folded: «a foldable mods settings gui replaces the breather. interview me (grill). i want at least the stash parts to be toggleable — for example the auto-compact threshold, show/hide — essentially any mod part. make me a really solid mod settings view with good ux.»
- joins the knobs grill already planned for the end of the mods lane (PK-20, tomorrow block: «which mods are configurable today, and how»); this wish widens it into a gui
- breather is a whole mod (plugin-x/mods/breather), so «replaces» means retiring it
? does breather retire when the gui lands
? «essentially any mod part» (stash as the floor) vs PK-20's older «essentials only, never a zoo» — the clash is the grill's first question
- dima, 2026-10-11 11:30: the settings exist so an mvp like the enhancer can be shown or hidden until it earns its place
- dima, 2026-10-11 11:37 (screenshot of the band), folded: the settings toggle sits in the band's button row (an icon, pick pending); the settings fold out in the space above the band, where the breather draws today — they can be big, i open them only when needed, then fold them away. the breather goes away; instead a new breathing animation lives on the two existing bars, 5h and ctx — not very active, no confetti, but pretty and somewhat animated, maybe only a part of it. let the mods coder be creative, and i'll steer.
? the GPU floor: root CLAUDE.md bans continuously repainting animations — the bars breathe only while a turn runs, at a low frame rate (as breather does today)
- grill round 1 decided (dima, 2026-10-11 11:45):
  - Q1 scope: balanced — a show/hide toggle for any mod part, plus a lean set of value knobs; cclio proposes essentials for the existing mods, dima asks for more when he wants them («i don't want 100 settings for each mod»)
  - Q2 breather: it moves and merges into the 5h and ctx bars, so it takes less space; no meter of its own
  - Q3 order: the breather/bars first, it blocks the rest; the frame-rate A/B rides it
  - Q4 storage: one global file; granularity only when he asks
  - Q5 mobile: no mods on mobile at all, so it doesn't matter for now
- grill round 2 decided (dima, 2026-10-11 11:52):
  - Q6 essentials: show/hide for every visible part; 7 value knobs — bars breathe on/off and frame rate, board colour, phase lines (5–7), the 🔊 on assumptions, enhancer show/hide, auto-compact threshold (default 70), guard verdicts shown or silent; holds and redact get none. more when dima asks
  - Q7 polish: internal tool, «works and clear», no designer. the coder gets creative on the animation only: «don't change the current 5h and ctx bars, they are fine — only animate them»
  - Q8 prior art: a 5-minute read of how cc's own /config groups its toggles
  - Q9 placement: try both, the bars and cc's Spinner — «i want to see what Spinner can do»
- prior art (cc's own /config, docs read 2026-10-11): a short flat list of personal options, a choice saves the moment it's made (no save step), and `/config key=value` sets one option without the ui; cc's grouping and control types aren't documented. borrow: save on click, and a `/settings key=value` door beside the gui (the `/board colour` pattern)
- shape-idea + grilling before any build (invariant 3)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
one home now: FRM-391 holds the want, the grill's decisions and the exit lines; stash PRODUCT.md holds the want and the cut (2026-10-11 12:40). open: o28's «useful for coders?» answered at 12:40, dima confirms the /settings cut (o42)
<!-- SECTION:NOTES:END -->
