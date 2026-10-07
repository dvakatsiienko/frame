---
kind: refresh
cadence: "at the trial verdict (2026-10-20), then at every new anthropic model release or a cc change to mods, advisor or cross-session messaging"
artifacts:
  - ccrow/charter.md
  - ccrow/AGENTS.md
  - ~/.local/state/ccrow/leaves.txt
  - docs/test-drive/ccrow.md
script: none
---

# recipe — refresh-ccrow

## the want (dima's)

«i think we could benefit from an advicer model for you … an advicer would help us solve flow issue more strategically, be sitting there, rarely peeking into your thread and making suggestions occasionally. i still load you pretty noticeably. so an unloaded paralel advicer model would likely produce cleanest insights» (inbox, 2026-10-06) · «your own verifier, think critically about actually what you do and in overall — do you ever do things right overall?» · most useful in systematic work: planning, memory sweeps, planning something big; then day-to-day.

## the run

1. regroom the vectors with dima; drop the ones the trial already answered
2. research: `pnpm research:lanes <brief>` (exa + parallel) and one opus source lane on the cc docs, the binary's mod code and the advisor-tool docs — a lane per run, never a fork
3. analysis: read the trial numbers above
4. distill into the artifacts; print dima the delta — the arm that wins, the hunts that never fire, the noise
5. resolve with him: keep, reshape, switch the arm, or stop; noop is a fine outcome

## vectors

### research vectors (dima's wording, regroomed with him each run)

- how to properly build and launch an advicer model for the coordinator (not for coders)
- how to instruct it, and what exactly it should hunt
- the comms model: cclio pings it, or it reads her transcripts and messages only when it spots an inefficiency or an error
- is `cc-plugin-you-should-know` enough, or is something else needed
- which model and effort: should the advicer be stronger or weaker than the coordinator — fable 5.1 medium/low vs opus 5.5 low/medium/high
- what memory it carries: stray, or aware of what cclio does and why without her operational load

### analysis vectors (local evidence)

- `~/.local/state/ccrow/notes.jsonl` + `verdicts.jsonl`: per arm, notes vs `none`, ok vs miss, tokens, seconds
- the flawlog since the last run: which catches did ccrow flag first, which did it miss
- `steers.md`: what dima told it, and whether later notes obeyed

## artifacts (pointed at, never housed)

- `ccrow/charter.md` — what it hunts, its bar, its modes
- `ccrow/AGENTS.md` — the mechanics and the facts that bite
- `~/.local/state/ccrow/leaves.txt` — the memory slice it gets per wake
- `docs/test-drive/ccrow.md` — the trial and its log

## cadence

at the trial verdict (2026-10-20), then at every new anthropic model release or a cc change to mods, advisor or cross-session messaging.

## log → log.md
