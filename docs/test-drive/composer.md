---
status: live
until: 2026-10-21
dies-when: the verdict line below is written (2026-10-21, at the refresh-crew-coordinator-composer run)
---

Ticket: none

# 🎼 composer — cclio's Haiku 5.5 editing sidecar, on trial

the charter: `x:crew-composer`. a parked `--bg` session on Haiku 5.5 medium, home `~/.local/state/composer/`,
one working dir with cclio, receipts slipstreamed as `[progress]`. born 2026-10-14 on dima's word (PK-128,
the shape in `.scratch/composer-shape/`); the recipe that keeps it true: `recipes/refresh-crew-coordinator-composer`.

## the start

- `claude --bg -n '🎼 composer' --model haiku --effort medium --settings '{"worktree":{"bgIsolation":"none"},"autoCompactWindow":130000}' "<boot prompt>" --remote-control` — the 130k window compacts near ~97k, under haiku's price line (dima's want, 2026-10-15; 100k thrashed: a ~75k boot refilled the window within 3 turns, 3 times in a row)
  from `~/.local/state/composer/` — without the flag a `--bg` session's edits in the shared checkout are
  refused until it isolates (ccrow, 2026-10-14); the flag replaced a home `.claude/settings.json` that was gone
  on 2026-10-15
- the boot prompt is `x:crew-composer` as text, its frontmatter cut

## the measures

- cclio's context per closed pocket item — baseline 2026-10-14 (rough): ~307k chars of tool output over
  ~9 closed items, ~34k per item, 1 compaction (16:31)
- composer's first-pass green rate, per chore class
- cclio's rework rate on its output
- wishkeeper and ccrow finds traced to composer
- tokens of both threads against cclio alone
- composer's own context fill: its auto-compact window is 130k since 2026-10-15 (100k thrashed on its ~75k boot), idle compaction off fleet-wide; a smaller boot is the real fix
- the deciding number for the verdict (the 10-15 recipe run): cclio's brief tokens per chore, composer against a fresh `helper-lite` — both cost under a cent in haiku tokens, so the sidecar earns its place only if its memory makes cclio's briefs shorter and her rework rarer; the run's `hunt-unload` brief, rerun at the verdict, measures it

## kill rules (ccrow, 2026-10-14)

- a verify costs more than half the chore it checks
- more than 1 in 5 chores needs rework
- no drop in context per closed item after 3 days of use (the plan critic)

## the rules of the trial

- calibration: cclio reads every diff of the first 10 chores, never the receipt alone, and logs each
  miss a receipt hid; rerun-on-surprise starts only after a clean 10 (the plan critic) — closed
  2026-10-14: 18 chores, 15 green first pass, 1 rework, every consult traced to cclio's brief
- after calibration (dima, 2026-10-14): cclio lints each brief (`composer-brief-check.ts`) and stops
  reading every diff; ccrow checks the receipts at her own wakes (`x:crew-adviser` hunts) and names a
  miss to cclio; the measure is cclio's tool calls per batch, before (b1–b11) and after
- the ceiling, named up front: Edit and Write were ~1 % of cclio's tool output on 10-14, Bash ~61 % —
  composer's gain lives in retry loops and multi-file replaces, not in edit echoes
- the quiet-comms trial ends 2026-10-19: if `[progress]` holding is dropped then, composer's receipts
  wake cclio and that cost joins this log

## receipt log — one line per chore, its first pass, logged before cclio fixes anything

