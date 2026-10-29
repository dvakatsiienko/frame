---
date: 2026-09-27
slug: the-shift-and-the-run-skills
tickets: [FRM-266, FRM-267, FRM-265, FRM-262, FRM-232, FRM-256, FRM-43, BYT-55, BYT-61, BYT-107, BYT-108, FRM-255, BYT-106]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the shift and the run skills

## shipped

- **the shift**, the fleet's build flow in two modes: [FRM-266](https://linear.app/x-com/issue/FRM-266) holds the plan (day shift, night shift, pit stop, debrief, the designer lane, m1 → m4), the [Fleet Shift Plan](https://claude.ai/artifact/9ZkZ7pYK7HXbFChwQpKsiM) artifact is its living doc (v6), and `cclio/shifts/2026-09-28-chords.md` is the first plan, a day-shift dry run
- **a run skill for every app, 10/10**: nine written by one-shot sessions whose prompt was `/run-skill-generator`, no hands needed; `/run` became the sanity pass for coders, verifiers, merges and evergreen; the coder keeps dima's server alive, the skills stay neutral
- **the armor researched**: a conversation-only rule survives a compaction 17 % of the time, a pinned one 0 %; the compaction hooks proven end to end on cc 2.1.283 in the first recipe run in weeks
- **the weekly window is readable**: sline mirrors `rate_limits` to `shelf/usage.json`, and the boot prints `weekly · pace · resets`
- **cleanup**: 107 open tickets became 85 open outside `someday`, with 19 parked under it; rl parked as [BYT-107](https://linear.app/x-com/issue/BYT-107); proto-lab is sketchbook ([BYT-55](https://linear.app/x-com/issue/BYT-55)); the queue empty, reminders 14 → 9, the flowlog carry-over 17 → 11
- **renames and moves**: `crew-coder` + `crew-verifier`, «pit stop» for a batch end, humanize from its upstream marketplace, neuroarxiv from its own, the entity-first naming rule for every coder

## tricks gained

- a spawn prompt that starts with a user-only skill runs it — the door the whole run-skill sweep went through
- a Monitor lives 30 min at most, and `--bg` exits in an untrusted directory: both now in the night-shift armor list
- the Deploy filter counts `.claude/` and `AGENTS.md`: a skills-only push deployed 6 apps

## state

- open: tomorrow's chords shift ([FRM-255](https://linear.app/x-com/issue/FRM-255): the wi-fi write guard first) · the monitor canary on frame#48 · the orphan-net digest line on a 2-week vet · [FRM-267](https://linear.app/x-com/issue/FRM-267) the nurture sweep
- frame and bytes pushed through `cc892389` / `c826bc47`; later commits local

## trail

- shipped: the shift story + plan (FRM-266) · run skills 10/10 · compaction armor researched · usage.json + pace · board 107 → 85 active + 19 someday, rl parked, sketchbook · crew-* names, humanize + neuroarxiv marketplaces
- open: chords day shift 09-28 (m1) · monitor canary · orphan-net vet · FRM-267 nurture sweep · pet markers ride the next bytes code push
- state: frame e6676a4a, bytes 08d9fce1, no coders or probes alive, x 0.11.137 · cclio 0.3.78
