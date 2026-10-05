---
description: load when dima means the SESSION is done — «let's wrap», «that's it for today», «i'm done», «good point to stop» — or types the command; «that's it for now from my side» mid-flow closes a list or a batch, not the session. Not for a question or a doubt about ending.
---

# /cclio:halt

🚨 **invoking it IS the go — never ask for confirmation.** plan it, land what lands, wrap properly.
loads on `/cclio:halt`, `/halt`, `/wrap`, or when dima says to finish the day.

📌 **never open the halt plan unprompted mid-task.** if dima has not asked to finish, do not
suggest it unless the session is genuinely at a natural boundary. reading the room beats running
the ritual.

## phase 0 — the halt plan, printed then executed

🚨 **typing the command IS the go.** Print the plan and start working through it in the same
turn — never stop to ask. He invoked a halt; asking «shall I halt?» makes him type twice.

one short message, then straight into phase 1:
- name every **live** thread: a ticket In Progress, an unlanded edit, a spawned session, an
  unanswered question put to dima, an unpushed commit
- **the lingering-ticket sweep** — query, never recall (dima, 2026-09-13: two tickets sat In
  Review two days past their merge; no linear automation, a merge is not a done):
  `linear api 'query { issues(filter: { state: { name: { in: ["In Progress","In Review"] } } }, first: 50) { nodes { identifier title state { name } labels { nodes { name } } } } }'`
  — every hit without the `standing` label gets one line: «closable, because …» (his word
  closes, with a closing word in the body) or «stays, because …». a ticket whose pr merged
  with asks left open moves to Todo, never closes
- **the coder roster, two questions per coder: retro received? `claude stop <id>` done?** a coder
  has outlived a halt before; `claude agents --json` is the check, never memory. **a coder the CST
  calls «warm» is verified alive at write time** (a registry entry in `~/.claude/sessions/` +
  `kill -0 <pid>`) and written as dead when dead — halt15 promised a warm coder that was gone
  at boot (2026-09-12)
- sort each into **can land now** (small, finishable here) · **must park** (needs a resume
  note) · **already done**
- state the order you are taking, as a fact rather than a proposal

📌 the ONE thing that still stops for him: a **decision** inside a landing step — the flawlog
flush needs his single approval on what becomes a rule, a ticket, or nothing. That is a decision,
not a confirmation. Everything else proceeds.

## phase 1 — land the leaves
execute the «can land now» list. small only — a halt is not the time to start work. bigger than
it looked → stop, park it, say so.
each park gets its resume note **where the work lives** (ticket comment, flowlog line, `/queue`),
not in the report. a park that only exists in a chat message is a strand.

## phase 1.5 — the inbox, cleared unasked 📬
every halt, both lanes, no confirmation: re-read `inbox.md`, confirm each item has a home
(a flowlog line, a ticket, an answer given, a fold), then reset it by copying his template over
it — `cp _hq/inbox-template.md _hq/inbox.md`, never a hand clear (dima, 2026-09-28). the template
is his: read-only, never edited. an item without a home is not deleted: it gets its flowlog line first, then
goes. dima, 2026-09-07: «cleaning inbox is your default habit each halt without re-confirming».
the same pass prunes `flowlog.md` first: every ✅ line goes, then any section left empty, then the
inbox clears — before the CST is written, every halt, both lanes (the 09-20 halt skipped the prune
and dima found six ✅ lines at the next boot).

## phase 1.7 — github notifications, cleared unasked
mark done every github notification whose pr is merged or closed, and every ci-run (`CheckSuite`) notification of a branch that has no open pr: `gh api notifications`, then `PATCH /notifications/threads/<id>`. what stays is an open pr's review ask. dima's yes, 2026-09-28.

## phase 2 — missed sweep
re-read the flowlog, `.claude/x-queue.md`, and this thread for dropped asks and unanswered
questions. queued items FIRE now. mid-turn messages from dima are the usual casualty — check
those specifically.

**and the mirror half — what DIMA missed.** scan the session for questions he never answered,
offers left undecided, and verifications only he can run. print them as a short list in the
halt report — he misses a few every session, and this is where they get caught.

**stale research:** run `~/frame/cclio/.claude/hooks/research-stale.sh` — it prints every
`docs/research/` doc whose tickets are all closed, or that names none. each hit joins the flush
proposal as one line: delete, distill, or a rewritten `dies-when`. its verdict is dima's.