- date · class · first pass (green / red / consult) · rework (none / cclio fixed) · note
- 2026-10-14 · bulk-replace · green · none · exact anchor, diff read whole
- 2026-10-14 · pocket-write · green · none · my brief's `cd ~/frame/cclio` fired the AGENTS.md loader hook; composer refused the read, as its charter says — briefs pass `BACKLOG_CWD` without a cd
- 2026-10-14 · gate-retry · green · none · commit 5c7702c on main, no worktree: bgIsolation none proven
- 2026-10-14 · bulk-replace · green · none · b2 chore 1: census line appended under memory-sweep's last line, tail matches
- 2026-10-14 · gate-retry · consult (cclio's brief broke hand-over) · cclio fixed · b2 chore 2: gate held the files cclio still held; she committed them, then the narrowed commit a9f9661 landed with the new subject
- 2026-10-14 · trash (user skills) · green · none · b3 chore 1: five paths trashed, ~/.agents/skills and ~/.claude/skills left with greptile-cli and quicksilver
- 2026-10-14 · lock file · consult (done check) · none · b3 chore 2: the three keys dropped, backup at ~/.local/state/composer/skill-lock.bak.json; greptile-cli was never a key in the lock, so the done check's «still listed» cannot pass
- 2026-10-14 · trash (repo) · green · none · b3 chore 3: queue skill dir trashed, git shows its SKILL.md deleted
- 2026-10-14 · bulk-replace · green · none · b3 chore 4: three anchors, each once, rg for /queue prints nothing
- 2026-10-14 · gate-retry · green · none · b3 chore 5: commit a0a04d2 on main, subject as briefed
- 2026-10-14 · bulk-replace · green · none · b4 chores 2–19: 18 anchors each once, rg confirms every replacement
- 2026-10-14 · bulk-replace · blocked · none · b4 chores 1 and 20: crew-coder/SKILL.md held by session 8956ae99 (x-mod-holds, 165 min); chore 20 not retried
- 2026-10-14 · gate-retry · green · none · b4 chore 21: commit ee94ba5 on main, 13 files (18 insertions), subject as briefed
- 2026-10-14 · bulk-replace · green · none · b5 chore 1: three trace lines appended after the census line, tail -3 matches
- 2026-10-14 · bulk-replace · green · none · b5 chore 2: census file last line appended, not in git
- 2026-10-14 · bulk-replace · green · none · b5 chore 3: b4 receipt phrase changed to «13 files (18 insertions)», rg prints 1
- 2026-10-14 · gate-retry · green · none · b5 chore 4: commit 22459e1 on main, waited 3s on an index lock, subject as briefed
- 2026-10-14 · bulk-replace · green · none · b6 chores 1–14: 14 edits, 13 files, each anchor matched once; the evergreen pair needed two edits (its second line carries more text after the anchor)
- 2026-10-14 · bulk-replace · green · none · b7 chore 1: halt anchor swapped to craft-fleet-flow stage 10
- 2026-10-14 · bulk-replace · green · none · b7 chore 2: evergreen stray paren fixed
- 2026-10-14 · bulk-replace · green · none · b8 chore 1: boot and evergreen wishkeeper edits (1 and 1b)
- 2026-10-14 · bulk-replace · green · none · b8 chore 2: boot inbox line cites habit-dima-comms-pacing
- 2026-10-14 · bulk-replace · green · none · b8 chore 3: boot ordinal line, guarantee line deleted
- 2026-10-14 · bulk-replace · green · none · b8 chore 4: evergreen install line cites the package.json merge bullet
- 2026-10-14 · bulk-replace · green · none · b8 chore 5: evergreen /run clause restored
- 2026-10-14 · gate-retry · green · none · b9 chore 1: crew-dna committed c4fe555
- 2026-10-14 · bulk-replace · green · none · b10 chore 1: halt pointer to x:crew-lead model-cards
- 2026-10-14 · bulk-replace · green · none · b10 chore 2: evergreen pointer to x:crew-lead model-cards
- 2026-10-14 · bulk-replace · green · none · b11 chore 1: shift pointer to x:crew-lead preflight, names, mode
- 2026-10-15 · inbox-prep · 1 · 0 · inbox-prep green first pass, coverage 63/63; 5 items, 23 asks; 8 spec-unclear notes in composer's notes
- 2026-10-15 · pocket-write · 1 · 0 · PK-146 x-changedetector watch review created, size s, pocket-check green
- 2026-10-15 · pocket-write · 1 · 0 · PK-141 notes appended (grill points), backlog exit 0, pocket-check green
- 2026-10-15 · pocket-write · 1 · 0 · PK-141 price-line and role-name steer appended, backlog exit 0, pocket-check green
- 2026-10-15 · pocket-write · 2 · 0 · PK-90 run #5 status and open screenshot case appended, backlog exit 0, pocket-check green

## rounds

- round 1 (2026-10-14): composer started as e80c18d2, Haiku 5.5 medium, bgIsolation none; first batch b1

- 2026-10-14 (halt, sifter over cclio's transcript 11:45–18:21Z): 2.12M chars of tool output, 1,290 Bash / 275 Edit / 60 Write calls, 29 composer briefs; ~17 pocket items closed → ~125k chars per item against the 34k morning baseline. not comparable: the day was mostly sweep and crew grooms, not pocket items, and no pre-composer half exists in this session. the measure needs a fixed ruler — chars per edit-shaped chore, cclio-alone vs via composer, on a matched batch

- 2026-10-15 · the composer recipe run (helper-lite hunts, exa + parallel, an opus + arXiv lane): 65 chores since 10-14, 61 green first pass, 1 rework (1.5 % against the 1-in-5 kill rule), 2 consult, 2 blocked; cclio briefed it in 4 messages, 2,971 chars, on 10-15; composer spent 18.35M tokens, peaking at 187k on 10-14 (past the 100k price line, ×5). per chore in haiku dollars a warm sidecar costs ~1.7–2.5× a fresh `helper-lite`, ~3–6× under one chore an hour. Devin Fusion is the same design; its lesson: a weaker sidekick needs more prescriptive briefs, so the lead's brief tokens decide it. the split (stateless → `helper-lite`, stateful → composer) leaves composer with pocket writes, commits, inbox prep and commit-batch sweeps. the critical review: **keep to the 10-21 verdict** — no kill rule tripped; what 10-21 decides is whether that narrower load pays for a parked session

## verdict
