---
date: 2026-08-27
slug: the-pacing-fix
tickets: [DOT-228, DOT-178, DOT-114, DOT-159, DOT-227, DOT-121, DOT-166, DOT-61, DOT-223, DOT-130, DOT-220, DOT-184, DOT-72, DOT-176, DOT-117, DOT-196, DOT-54]
posted: { health: yes, announcements: yes }
---

# 🗞️ the pacing fix — the boot learns to orient, dispatch seals

## shipped

- **the boot rewired: orient, never resolve** — dima diagnosed the data-loss root in inbox
  («your pacing»): fat queries resolved in 1–2 turns. new contract (cclio 0.3.5): inbox parses
  to a flowlog checklist with lanes, board proposes the order and STOPS for his word; heavy
  queries fire at the step that needs them; overload gets flagged, never absorbed.
- **prompt coaching habit** (0.3.8) — every boot board ends with 1–2 lines on the one thing in
  that inbox that parsed hard, or «prompt is good».
- **dispatch buckets rebalanced, topic sealed** — earlier session moved the boot home as
  `init-dispatch` (0.3.4, x 0.9.30, x-cw 0.1.9); this one deduped the three files:
  `dispatch-init.md` = injected identity stub · `/cclio:init-dispatch` = the one boot (root
  config + rules + surface leaf + barrel index, leaves on demand) · `sys-dispatch.md` = pure
  reference. a live read-order contradiction and a stale `dispatch-boot` name died with it.

## tricks gained

- the 24h handoff sweep nearly ate a pending CST written the evening before — a `touch` resets
  the clock; watch CST age when a session is skipped a day.

## state

- new pacing flow is UNPROVEN — next boot is run #1, self-watch armed in the update CST.
- two CSTs pending: smoothing-session (main plan) + pacing-flow-update (the delta).
- inbox deliberately unprocessed; the parse plan (b1/b2/b3 lanes) rides the update CST.

⸻ upd 22:00

# 🗞️ the smoothing session — the flow proved, the toolchain got human

## shipped

- **the pacing flow VALIDATED on run #1** — boot oriented only, inbox parsed to lanes, every
  ask landed; dima's verdict on the parse: clean. new guards from the one flaw
  ([DOT-228](https://linear.app/x-com/issue/DOT-228) body overwritten before reading): fetch-full
  before rewrite · merge over rewrite · dima's words survive every edit · memory edits announced
  (option b adopted as `habit-memory-edits`).
- **urgents walk emptied p1** — 9 → 1 via `/x:step-by-step`: closed
  [DOT-178](https://linear.app/x-com/issue/DOT-178) (verified already done) +
  [DOT-114](https://linear.app/x-com/issue/DOT-114) (solved at settings layer); 6 demoted+groomed;
  [DOT-159](https://linear.app/x-com/issue/DOT-159) stays the deliberate beacon. highs sampled:
  [DOT-227](https://linear.app/x-com/issue/DOT-227) coded by an opus coder (sline single-pin,
  `claim` verb, agents pin their own ticket), [DOT-121](https://linear.app/x-com/issue/DOT-121)
  closed by adoption, [DOT-166](https://linear.app/x-com/issue/DOT-166) resolved in place,
  cc-cloud family retired ([DOT-61](https://linear.app/x-com/issue/DOT-61)/48/57/59/55 canceled,
  3 workflows deleted, 11 canceled tickets archived).
- **writing-for-humans SHIPPED + validated** — [DOT-223](https://linear.app/x-com/issue/DOT-223)
  done: `x:writing-for-humans` (dima-voice corpus) + borrowed harshaneel `humanize`/`humanize-audit`
  (multi-lane verify); 4-round live health-update test settled the house style (gazette 0.3.9).
- **the procedure entity born** — `cclio/docs/procedures/`: `_spec` (want=dima's, research
  vectors=his wording, artifacts pointed-at, noop first-class) + memory-nurture ·
  refresh-writing-for-humans · refresh-model-knowledge (closes
  [DOT-130](https://linear.app/x-com/issue/DOT-130)) · refresh-spawn-mechanics.
- **memory-nurture stories settled** — [DOT-220](https://linear.app/x-com/issue/DOT-220) (memory,
  absorbed DOT-73) + [DOT-184](https://linear.app/x-com/issue/DOT-184) (skills); labels
  `memory`/`skill` born; all 21 labels got unique colors.
- **docs pristine** — `docs/agents` → **`docs/knowledge`** (21 refs swept); research dir 12 → 3
  with `dies-when:` frontmatter now mandatory; roadmap = symlink into the vault (sync dies).
- «**propose**» joined fleet-vibe: answer → approve → act on one word.

## tricks gained

- linear renders id links as fat title-badges — badges at sentence edges, one per paragraph
  (the house style's root finding).
- resume re-read memory THROUGH a symlink (fresh-boot probe still armed).
- a ref-carrying push assigned NOBODY — the auto-assign may be conditional; observation logged
  in `docs/knowledge/linear-autoassign-investigation.md`.
- bg coders are worktree-forced — main's uncommitted files physically safe from them.

## state

- next boot first-dos: autoassign fix · refresh-spawn-mechanics run · dispatch-dump mining ·
  cursor-ux review. groom order: pm takeover milestone → dima's tools milestone → cclio v2.
- open on dima: voice corpus drop · sapling key (optional) · github secrets deletion.
