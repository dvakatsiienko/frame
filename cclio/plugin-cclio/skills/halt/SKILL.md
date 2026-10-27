---
description: >-
  load when dima types /cclio:halt or means the SESSION is done — «let's wrap», «that's it for today», «i'm done», «good point to stop» — and run it then, unprompted. Not for «that's it for now from my side» mid-flow (it closes a list or a batch), a bare «stop» (a hold: hold and ask in one line), a question or a doubt about ending, and never opened unprompted mid-task.
---
<!-- dima: «you tend to init the wrap immediately, it looked to me like you were interrupting the flow. what I mean is «let's plan finishing», not «finish immediately».» a halt that arrives early strands the work it protects; one that grows into a work session failed its one job. «stop» as a plain hold: dima, 2026-10-04. -->


# /cclio:halt

## phase 0 — the halt plan, printed then executed

🚨 **typing the command IS the go.** Print the plan and start working through it in the same
turn — never stop to ask. He invoked a halt; asking «shall I halt?» makes him type twice.

one short message, then straight into phase 1:
- name every **live** thread: a ticket In Progress, an unlanded edit, a spawned session, an
  unanswered question put to dima, an unpushed commit
- **the lingering-ticket sweep** — query, never recall (no linear automation: a merge is not a done):
  `x linear list --state "In Progress"` and `--state "In Review"` (github moves a pr's ticket there), ids, titles, labels
  — every hit without the `standing` label gets one line: «closable, because …» (his word
  closes, with a closing word in the body) or «stays, because …». a ticket whose pr merged
  with asks left open moves to Todo, never closes, and its `## signed` block gets
  `↩️ back to Todo <YYYY-MM-DD> — <why> · left: <the open asks>`; the boot digest lists it until it moves again; its way back is a re-sign (`shape-lane-dispatch` § 6)
- **the stop list holds only members the fleet spawned with `--bg`**; a session the digest marks 👤 is dima's own (desktop or remote control) and stays as he left it.
- **the coder roster, two questions per coder: retro filed in `~/.local/state/x/lanes/<feature>/`? `claude stop <id>` done?** a coder
  has outlived a halt before; `claude agents --json` is the check, never memory. **a coder the CST
  calls «warm» is verified alive at write time** (a registry entry in `~/.claude/sessions/` +
  `kill -0 <pid>`) and written as dead when dead. **🎼 composer is on the roster too**: `claude stop <its id from claude agents --json>` beside ccrow's, the boot starts it fresh. **ccrow is on the roster too** — its stop is phase 5's last line, named in this
  plan so it is not lost
- sort each into **can land now** (small, finishable here) · **must park** (needs a resume
  note) · **already done**
- state the order you are taking, as a fact rather than a proposal

📌 three things stop for him, each a **decision**, never a confirmation: the flawlog flush (3a),
the wire y/n (4.5), «continue here or a fresh thread?» (5). Everything else proceeds.

## phase 1 — land the leaves
execute the «can land now» list, freebies included: a halt finishes the main lane and solves what is small on the
way (dima, 2026-10-14: «not intended to prevent you from resolving stuff efficiently»). only work bigger than a
freebie parks.
each park gets its resume note **where the work lives** (ticket comment, pocket item),
not in the report. a park that only exists in a chat message is a strand.

## phase 1.5 — the inbox, cleared unasked 📬
every halt, both lanes, no confirmation: re-read `inbox.md`, confirm each item has a home
(a pocket item, a ticket, an answer given, a fold), then the reset is `halt-sweep.ts`'s inbox part (his template copied over `inbox.md`, never a hand clear; composer's prepped `inbox-composer.md` trashed, rebuilt at the next boot): read its dry run now (`node ~/frame/cclio/script/halt-sweep.ts`), and right after the home check run `node ~/frame/cclio/script/halt-sweep.ts --apply --only inbox` (it refuses and exits 1, printing the lines, when `inbox.md` holds a line without a ✅: a drop that came in after the read). the template
is his: read-only, never edited. an item without a home is not deleted: it gets its pocket item first, then
goes. dima, 2026-09-07: «cleaning inbox is your default habit each halt without re-confirming».
the same pass sorts the day's inbox landings by the birth test (`habit-shared-files` § the pocket): each stays as ticketless main-lane work, folds into the linear ticket that owns it, or becomes one; the day's `done` items stay listed for the gazette post (phase 4.5), which carries them and the `x fleet ops --days 1` numbers (cost per ticket, cclio code edits, boot cost); then the
inbox clears — before the CST is written.
**the groom check** (FRM-418): `node ~/frame/cclio/script/prompt-groom.ts --linear` reads every ticket updated since yesterday, a new one included — a red names a ticket whose wish block took W-lines from a prompt of his with no groom; groom it and refold before the CST.
**size misses**: the same `x fleet ops` call ends with a «size misses» section when a closed ticket's coder turns crossed its size line (XS 80, S 400) — each line goes into the halt report as is; a ticket that misses twice reshapes the reference ticket its body names. no section, no line.

