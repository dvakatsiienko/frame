---
kind: refresh
owner: coordinator
artifacts:
  - docs/knowledge/fleet-operator-comms.md
  - home/.claude/rules/fleet-output-format.md
  - home/.claude/rules/fleet-voice.md
  - home/.claude/rules/fleet-mods.md
  - home/.claude/rules/fleet-flow.md
  - home/.claude/rules/dima-signals.md
  - home/.claude/output-styles/output-crew.md
  - _clio/memory/habit-dima-comms.md
  - x:crew-dna
script: none
groomed: 2026-11-09 (dima)
was: [refresh-comms, refresh-fleet-comms]
---

# refresh-fleet-operator-comms

keeps dima's talk with a many-thread fleet light, human and advisory: every thread speaks one shape, the thread and the board tell one story, and nothing important gets lost to leanness.

born 2026-10-10 from the operator ledger and the reply analysis (pocket PK-50).

## the want

dima, 2026-10-10: «after we ran this recipe the first time, i got the most meaningful fleet/me comms upgrade i ever had … the comms chaos almost stopped.»

dima, 2026-11-09:
- «with multiple wings, solving speed is multiplied, but i now read 2-3 times more per wing, and reply; i get overloaded by your differently formatted, verbose replies.»
- «the recipe was born when i ran clio single-thread; now we have multi-wing clio, which changes the comms a lot: i have at least four parallel threads, and the recipe has to optimize my comms for the current setup.»
- «reply in smaller shapes, with less tech detail; tell me your opinions, interesting insights about our regular work, and suggestions for better decisions.» «don't cut the comms to the floor, or my comms with everyone get too machinic; keep them at least slightly live and human-flavored.»
- «leaner replies may hide important data. i still want the important bits, delivered in a leaner way. i ask for details when i am interested; detail gradually as i ask.» «keep updates very lean, with no technical details, or keep them only when it really matters.»
- «our comms are built mostly around orbit»; --bg threads have no desktop orbit, so «what important thing do i not see there?» «the whole fleet follows the same comms model, so each comms fix is multiplied per thread.» «my comms steering is based on this recipe, so it must be pristine.»

## the run

- thread and board are one comms surface: orbit, phases and glide are read with the replies, every run
- every thread's transcript is read — main, each wing, members, `--bg` sessions; clio's prompt log holds main's prompts only
- dima's trackers (🔭, the stat boards, the 📄 stamp) are info he reads, never cut as noise (dima, 2026-10-10)
- cheap by default: `jq` + `duckdb` count, a model only labels or reads; labels persist in `~/.local/state/refresh-operator-agent-comms-optimization/labels.parquet` and are never re-bought; the cheapest model that agrees 85 % with the gold set labels (run 1: sonnet; haiku failed)
- suggest a run when: a new thread kind joins the fleet (a wing, cap, tilde) or a month passes since the last line of `log.md`

1. **groom**: `clio:shape-recipe` step 0. done: his word on the want, the vectors and the steps. (open)
2. **research**: `clio:shape-recipe` step 1, plus a `neuroarxiv` lane every run (dima, 2026-10-21), one `helper-lite` per paper. done: every lane landed or failed out loud. (script)
3. **sharpen the hunts**: each research finding that names something measurable becomes a hunt for this run, or is named «not measurable here». done: the hunt list is in `last/`. (open)
4. **scrape**: `scripts/prompts-extract.sh` and `scripts/replies-extract.sh` over every thread since the last run, plus the orbit, phases and glide stores, then the labelling lanes. done: the numbers and the labels sit in `last/`. (script)
   - the judge sees the 3 turns before each prompt, never the prompt alone
   - pushback uses the SWE-chat kinds (correction, rejection, failure report) beside ours, so rates compare with published ones; the gold set (`gold-<date>.csv` in the label store) grows by each run's disputes
5. **distill**: one lean comms steer — a handful of proposed lines across the artifacts, each with its why; the numbers merge into the ledger, a side file he never has to read; a rule changes only on his word. done: every artifact read and touched or named «unchanged». (open)
6. **print**: cafe-chat, the findings shape below. done: printed. (template)
7. **log** today's line in `log.md`. done: the line is there. (open)

## vectors

### research

1. one operator, many parallel agents: the reading load, digests, when an agent speaks and when it stays quiet
2. the advisory register: agents that advise instead of report, lean but warm, plain language for a non-native operator who dictates
3. asks outside the chat: side panels, ask queues, inboxes, and how they stay in sync with the thread
4. measuring comms from transcripts: pushback kinds, the signals a reply failed, checking an LLM judge on a small gold set

### analysis

- **thread ↔ board drift**: an ask only in orbit, a grill only on the board, a reply and its ask telling different things
- **overload per thread**: what he reads per hour across main, the wings and the members; shapes that differ by thread
- **advice vs report**: the share of replies carrying an opinion, an insight or a proposal against pure status
- **his complaints and wishes**: what he complained about or asked for, and whether it got solved
- **--bg on the board**: orbit and phases writes he never sees, asks answered only through glide or never
- **what the mods cost**: tokens and chore calls for orbit, phases and glide, per thread
- **relayed words**: a thread acting on his word relayed by another thread, and one piece of news reaching him from two threads
- **the comms guards**: what the reply check, crow and `wish-cover.ts` catch, and what still reaches him; a repeat catch becomes a guard
- **pushback by kind**: its trend since the last run; **silent turns**: a long turn with no word in the thread

### cut

- skill misses (dima, 2026-10-10): the skill-router vet already counts them; wispr misses, repeated commands as verbs, fatigue by hour, felt-sense catches, re-asks against decisions (dima, 2026-11-09): other doors cover them, or they no longer move the comms

## artifacts

- `docs/knowledge/fleet-operator-comms.md` — the ledger: the numbers and their trend run over run; the distill merges, never appends a second copy
- `home/.claude/rules/fleet-output-format.md` — the reply shape; the steer proposes lines, dima approves
- `home/.claude/rules/fleet-voice.md` — the tone, the human flavour; same, his word only
- `home/.claude/rules/fleet-mods.md` — how orbit, phases and glide carry asks and plans; same
- `home/.claude/rules/fleet-flow.md` — who talks to whom, and how a member's word reaches him; same
- `home/.claude/rules/dima-signals.md` — how his own messages are read (markers, dictation); same
- `home/.claude/output-styles/output-crew.md` — the voice; same
- `_clio/memory/habit-dima-comms.md` — clio's pacing and reply habits; proposals announced, edited on his word
- `x:crew-dna` — how every member talks; the steer's member lines land here, so a fix reaches every lane

## findings

the print is cafe-chat (dima, 2026-11-09): the insight first («the fleet got faster at X by 7 % median»), the proposal («faster still if we did Y»), the why in a clause; numbers only when one decides; details when he asks.

this recipe's print adds the steer, at most a handful of lines each with its why, and what moved since the last run, in words.

checklist, re-checked every run:
- reply length and asks per reply, per thread, against `fleet-output-format.md`
- the advice vs report share, thread ↔ board drift and unanswered `--bg` asks, counted
- every lever from the last run: landed, moved, or still open
