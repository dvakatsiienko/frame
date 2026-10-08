---
kind: refresh
cadence: "at the trial verdict (2026-10-20), then at every new anthropic model release or a cc change to mods, advisor or cross-session messaging; the whole setup reviewed critically at every run — the adviser is experimental"
owner: coordinator
artifacts:
  - ccrow/charter.md
  - ccrow/AGENTS.md
  - ~/.local/state/ccrow/leaves.txt
  - docs/test-drive/ccrow.md
script: none
was: [refresh-ccrow]
---

# refresh-coordinator-adviser

keeps cclio's adviser (today: ccrow) true: what it hunts, how it talks to her, which arm runs it, and whether the whole adviser idea still earns its place.

## the want (dima's)

- «let's have an adviser model for you. it should help us solve fleet flow issues strategically. it should be parked and tied to you (coordinator) as a permanent sidecar. the idea: an unloaded parallel adviser model produces the cleanest insights, with a clean context — its own job is to stay parked and only suggest improvements to your and the fleet's flow, and catch your and my (dima's) misses» (inbox, 2026-10-06)
- «your own verifier — aware of its own role and goal, aware of your (coordinator, pm, cto) role — helps you stay on track?»
- most useful in systematic work: planning, memory sweeps, planning something big; then day-to-day.
- «we underutilize ccrow. research what a good adviser model would want to do to be a very good adviser, and what i myself, as coordinator, pm and cto, want from an adviser model — with the crow taxonomy and its context budget in mind; coding is disapproved, not banned, it may explore. consult the adviser model itself. what to search for: how to build a good adviser model, the best model fit (opus? fable?), the baseline effort.» (2026-10-08)
- «search for a communication model between the adviser and you — the approach changes, and the overall adviser shape is vague: it is a new, recent idea in the ecosystem, not an established practice, a lab-type approach. from what i saw it is useful, so let's keep it, but treat it as experimental and critically review the whole adviser setup each time, so we can revamp it or change it in any way whenever we find a better shape.» (2026-10-08)

## the run

1. **groom** (step 0 of `x:shape-recipe`): the owner proposes cuts and adds from the vectors below, dima verdicts in one block. done: his word.
2. **distill the last run's `last/`** before any new lane; name what it already answered. done: a list of answered vs open vectors.
3. **lanes, from one brief**: `researcher` (sources, papers, code) + `pnpm research:lanes` (exa + parallel); `neuroarxiv` when the prior-art vector is open. done: every lane landed or failed out loud. (template)
4. **the consult**: ping the parked ccrow by `SendMessage` with the question «what would make you a better adviser to cclio — what you lack, what you would drop, what you would hunt», its charter and the run's notes as the pointer. done: its answer in `last/consult.md`. (script)
5. **analysis**: `notes.jsonl` + `verdicts.jsonl` per arm (notes vs `none`, ok vs miss, latency to the catch, tokens per wake), the flawlog since the last run (what it caught first, what it never caught), `steers.md` obeyed or not. done: the numbers in the findings print. (script)
6. **the critical review of the whole setup**: keep, revamp, or retire the adviser — written as a verdict with its evidence, every run. done: one line, never skipped. (open)
7. **distill** into the artifacts; print dima ≤3 verdicts. done: printed, each verdicted. (open)
8. **log** today's line. done: `log.md` has it.

## done-test

≤3 verdicts per run — the arm (opus / fable / alternate), one charter change, one hunt added or dropped — each measured by `verdicts.jsonl` hit rate over the next week; plus the setup verdict (keep / revamp / retire). else `noop`.

## vectors (the owner's, re-groomed with dima each run)

research, the outside world:
- what a good adviser agent does: prior art on critic, reflection and devil's-advocate roles in multi-agent systems — when it speaks and when it says `none`, what it reads (timing, the operator's state, the thread's own numbers), how it earns trust
- the communication model between an adviser and its coordinator: push (it reads the thread and speaks), pull (she asks), or both; message shape, cadence, what a note must carry to be acted on; what others built and where it broke
- model + effort for an adviser role: stronger, weaker or equal to the coordinator; evidence, not lore
- the adviser idea's standing in the ecosystem: who runs one, who dropped it and why — is it a practice or still a lab

analysis, our own evidence:
- the signal it should hunt: the class of cclio's errors it has never caught (the flawlog since 10-06 against its notes); today's four catches as the baseline
- the arm verdict from `verdicts.jsonl`: ok vs miss per arm, latency to the catch, packet tokens per wake, hits per $
- its taxonomy: explore yes; code disapproved, not banned; the mod it may own; the retro recipe on; what it must never do
- the consult (step 4): ccrow's own answer, weighed against the research

cut (settled): «is `cc-plugin-you-should-know` enough» — ccrow is its own thing; «the comms model: pings or reads» — it reads her transcript on a wake, the open question is the shape above.

## artifacts (pointed at, never housed)

- `ccrow/charter.md` — what it hunts, its bar, its modes
- `ccrow/AGENTS.md` — the mechanics and the facts that bite
- `~/.local/state/ccrow/leaves.txt` — the memory slice it gets per wake
- `docs/test-drive/ccrow.md` — the trial and its log

## log → log.md