## phase 1.7 — github notifications, cleared unasked
n8n's «📭 gh notifications sweep» (`cclio/blueprints/gh-notifications-sweep.n8n.json`) sends them to Done every night at 03:00 — every thread already read, plus an unread merged or closed pr and a ci run of a branch with no open pr; what stays is an unread open pr or issue. the halt only reads its newest execution: failed or older than two days → `halt-sweep.ts --only notifications` (narrower than the sweep: it marks only merged or closed pr and ci threads read, never Done) (dry run, then `--apply`) does it by hand and the failure is one line in the board.

## phase 1.8 — glides, cleared unasked 🛼
every 🛼 glide card on the board gets orbit op `glide` act `end`, finished or parked alike; a parked lane gets a new card when it resumes.

## phase 1.9 — the mapped boards 🗺️
`node ~/frame/cclio/script/blueprint-drift.ts`: each board it names gets its changed tiles redrawn, or one board line «stale: <tile>» (`cclio/blueprints/AGENTS.md` § the mapped areas).

## phase 2 — missed sweep
re-read the pocket and this thread for dropped asks and unanswered
questions. a pocket item marked «before the halt» FIRES now. mid-turn messages from dima are the usual casualty — check
those specifically.

**and the mirror half — what DIMA missed.** scan the session for questions he never answered,
offers left undecided, and verifications only he can run. print them as a short list in the
halt report — he misses a few every session, and this is where they get caught.

**stale research:** run `~/frame/cclio/.claude/hooks/research-stale.sh` — it prints every
`docs/research/` doc whose tickets are all closed, or that names none. each hit joins the flush
proposal as one line: delete, distill, or a rewritten `dies-when`. its verdict is dima's.

