---
kind: refresh
owner: coordinator
artifacts:
  - docs/knowledge/operator-agent-comms-optimization.md
  - home/.claude/rules/fleet-output-format.md
  - home/.claude/output-styles/output-fun.md
  - cclio/memory/habit-dima-comms-pacing.md
script: none
groomed: 2026-10-10 (dima)
was: [refresh-comms]
---

# refresh-operator-agent-comms-optimization

keeps the talk between dima and the fleet cheap to read and cheap to steer: what he asks, how the replies land, what costs him turns.

born 2026-10-10 from the operator ledger and the reply analysis (pocket PK-50).

## the want

dima, 2026-10-10: «the recent sweeps that gathered data about our communications were very useful and should be saved in this shape for future runs … the findings are extremely useful. what else could we hunt to improve our communications, and what else interesting could we search for along with this run, because it's kind of wide?»

dima, 2026-10-10: «each time we run this recipe, we first spawn a research fan-out to hunt for info about how to improve communications between humans and agents. based on that, we will know what else we should look for during the scrape.»

## the run

- the research lands before the scrape: its findings add or sharpen the scrape's hunts for this run
- dima's own trackers (🔭, the stat boards, the 📄 stamp) are info he reads, never cut as noise (dima, 2026-10-10)
- cheap by default (dima, 2026-10-10: «the scrape is big and expensive, how to optimize it»; the first run cost ~830k sonnet tokens of labelling and ~350k opus of reading):
  - the extract and every number are `jq` + `duckdb`, free; a model only labels or reads
  - incremental: only prompts since the last run get labelled; labels persist in `~/.local/state/refresh-operator-agent-comms-optimization/labels.parquet`, never re-bought
  - free labels first: bare approvals, slash commands and status words by pattern; the model labels the rest from the first 330 characters
  - the model labels only pushback and the gap (4–7 values, where agreement holds); the 9 kinds come from patterns where mechanical (approve, command, status); the cheapest model that agrees 85 % with the gold set does it (run 1: sonnet, 91 % and 89 %; haiku failed), jev when its credit is back
  - the reply read samples 100 pairs, opus only there

1. **groom**: `x:shape-recipe` steps 0 and 2. done: his word on the vectors. (open)
2. research fan-out: one brief quoting the want and the research vectors, through `pnpm research:lanes <brief>` (exa + parallel) and one `researcher` lane on sources. done: every lane landed or failed out loud. (script)
3. sharpen the hunts: each research finding that names something measurable becomes a scrape hunt for this run, or is named «not measurable here». done: the hunt list for this run is written in `last/`. (open)
4. scrape: `scripts/prompts-extract.sh` and `scripts/replies-extract.sh` over the transcripts since the last run, then labelling lanes (sonnet over his prompts, opus over reply → reaction pairs). done: the numbers and the labels sit in `last/`. (script)
   - the judge sees the 3 turns before each prompt, never the prompt alone: a correction or a re-ask reads as a steer without its context
   - labels use the SWE-chat pushback kinds (correction, rejection, failure report) beside ours, so rates compare with published ones, and tag the communication challenge a prompt shows (what can the agent do, what is it doing, did it land, which past decision applies)
   - the gold set in the label store (`gold-<date>.csv`, the disputed prompts labelled by cclio from context) grows by each run's new disputes: a labelling lane counts only at 85 % agreement or more
   - the relational numbers come from `duckdb`, no model: ask → answer latency, unanswered asks, the repair span after a correction, turns per decision, a new agent message before his reply
5. distill into `docs/knowledge/operator-agent-comms-optimization.md` (the ledger, its trend against the last run) and propose the rule, style and habit lines the run showed wrong; a rule changes only on his word. done: every artifact read and touched or named «unchanged». (open)
6. findings print, the shared parts plus this recipe's checklist. done: printed. (template)
7. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

1. how to improve communication between a human operator and a fleet of coding agents: reading load, reply length, batching asks, decision fatigue, approval queues — what is proven, by whom
2. how practitioners and vendors measure the quality of human ↔ agent communication from transcripts: metrics, taxonomies, the signals that a reply failed, and how to check an LLM judge on a small gold set
3. prior art: fleet views and verdict UIs a Claude Code mod can borrow (side panes, ask queues, inboxes, status bars) from Claude Code, Cursor, Devin, Factory, Conductor and others
4. a non-native English operator who dictates by voice: plain-language and readability practice that cuts load without losing precision
5. interruption and async research: when an agent should interrupt a human, how to batch, what a good digest holds
6. how an agent should ask: defaults, structured choices, when not to ask at all

### analysis

- **his prompts**: kinds, domains, corrections, frustration, re-asks; the meta vs product share by week
- **my replies**: length, asks per reply, add-ons, and what his next prompt did with each part
- **asks that never landed**: he asked, nothing answered or shipped
- **turns per decision**: messages one verdict costs, the bare approvals among them
- **fatigue against the hour**: when corrections spike
- **wispr misses**: misheard words not yet in the dictionary
- **repeated asks and repeated agent commands**: the same shape asked or run by hand again, each an `x` verb or a raycast candidate
- **his felt-sense catches**: a story or a hazard line waiting to be written
- **pushback by published kind**: correction, rejection, failure report, comparable with the SWE-chat rates
- **status lines vs his status-check prompts**: do the trackers answer «are bg agents ok?» before he asks
- **re-asks against recorded decisions**: a re-ask matched to the pocket's decisions and memory, so the decision log gets consulted
- **member reports that reach him**: the length of coder and verifier reports in his thread (an output style never reaches them)

### cut

- skill misses (dima, 2026-10-10): the skill-router vet already counts them

## artifacts

- `docs/knowledge/operator-agent-comms-optimization.md` — the ledger: the numbers, their trend run over run, the open levers; the distill merges, never appends a second copy
- `home/.claude/rules/fleet-output-format.md` — the reply shape; the run proposes line changes, dima approves
- `home/.claude/output-styles/output-fun.md` — the voice; same, his word only
- `cclio/memory/habit-dima-comms-pacing.md` — cclio's pacing habits; proposals announced, edited on his word

## findings

the print is a report, never a bare list (dima, 2026-10-10): the research results, the facts he would find interesting, what was off in our previous shape and why, and what the new findings let us improve.

this recipe's print adds:
- the ledger delta: each number against the last run, the direction named
- the hunts the research added this run, and what each found

checklist, re-checked every run:
- median reply length and asks per reply against the budget in `fleet-output-format.md`
- bare approvals, questions and re-asks as a share of his prompts
- the meta vs product share of the last two weeks
- every lever from the last run: landed, moved, or still open
