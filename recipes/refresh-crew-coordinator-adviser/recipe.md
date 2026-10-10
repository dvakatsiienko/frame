---
kind: refresh
owner: coordinator
cadence: "at the trial verdict (2026-10-20), then at every new anthropic model release or a cc change to mods, advisor or cross-session messaging; the whole setup reviewed critically at every run — the adviser is experimental"
artifacts:
  - home/.claude/plugin-x/skills/crew-adviser/SKILL.md
  - ccrow/AGENTS.md
  - ~/.local/state/ccrow/leaves.txt
  - docs/test-drive/ccrow.md
script: none
groomed: 2026-10-08 (dima)
was: [refresh-ccrow, refresh-adviser, refresh-coordinator-adviser]
---

# refresh-crew-coordinator-adviser

keeps cclio's adviser (today: ccrow) true: what it hunts, how it talks to her, which arm runs it, and whether the whole adviser idea still earns its place.

📌 co-owned with the adviser: it consults at step 1 and self-reports at step 5.

## the want

- «let's have an adviser model for you. it should help us solve fleet flow issues strategically. it should be parked and tied to you (coordinator) as a permanent sidecar. the idea: an unloaded parallel adviser model produces the cleanest insights, with a clean context — its own job is to stay parked and only suggest improvements to your and the fleet's flow, and catch your and my (dima's) misses» (inbox, 2026-10-06)
- «your own verifier — aware of its own role and goal, aware of your (coordinator, pm, cto) role — helps you stay on track?»
- most useful in systematic work: planning, memory sweeps, planning something big; then day-to-day.
- «we underutilize ccrow. research what a good adviser model would want to do to be a very good adviser, and what i myself, as coordinator, pm and cto, want from an adviser model — with the crow taxonomy and its context budget in mind; coding is disapproved, not banned, it may explore. consult the adviser model itself. what to search for: how to build a good adviser model, the best model fit (opus? fable?), the baseline effort.» (2026-10-08)
- «search for a communication model between the adviser and you — the approach changes, and the overall adviser shape is vague: it is a new, recent idea in the ecosystem, not an established practice, a lab-type approach. from what i saw it is useful, so let's keep it, but treat it as experimental and critically review the whole adviser setup each time, so we can revamp it or change it in any way whenever we find a better shape.» (2026-10-08)

## the run

1. **groom** (step 0 of `x:shape-recipe`): first the consult — ping the parked adviser by `SendMessage` with «read first: this recipe (`recipes/refresh-crew-coordinator-adviser/recipe.md`), `x:crew-adviser`, `ccrow/AGENTS.md`, your `notes.jsonl` + `verdicts.jsonl`, and the last findings in `last/`. then: what should this recipe research to make you a better adviser? your own judgment: the vectors you would add, cut or sharpen, and why» — the adviser co-owns the recipe and answers from its whole contract, never blind (dima, 2026-10-08). its answer lands in `last/consult.md` and rides into the owner's cuts and adds; then dima verdicts in one block. done: his word. (the adviser is a co-author of the research, never only a witness — dima, 2026-10-08)
2. **distill the last run's `last/`** before any new lane; name what it already answered. done: a list of answered vs open vectors.
3. **lanes, from one brief**: `researcher` (sources, papers, code) + `pnpm research:lanes` (exa + parallel); `neuroarxiv` when the prior-art vector is open. done: every lane landed or failed out loud. (template)
4. **the built-in head-to-head**, only while `docs/test-drive/ccrow.md` has no `/advisor` verdict: a day of `/advisor fable` beside ccrow, both logging notes, acted-on and tokens. done: the verdict, or «settled <date>». (template)
5. **the self-report**: after the lanes land, ping the adviser for what it lacked, would drop or would hunt, as evidence for the analysis (step 6). done: its answer in `last/consult-report.md`. (script)
6. **analysis**: `notes.jsonl` + `verdicts.jsonl` per arm (notes vs `none`, ok vs miss, latency to the catch, tokens per wake), the flawlog since the last run (what it caught first, what it never caught), `steers.md` obeyed or not. done: the numbers in the findings print. (script)
7. **the critical review of the whole setup**: keep, revamp, or retire the adviser — written as a verdict with its evidence, every run. done: one line, never skipped. (open)
8. **distill** into the artifacts; findings print, ≤3 verdicts to dima. done: printed, each verdicted. (open)
9. **log** today's line. done: `log.md` has it.

## vectors

### research

the owner's vectors, in the outside world:
- what a good adviser agent does: prior art on critic, reflection and devil's-advocate roles in multi-agent systems — when it speaks and when it says `none`, what it reads (timing, the operator's state, the thread's own numbers), how it earns trust; one bullet on the idea's standing (who runs one, who dropped it and why)
- the communication model between an adviser and its coordinator: push (it reads the thread and speaks), pull (she asks), or both; message shape, cadence, what a note must carry to be acted on; what others built and where it broke
- model + effort for an adviser role: stronger, weaker or equal to the coordinator — judged on our own data: a replay set built from `notes.jsonl` with known ok/miss, re-run per arm and effort (park: the eval set)
- packet → accuracy: what context a critic needs to be right and what it fails on without it — images, the session id and cwd, a timestamp per message, the diff since the last wake (park: a packet checklist in `ccrow/AGENTS.md`)
- interruption timing: when a critic holds a note and when it pushes it — natural breaks: a siesta, a commit, before a launch (park: a timing line in the charter)
- evaluation without self-grading: counterfactual scoring of advice, and the bias when the advised grades the adviser (park: the vet protocol)
- the built-in alternative: cc's `/advisor` and the api advisor tool — what they do that ccrow does not (timing, the reconcile line, the length cap, the pairing rule), what ccrow does that they cannot; feeds the head-to-head (step 4)

### analysis

our own evidence:
- cclio's wants from her adviser, seat by seat — as coordinator (dropped asks, stalls, briefs), as pm (tickets, the pocket, the order), as cto (flow numbers, root fixes) — written by cclio from her own misses, then checked against what ccrow hunts today
- everyone's misses — cclio's, dima's, any member's — the adviser's primary goal (dima, 2026-10-08): for dima, one detector per kind (a dropped ask, a call that contradicts his own earlier verdict, overload building), each tested on a real thread
- operator overload: the signals (reply gaps, message length, rounds on one item) are only the trigger — the note's value is the remedy it proposes (split the batch, hold member traffic, collapse the asks), judged by whether the next replies shrink (dima: «what would be truly useful is to propose how to resolve it, not only spotting it») (park: the signal list + the remedy list)
- day mode against systematic mode: which hunts fire in which, from `notes.jsonl`; a hunt that never fires in a mode leaves that mode's charter
- the cost of a wrong note: notes cclio acted on whose action was later undone (disruption), beside ok and miss — the number that says whether the adviser pays
- the signal it should hunt: the class of cclio's errors it has never caught (the flawlog since the last run against its notes); the baseline is the last run's catch count in `docs/test-drive/ccrow.md`
- the arm verdict from `verdicts.jsonl`: ok vs miss per arm, latency to the catch, packet tokens per wake, hits per $
- the consult (step 5): ccrow's own answer, weighed against the research

### cut

settled: «the comms model: pings or reads» — it reads her transcript on a wake, the open question is the shape above. «its taxonomy» — `steers.md` settles it, no lane. «one adviser over many threads» — too early: sharpen ccrow bound to cclio first; an adviser per crew member is parked in linear (dima, 2026-10-08).

## artifacts

- `x:crew-adviser` (`home/.claude/plugin-x/skills/crew-adviser/SKILL.md`) — the seat's contract: hunts, bar, note shape, timing, modes; ccrow's boot prompt
- `ccrow/AGENTS.md` — the mechanics and the facts that bite
- `~/.local/state/ccrow/leaves.txt` — the memory slice it gets per wake
- `docs/test-drive/ccrow.md` — the trial and its log

## findings

done = the run happened (the `x:shape-recipe` rule). the print always carries the setup verdict (keep / revamp / retire) — the adviser is experimental, so every run reviews it whole.

the print carries the parts of `x:shape-recipe`: decisions · facts that move something · prior art (only what is interesting) · the checklist (`x:crew-adviser`, hunt by hunt: fired · caught · never fired) · open.