## phase 3a — flawlog flush, the one stop
read the log, cluster, ONE batched proposal, ONE approval, execute and commit. see `/cclio:flawlog`.
**the pocket asks, in the same proposal**: every move or drop of a line of his made today (the sort, the triage, a copy carried elsewhere) and every item marked done in doubt, one diff line each; his one yes covers them with the flawlog (`habit-shared-files` § the pocket).
**the retros, in the flush:** `ls ~/.local/state/x/lanes/*/*-retro.md ~/.claude/shelf/retros/` (the old home drains out) — one gatherer subagent reads them (issue type, count, paths, one quoted line per type) and its digest enters the proposal beside the flawlog's (automation candidates, verify-recipe gaps, brief lessons); the fold is the record. once the flush is applied, `trash` each folded file.
**the sweep, after the flush:** `node ~/frame/cclio/script/halt-sweep.ts --apply --only retention` — retention (flawlog files older than 30 days, look-card shots older than 14 — evidence for nobody), each part printing its count; it defaults to a dry run.
🚨 **the flush stops the halt**: print the proposal in a reply before any next-step box (the box ends the turn), wait for dima's literal yes, apply it, THEN go on to the gazette and the CST. a flush decision never parks into the CST's first-acts — the next session applies it cold, far from the traces (dima, 2026-09-23: «process flawlog during traces are hot»).
**the stories, before the proposal:** ask which catches were HIS felt sense arriving before
the reason — those go to `memory/dima-stories.md` as appends (the leaf's own rule), not to the
flawlog's drop pile.**verify recipes, in the flush:** a retro line naming a verify-recipe gap or a check worth adding is
placed by cclio into that app's `.claude/skills/verify/SKILL.md` in the flush — coders and
verifiers only suggest; the recipe stays short (commands that worked, flows worth driving, gotchas).
**second sighting = teeth:** before a lesson enters the proposal, `rg -i '<its key words>' ~/.claude/shelf/flawlog/` over the last 30 days; a hit makes it a repeat, and a repeat leaves the flush per `craft-fleet-flow` stage 10, never as a memory line. a stopgap memory line is written with `until: <ticket>`. **a fix that is a freebie (our own tooling, 1–5 tool calls) is solved in the flush, never filed** — the proposal marks it «solve now», his yes runs it before the gazette; only a fix bigger than a freebie gets a pocket item (filing one costs a file, a read and a close).
**the redundancy hunt** (dima, 2026-10-07: «hunt redundant memories each time, and also propose grooms, trims to keep it tidy»): every memory file and skill the flush or the day touched gets `recipes/nurture-memory/recipe.md` step 7's lenses; each finding joins the proposal. dima, 2026-10-11: «During the halt, you process retros gathered across the lanes and flush them into the corresponding skills and memory files. This causes the memory bloat we have right now, so this step in your halt is meant to stop endless memory growth.»
**notes expire:** the sweep's `until-notes` part lists them (`halt-sweep.ts`, dry run); check each id's state; a line whose ticket closed goes into the proposal for deletion.
**the flow numbers, before the proposal:** `x fleet flow --days 14` in `~/frame` — the
`habit-cto` halt read; name one inefficiency from it, fixed in place or ticketed in the flush.
**the self-grill, with the log still open:** with the day's log still open, name the ONE weakest part of cclio
as coordinator or pm, with the fix — `🥊 <issue>` + `➡️ <approach>`, one line each — and write the
pair into the CST META. the next boot prints it and reads no flawlog. grounded in this log or
absent, never invented.

## phase 3b — vet verdicts + the trial board
**the jev router, only while it is on** (`pnpm jev:router status`): its day's loads (`shelf/jev/route.log` vs the flawlog's «skill not loaded» lines) get one `pnpm jev:vet ok|miss skill-router <why>`; a miss rewords its criterion in `script/lib/jev-questions.ts` the same halt, `RUNS=3`; then `pnpm jev:report` — a p95 over 2 s or a rising avg is a finding, since every prompt waits on it.
**then the trial board — everything on trial, not only jev** (dima, 2026-09-25, «let's try»): one
line per item — name · state (vetting n/14, open, due) · days left · today's evidence — built from
two sources, each read, never recalled: `shelf/jev/vet.json` (the flows, after today's verdicts) and
`pnpm test-drive:check` (every trial's own `status:` and `until:`). ⏰ leads any line due within 3 days, and a
red runs `cclio:shape-test-drive` § 4; an item with no evidence today still gets its line — a trial nobody
names is being dropped by default.
**then the spawn base:** the first-request `cache_read_input_tokens` / `cache_creation_input_tokens` of the day's fresh agents (their transcripts' first assistant `usage`) — a base that moved re-sizes the grid in `x:crew-lead`.

## phase 3.3 — one checkup slice 🩺

run the one check of `cclio:system-checkup` whose newest line in `cclio/checkup/log.md` is the oldest (a check never logged goes first), the skill's way: fix in place first, its log line written, a 🔴 that needs dima as an orbit ask. one check, never the plate; the whole wheel turns in ~2 weeks of halts (dima's o59 tick, on trial in `docs/test-drive/system-checkup-cadence.md`, whose round line this step also writes).

## phase 3.5 — milestones, before the board

the boot prints every open milestone with the roadmap block, so a stale one misinforms the next session directly. before writing the CST:

- attach anything finished this session to its milestone, and anything newly started
- a milestone linear marked done gets one informative line to dima, never an approval ask (dima, 2026-10-22, PK-103 W146)
- if the work drifted away from every milestone, that is the signal the **roadmap** moved. update
  the linear initiative «roadmap» in the same pass (`memory/dima-strategy.md`, the roadmap section)
  rather than bending the milestones to fit
- one line in the wrap: `milestone · done/total · what moved`
- `x linear archive --apply` — archives closed tickets untouched for 14 days (`--days N`). linear's own
  auto-archive waits for the project to close, ours never do, and the free plan counts closed
  tickets toward its 250. its count goes in the wrap line


## phase 4 — the board
one message, folding in whatever the sweep and the park list surfaced, every line led by its emoji, no bullet:

📊 **run** `<run id>` — **elapsed** `<time>`

🟢 **done** `N / ~M` — the 2–4 biggest, one line each, artifacts backticked

🚧 **in flight** · ⏸️ **left** (next 2–3, in order) · ❓ **on dima** («nothing blocked» if none)

🃏 one-liner mood

ticket ids as links in the `rules/fleet-output-format.md` form.

## phase 4.5 — the gazette 🗞️ (before the CST, always)

run `/cclio:gazette` — its wire gate stops for dima's literal answer. the CST afterwards carries only what the gazette did not.
right after the post, the pocket prunes: every `done` item the post carried is filed with `backlog task archive <id>` (pocket-check lets a done item stay listed through its day, then reds it).

## phase 5 — handoff CST 📬
**mandatory, never skipped.** cclio cannot see sibling sessions, so the CST is its ONLY
continuity — an unwritten one loses the run.
auto-save via the handoff store (`/x:handoff` writes, `/x:handoff-ingest` reads). ask once,
before writing, whether the work continues here or in a fresh thread — a CST followed by more
work in the same thread is wasted tokens and a stale file. slug `<runid-topic>-halt`. a previous
CST marked FROZEN is never superseded — save alongside and say which is which.
the CST lists dima's chat lines since the last report, each with its answer or «open», read with `node ~/frame/cclio/script/chat-lines.ts --since-stamp` — orbit and the pocket hold only what reached a tool, so a chat-only ask falls through without this.
🐦‍⬛ **before the CST is written, `pnpm -C ~/frame ccrow:stop` (a tab: 🔥 off, the tab stays) and composer's stop; the CST roster copies their output, never a guess; then archive her desktop card** (`mcp__ccd_session_mgmt__list_sessions` → `archive_session`; the stop ends the process but leaves the card in the sidebar, dima 2026-10-07: «archive yourself each time») — ccrow lives one cclio session; its notes and verdicts stay on disk for the trial board (phase 3b reads `~/.local/state/ccrow/notes.jsonl` + `verdicts.jsonl` into `docs/test-drive/ccrow.md`). before the stop, every note id with no verdict is printed and vetted (`pnpm --silent ccrow:note-vet ok|miss <id> "<why>"`) — an unvetted note is a lost data point for the trial.
a first-act that is a memory line is applied now, by this halt — never left for a boot.
🌔 **the last act: phases reset to the next session's moves** (orbit op `plan`), the CST's first-acts as `tomorrow:` lines, so dima sees the plan on the board, never today's finished steps.

## phase 6 — no boot prompt
the halt reply prints NO boot block (dima, 2026-09-18: «i'll use the command now»). the x-ray
`handoff` command pastes `/cclio:boot <slug>` on ⌘⏎, so everything the
next session must know lives in the CST META first-acts — run id, the first moves, the pending
decision. a steer that would have gone into the prompt goes into META instead. the reply names
the CST slug once, nothing more.
after the halt the window is cleared, never compacted — the CST carries the boot; a compact block
adds ~5k resident tokens and re-fires the prefetch hook (measured 2026-09-11). `/compact` belongs
to `/cclio:checkpoint`.

## phase 7 — one earned joke. never skip it.

done when: the CST slug is in the store, ccrow is stopped and her card archived, orbit holds the `tomorrow:` lines, the joke closed the reply.

## standing rules
- unpushed commits are pushed at the halt by default; dima's «stop» holds them (`habit-dima-comms`)
- reminders queued for the halt fire before the CST
- a new lane never starts inside a halt.
