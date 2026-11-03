---
kind: refresh
owner: coordinator
artifacts:
  - home/.claude/plugin-x/skills/crew-adviser/SKILL.md
  - _crow/AGENTS.md
  - ~/.local/state/crow/leaves.txt
  - docs/test-drive/crow.md
script: none
groomed: 2026-11-03 (dima)
was: [refresh-crow, refresh-adviser, refresh-coordinator-adviser]
---

# refresh-crew-coordinator-adviser

keeps clio's adviser (today: crow) true: what it hunts, how it talks to her, which arm runs it, and whether the whole adviser idea still earns its place.

📌 co-owned with the adviser: it consults at step 1 and self-reports at step 4.

## the want

- «let's have an adviser model for you. it should help us solve fleet flow issues strategically. it should be parked and tied to you (coordinator) as a permanent sidecar. the idea: an unloaded parallel adviser model produces the cleanest insights, with a clean context — its own job is to stay parked and only suggest improvements to your and the fleet's flow, and catch your and my (dima's) misses» (inbox, 2026-10-06)
- «your own verifier — aware of its own role and goal, aware of your (coordinator, pm, cto) role — helps you stay on track?»
- «we underutilize ccrow. research what a good adviser model would want to do to be a very good adviser, and what i myself, as coordinator, pm and cto, want from an adviser model — with the crow taxonomy and its context budget in mind; coding is disapproved, not banned, it may explore. consult the adviser model itself. what to search for: how to build a good adviser model, the best model fit (opus? fable?), the baseline effort.» (2026-10-08)
- «search for a communication model between the adviser and you — the approach changes, and the overall adviser shape is vague: it is a new, recent idea in the ecosystem, not an established practice, a lab-type approach. from what i saw it is useful, so let's keep it, but treat it as experimental and critically review the whole adviser setup each time, so we can revamp it or change it in any way whenever we find a better shape.» (2026-10-08)
- «Let's not blur the role too much as well.» (2026-11-03)
- «From the side channel, you can evaluate crow behavior because you see all the communications that are happening live right now. You can also analyze inefficiencies in crow actions themselves.» — and the runner grows too: «think about growing yourself too and think critically» (2026-11-03)
- standing call, crow's long context: «The fact that it doesn't have compaction and/or context clear is not so bad because it keeps a history of what we do and is able to retro.» (2026-11-03)

## the run

- suggest a run when: a new anthropic model ships, a cc change to mods, advisor or cross-session messaging

1. **groom** (step 0 of `clio:shape-recipe`): first the consult — ping the parked adviser by `SendMessage` with «read first: this recipe (`recipes/refresh-crew-coordinator-adviser/recipe.md`), `x:crew-adviser`, `_crow/AGENTS.md`, your `notes.jsonl` + `verdicts.jsonl`, and the last findings in `last/`. then: what should this recipe research to make you a better adviser? your own judgment: the vectors you would add, cut or sharpen, and why» — the adviser co-owns the recipe and answers from its whole contract, never blind (dima, 2026-10-08). its answer lands in `last/consult.md` and rides into the owner's cuts and adds; then dima verdicts in one block. done: his word. (the adviser is a co-author of the research, never only a witness — dima, 2026-10-08)
2. **distill the last run's `last/`** before any new lane; name what it already answered. done: a list of answered vs open vectors.
3. **lanes, from one brief**: `researcher` (sources, papers, code) + `pnpm research:lanes` (exa + parallel) + a `neuroarxiv` lane every run (dima, 2026-10-21), its paper reads one `helper-lite` per paper. done: every lane landed or failed out loud. (template)
4. **the self-report**: after the lanes land, ping the adviser for what it lacked, would drop or would hunt, as evidence for the analysis (step 5). done: its answer in `last/consult-report.md`. (script)
5. **analysis**: `notes.jsonl` + `verdicts.jsonl` per channel and arm (session wakes, plan critiques: notes vs `none`, ok vs miss, latency to the catch, tokens and cost per wake), `harvest.log` (timeouts, gaps), the flawlog since the last run (what it caught first, what it never caught), `steers.md` obeyed or not; the runner adds what it saw live from its own seat. done: the numbers in the findings print. (script)
6. **the critical review of the whole setup**: keep, revamp, or retire the adviser — written as a verdict with its evidence, every run. done: one line, never skipped. (open)
7. **distill** into the artifacts; findings print, ≤3 verdicts to dima. done: printed, each verdicted. (open)
8. **log** today's line. done: `log.md` has it.

## vectors

### research

the owner's vectors, in the outside world:
- what a good adviser agent does: prior art on critic, reflection and devil's-advocate roles in multi-agent systems — when it speaks and when it says `none`, what it reads (timing, the operator's state, the thread's own numbers), how it earns trust; one bullet on the idea's standing (who runs one, who dropped it and why)
- the communication model between an adviser and its coordinator: push (it reads the thread and speaks), pull (she asks), or both; message shape, cadence, what a note must carry to be acted on; what others built and where it broke
- model + effort for an adviser role: stronger, weaker or equal to the coordinator — judged on our own data: a replay set built from `notes.jsonl` with known ok/miss, re-run per arm and effort (park: the eval set)
- claim verification by an outside reader: prior art on checking an executor's report against its trace (critic and verifier agents, report-vs-trace checks) — a «done», «fixed», «sealed» or «reset» held to its read-back before the operator reads it
- packet → accuracy: what context a critic needs to be right and what it fails on without it — a digest per tool call (command, exit code, first error line), the board's state (asks open, ticked, resolved), images as a path it can name, the diff since the last wake (park: a packet checklist in `_crow/AGENTS.md`)
- event-triggered critique vs cadence: which act classes earn an interrupt (spend, an external write, an irreversible act, a «done» to the operator), what a short hold costs, and when a critic holds a note vs pushes it at a natural break (park: a timing line in the charter)
- two reviewers, one coordinator: how systems with an intent critic and an artifact auditor (crow and wishkeeper) split the work without double reads
- evaluation without self-grading: counterfactual scoring of advice, and the bias when the advised grades the adviser — every verdict today is clio's (park: the vet protocol)

### analysis

our own evidence:
- clio's wants from her adviser, seat by seat — as coordinator (dropped asks, stalls, briefs), as pm (tickets, the pocket, the order), as cto (flow numbers, root fixes) — written by clio from her own misses, then checked against what crow hunts today
- everyone's misses — clio's, dima's, any member's — the adviser's primary goal (dima, 2026-10-08): for dima, one detector per kind (a dropped ask, a call that contradicts his own earlier verdict, overload building), each tested on a real thread
- operator overload: the signals (reply gaps, message length, rounds on one item) are only the trigger — the note's value is the remedy it proposes (split the batch, hold member traffic, collapse the asks), judged by whether the next replies shrink (dima: «what would be truly useful is proposing how to resolve it, not only spotting it») (park: the signal list + the remedy list)
- the plan-critique arm: cost per vetted catch, and whether its catches land before the seal or after it
- comms load: wakes per hour, push vs slipstream, wakes that fire with an empty packet, from the x-mod-stash quiet-log and `harvest.log`
- the overlap with wishkeeper: crow notes that re-flag a finding wishkeeper already made
- the cost of a wrong note: notes clio acted on whose action was later undone (disruption), beside ok and miss — the number that says whether the adviser pays
- the signal it should hunt: the class of clio's errors it has never caught (the flawlog since the last run against its notes); the baseline is the last run's catch count in `docs/test-drive/crow.md`
- the arm verdict from `verdicts.jsonl`: ok vs miss per arm, latency to the catch, packet tokens per wake, hits per $
- the self-report (step 4): crow's own answer, weighed against the research

### cut

settled: «the comms model: pings or reads» — it reads her transcript on a wake, the open question is the shape above. «its taxonomy» — `steers.md` settles it, no lane. «one adviser over many threads» — too early: sharpen crow bound to clio first; an adviser per crew member is parked in linear (dima, 2026-10-08). «the `/advisor` head-to-head» — dropped 2026-10-11 (`docs/test-drive/crow.md`), only its delta rides the shared vectors. «day mode against systematic mode» — every hunt fires in both (dima, 2026-11-03). «crow's context size» — his standing call above (2026-11-03).

## artifacts

- `x:crew-adviser` (`home/.claude/plugin-x/skills/crew-adviser/SKILL.md`) — the seat's contract: hunts, bar, note shape, timing, modes; crow's boot prompt
- `_crow/AGENTS.md` — the mechanics and the facts that bite
- `~/.local/state/crow/leaves.txt` — the memory slice it gets per wake
- `docs/test-drive/crow.md` — the trial and its log

## findings

done = the run happened (the `clio:shape-recipe` rule). the print always carries the setup verdict (keep / revamp / retire) — the adviser is experimental, so every run reviews it whole.

the print follows `clio:shape-recipe` step 3 (the research-print shape, plus the checklist and the `open` vectors); its checklist is `x:crew-adviser` hunt by hunt: fired, caught, never fired.