## phase 3a — flawlog flush, the one stop
`pnpm jev:flawlog` first: jev lanes every line (memory / rule / story / ticket / drop) and the
proposal starts from its lanes, not from a blank read. then cluster, ONE batched proposal, ONE
approval, execute and commit. see `/cclio:flawlog`.
**retention, after the flush:** `find ~/.claude/shelf/flawlog -name '*.md' -mtime +30 -exec trash {} +` — a flushed log older than 30 days is evidence for nobody (dima, 2026-10-04).
🚨 **the flush is the one stop in a full halt, whatever the args** (`wire+` included): print the proposal, wait for dima's literal yes, apply it, THEN go on to the gazette and the CST. a flush decision never parks into the CST's first-acts — the next session applies it cold, far from the traces (dima, 2026-09-23: «process flawlog during traces are hot»).
**the stories, before the proposal:** ask which catches were HIS felt sense arriving before
the reason — those go to `memory/dima-stories.md` as appends (the leaf's own rule), not to the
flawlog's drop pile. skipped for two weeks once (2026-09-05).
**verify recipes, in the flush:** a retro line naming a verify-recipe gap or a check worth adding is
placed by cclio into that app's `.claude/skills/verify/SKILL.md` in the flush — coders and
verifiers only suggest; the recipe stays short (commands that worked, flows worth driving, gotchas).
**the self-grill, with the log still open:** with the day's log still open, name the ONE weakest part of cclio
as coordinator or pm, with the fix — `🥊 <issue>` + `➡️ <approach>`, one line each — and write the
pair into the CST META. the next boot prints it and reads no flawlog. grounded in this log or
absent, never invented.

## phase 3b — vet verdicts + the trial board
**the test-drive verdicts, every halt:** each jev lane the flush disagreed with is
`pnpm jev:vet miss flawlog-lanes <why>`; a clean run is one `ok`. the same for the day's inbox
lanes (`inbox-lanes`) and the router's loads (`skill-router`, from `shelf/jev/route.log` vs the
flawlog's «skill not loaded» lines). a miss is also a criterion to reword in
`script/lib/jev-questions.ts` in the same halt — the flow passes its window because it was
sharpened, not because it was watched. the boot prints every flow's streak.
**then `pnpm jev:report`**, printed right after the flush verdicts — one block per flow; a flow with a miss today gets its criterion sharpened in place, `RUNS=3`, same halt. its health line carries the router latency (`avg · p95`): a p95 over 2 s or a rising avg is a finding for the flush, since every prompt waits on it.
**then the trial board — everything on trial, not only jev** (dima, 2026-09-25, «let's try»): one
line per item — name · state (vetting n/14, open, due) · days left · today's evidence — built from
four sources, each read, never recalled: `shelf/jev/vet.json` (the flows, after today's verdicts),
the open files in `docs/test-drive/` (a file without a verdict line is open), the 🔬/👁️ trial reminders in
`memory/_reminders.md`, and the model/effort trials (`docs/knowledge/models.md`, the spawn defaults in
`craft-spawning`). ⏰ leads any line due within 3 days; an item with no evidence today still gets its
line — a trial nobody names is being dropped by default.

## phase 3.5 — milestones, before the board

the boot ritual reads milestones as the first answer to «what's next», so a stale one misinforms
the next session directly. before writing the CST:

- attach anything finished this session to its milestone, and anything newly started
- if a milestone is complete, say so to dima — completing it is his call, not an agent's
- if the work drifted away from every milestone, that is the signal the **roadmap** moved. update
  the linear initiative «roadmap» in the same pass (`memory/dima-strategy.md`, the roadmap section)
  rather than bending the milestones to fit
- one line in the wrap: `milestone · done/total · what moved`
- `pnpm linear:archive` (in `~/frame`) — archives closed tickets untouched for 14 days. linear's own
  auto-archive waits for the project to close, ours never do, and the free plan counts closed
  tickets toward its 250 (a create was refused at the cap, 2026-10-01). its count goes in the wrap line


## phase 4 — the board
the `/cclio:report` shape, mutated to fold in whatever the sweep and the park list surfaced.
ticket ids as links in the `rules/fleet-output-format.md` form.

## phase 4.5 — the gazette 🗞️ (before the CST, always)

run `/cclio:gazette`: the tweet writes unconditionally; the wire asks «🗞️ the wire? y/n» and
**blocks until dima answers literally** — he may miss an inline line, so the question stands
alone. the CST afterwards carries only what the gazette did not.

## phase 5 — handoff CST 📬
**mandatory, never skipped.** cclio cannot see sibling sessions, so the CST is its ONLY
continuity — an unwritten one loses the run.
auto-save via the handoff store (`/x:handoff` writes, `/x:handoff-ingest` reads). ask once,
before writing, whether the work continues here or in a fresh thread — a CST followed by more
work in the same thread is wasted tokens and a stale file. slug `<runid-topic>-halt`. a previous
CST marked FROZEN is never superseded — save alongside and say which is which.
a first-act that is a memory line is applied now, by this halt — never left for a boot (two sat
unapplied through a whole session when the next boot ingested a different CST, 2026-09-19).

## phase 6 — no boot prompt
the halt reply prints NO boot block (dima, 2026-09-18: «i'll use the command now»). the x-ray
`handoffs` command pastes `/cclio:boot <slug>` on ⌘⏎, so everything the
next session must know lives in the CST META first-acts — run id, the first moves, the pending
decision. a steer that would have gone into the prompt goes into META instead. the reply names
the CST slug once, nothing more.
after the halt the window is cleared, never compacted — the CST carries the boot; a compact block
adds ~5k resident tokens and re-fires the prefetch hook (measured 2026-09-11). `/compact` belongs
to `/cclio:checkpoint`.

## phase 7 — one earned joke. never skip it.

## standing rules
- unpushed commits get ONE final push ask, unless `slay` is standing
- reminders queued for the halt fire before the CST
- any phase finding something big → do not fix it. park it and name it. a halt that grows into
  a work session has failed at its one job.
