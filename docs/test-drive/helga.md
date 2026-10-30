---
status: adopted
until: 2026-10-23
dies-when: the verdict line below is written (2026-10-21, at the refresh-crew-coordinator-helga run)
---

Ticket: none

# 🎀 helga — clio's Haiku 5.5 editing sidecar, on trial

the charter: `x:crew-helga`. a parked `--bg` session on Haiku 5.5 medium, home `~/.local/state/helga/`,
one working dir with clio, receipts slipstreamed as `[progress]`. born 2026-10-14 on dima's word (PK-128,
the shape in `.scratch/helga-shape/`); the recipe that keeps it true: `recipes/refresh-crew-coordinator-helga`.

## the start

- `claude --bg -n '🎀 helga' --model haiku --effort medium --settings '{"worktree":{"bgIsolation":"none"},"autoCompactWindow":130000,"env":{"CLAUDE_CODE_DISABLE_CLAUDE_MDS":"1"}}' "<boot prompt>" --remote-control` — no fleet memory since 2026-10-15 (the charter's floor section stands in; the env goes through `--settings`, a shell var never reaches a `--bg` session); the 130k window compacts near ~97k, under haiku's price line (dima's want, 2026-10-15; 100k thrashed: a ~75k boot refilled the window within 3 turns, 3 times in a row)
  from `~/.local/state/helga/` — without the flag a `--bg` session's edits in the shared checkout are
  refused until it isolates (crow, 2026-10-14); the flag replaced a home `.claude/settings.json` that was gone
  on 2026-10-15
- the boot prompt is `x:crew-helga` as text, its frontmatter cut

## the measures

- clio's context per closed pocket item — baseline 2026-10-14 (rough): ~307k chars of tool output over
  ~9 closed items, ~34k per item, 1 compaction (16:31)
- helga's first-pass green rate, per chore class
- clio's rework rate on its output
- wishkeeper and crow finds traced to helga
- tokens of both threads against clio alone
- helga's own context fill: its auto-compact window is 130k since 2026-10-15 (100k thrashed on its ~75k boot), idle compaction off fleet-wide; a smaller boot is the real fix
- the deciding number for the verdict (the 10-15 recipe run): clio's brief tokens per chore, helga against a fresh `helper-lite` — both cost under a cent in haiku tokens, so the sidecar earns its place only if its memory makes clio's briefs shorter and her rework rarer; the run's `hunt-unload` brief, rerun at the verdict, measures it

## kill rules (crow, 2026-10-14)

- a verify costs more than half the chore it checks
- more than 1 in 5 chores needs rework
- no drop in context per closed item after 3 days of use (the plan critic)

## the rules of the trial

- calibration: clio reads every diff of the first 10 chores, never the receipt alone, and logs each
  miss a receipt hid; rerun-on-surprise starts only after a clean 10 (the plan critic) — closed
  2026-10-14: 18 chores, 15 green first pass, 1 rework, every consult traced to cclio's brief
- after calibration (dima, 2026-10-14): clio lints each brief (`helga-brief-check.ts`) and stops
  reading every diff; crow checks the receipts at her own wakes (`x:crew-adviser` hunts) and names a
  miss to clio; the measure is clio's tool calls per batch, before (b1–b11) and after
- the ceiling, named up front: Edit and Write were ~1 % of clio's tool output on 10-14, Bash ~61 % —
  helga's gain lives in retry loops and multi-file replaces, not in edit echoes
- the quiet-comms trial ends 2026-10-19: if `[progress]` holding is dropped then, helga's receipts
  wake clio and that cost joins this log

## receipt log — one line per chore, its first pass, logged before clio fixes anything

- date · class · first pass (green / red / consult) · rework (none / clio fixed) · note
- 2026-10-14 · bulk-replace · green · none · exact anchor, diff read whole
- 2026-10-14 · pocket-write · green · none · my brief's `cd ~/frame/_clio` fired the AGENTS.md loader hook; composer refused the read, as its charter says — briefs pass `BACKLOG_CWD` without a cd
- 2026-10-14 · gate-retry · green · none · commit 5c7702c on main, no worktree: bgIsolation none proven
- 2026-10-14 · bulk-replace · green · none · b2 chore 1: census line appended under memory-sweep's last line, tail matches
- 2026-10-14 · gate-retry · consult (cclio's brief broke hand-over) · cclio fixed · b2 chore 2: gate held the files cclio still held; she committed them, then the narrowed commit a9f9661 landed with the new subject
- 2026-10-14 · trash (user skills) · green · none · b3 chore 1: five paths trashed, ~/.agents/skills and ~/.claude/skills left with greptile-cli and quicksilver
- 2026-10-14 · lock file · consult (done check) · none · b3 chore 2: the three keys dropped, backup at ~/.local/state/helga/skill-lock.bak.json; greptile-cli was never a key in the lock, so the done check's «still listed» cannot pass
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
- 2026-10-15 · pocket-write · yes · 0 · band-wisp PK-147 created, pocket-check green
- 2026-10-15 · pocket-write · 1 · 0 · b-watch 1: PK-146 done, pocket-check green
- 2026-10-15 · gate-retry · 0 · 0 · b-watch 2: consult, hook demanded _clio/AGENTS.md read; commit held
- 2026-10-15 · gate-retry · consult · cclio fixed · b-watch chore 2: two causes — cclio's brief handed over a file she still held, and the kept AGENTS.md loader listed _clio/AGENTS.md to a memory-less composer; charter now skips the _clio/ read-list and limits gate-retry to unheld files
- 2026-10-15 · pocket-write · 1 · 0 · b-nudge 1: PK-148 created (x-mod-guard helper-lite nudge), pocket-check green
- 2026-10-15 · pocket-write · 1 · 0 · b-guard 1: PK-150 created (x-mod-guard refuse --notes on task with notes)
- 2026-10-15 · pocket-write · 0 · 0 · b-guard 2: PK-150 set waiting; pocket-check red: waiting without **waiting for:** first line; not fixed, consult
- 2026-10-16 · inbox-prep · 0 · 1 · 9 items, 23 asks; check 42/42 exit 0; rework: 2 quoted lines mistyped, fixed
- 2026-10-16 · anchor-edit · consult · n/a · s10r1 withdrawn by cclio: brief miss (cclio's), sent into _clio/ against floor; drafts not strict pairs; dry run caught parser gaps; nothing written
- 2026-10-18 · inbox-prep · 1 · 0 · 102/102 verbatim, check exit 0; 11 items, 20 asks; homes PK-103, PK-142 on subject/body match
- 2026-10-19 · inbox-prep · 1 · 0 · inbox-composer.md written, check 16/16, no commit
- 2026-10-20 · inbox-prep · 1 · 0 · inbox-composer.md written, 38/38 content lines verbatim, 9 items, 23 asks; PK-90 homed for W1, cw memory not homed (PK-196 body differs)
- 2026-10-21 · inbox-prep · 1 · 0 · inbox-prep: 5 items, 9 asks, inbox-prep-check 12/12 exit 0, inbox-composer.md written, inbox.md untouched, no commit
- 2026-10-22 · inbox-prep · 1 · 0 · inbox-composer.md 4 items 5 asks check 8/8
- 2026-10-23 · pocket-write · 1 · 0 · PK-261 → done, note appended
- 2026-10-23 · prompt-groom · 1 · 0 · W148-W218 + ❓1-22, 12 entries, file groom-2026-10-23.md
- 2026-10-23 · prompt-groom · 1 · 0 · pk263 groom: W1-W85, asks 1-11, 0 dup ids; W22/W23 kept pending ← rule
- 2026-10-23 · prompt-groom · 2 · 0 · pk263 16:52 fold: W97-W113, asks 12-13, W86-W96 unused
- 2026-10-23 · pocket-write · 1 · 0 · PK-264 x-mod-holds wisp: notes line appended, pocket-check green (66 tasks)
- 2026-10-23 · prompt-groom · 1 · 0 · PK-263 17:39 entry: W143–W172, ❓14–❓21, raw entry appended to notes
- 2026-10-23 · prompt-groom · 1 · 0 · 17:56 entry folded into PK-263 (W173–W189, ❓22–❓27); raw appended to notes; 149 W-lines, 0 dups, 27 asks
- 2026-10-23 · pocket-write · 1 · 0 · PK-120 (mods lane) + PK-265 (re-sign item) notes appended; pocket-check green 67 tasks
- 2026-10-23 · pocket-write · 0 · 0 · PK-190/145/151 blocked: archived, need restore; PK-265 note appended; pocket-check green 67
- 2026-10-23 · pocket-write · 1 · 0 · PK-265 (re-sign item) 18:44 gate-catch rider appended; pocket-check green 67
- 2026-10-23 · pocket-write · 1 · 0 · PK-263 (lane init) W143–W189 + ❓ asks appended; wish-cover green; pocket-check green 67
- 2026-10-23 · pocket-write · 1 · 0 · PK-266 PK-267 created (cap exit 1); waiting-for notes appended; no open FRM-422/FRM-415 items
- 2026-10-23 · prompt-groom · 1 · 0 · PK-120 16 W-lines appended, wish-cover exit 1 (W1 text missing)
- 2026-10-23 · pocket-write · 1 · 0 · FRM-425 pointer on PK-257 and PK-150; pocket-check green
- 2026-10-23 · pocket-write · 1 · 0 · 13 ticket lines + PK-268 added; pocket-check green
- 2026-10-23 · pocket-write · 2 · 0 · PK-269 + PK-270 created; pocket-check cap exit 1
- 2026-10-23 · chore · 1 · 0 · prompt-groom 23:31 dictation: PK-271 created (pocket 271, size s), W1-W9 body, raw in notes; pocket-check green
- 2026-10-25 · prompt-groom · 1 · 0 · W238-W242 + 1 ask, grooms/2026-10-25-1455.groomed.md
- 2026-10-25 · prompt-groom · 1 · 0 · groom-1541-1545 chore1 W241-W243 3 lines, 3 sentences mapped
- 2026-10-25 · prompt-groom · 1 · 0 · groom-1541-1545 chore2 W244-W255 12 lines, all sentences mapped
- 2026-10-27 · inbox-prep · 0 · 0 · consult 1: charter inbox-prep.md outside _clio/ not found, no grooming done
- 2026-10-27 · inbox-prep · 1 · 0 · inbox-composer.md written, check 4/4, 4 items 3 asks
- 2026-10-27 · prompt-groom · 1 · 0 · 16:09 prompt groomed W265-W271, 11/11 sentences mapped
- 2026-10-27 · prompt-groom · 1 · 0 · 17:16 prompt groomed W275-W278, 4/4 sentences mapped
- 2026-10-27 · prompt-groom · 1 · 0 · 18:50 prompt groomed W281-W282, 2/2 sentences mapped
- 2026-10-28 · inbox-prep · 0 · 0 · consult: inbox.md has 0 content lines, nothing written
- 2026-10-28 · prompt-groom · 1 · 0 · 1427 W283
- 2026-10-28 · prompt-groom · 1 · 0 · 1437 W284-W292
- 2026-10-28 · prompt-groom · 1 · 0 · 1445 W293-W302
- 2026-10-28 · prompt-groom · 1 · 0 · 1451 W303-W305, sideband block not groomed
- 2026-10-28 · prompt-groom · 1 · 0 · 1428 W306-W310
- 2026-10-28 · prompt-groom · 1 · 0 · FRM-463 groomed to 2026-10-27-1843.groomed.md
- 2026-10-28 · prompt-groom · 1 · 0 · FRM-462 groomed to 2026-10-27-1914.groomed.md
- 2026-10-28 · prompt-groom · 1 · 0 · FRM-464 groomed to 2026-10-27-1916.groomed.md
- 2026-10-28 · prompt-groom · 1 · 0 · FRM-464 groomed to 2026-10-27-1925.groomed.md
- 2026-10-28 · prompt-groom · 1 · 0 · FRM-465 W311 groomed to 2026-10-28-1520.groomed.md
- 2026-10-28 · prompt-groom · 1 · 0 · FRM-465 W312-W315 groomed to 2026-10-28-1523.groomed.md
- 2026-10-28 · prompt-groom · 1 · 0 · FRM-465 W316-W319 groomed to 2026-10-28-1549.groomed.md
- 2026-10-29 · prompt-groom · 1 · 0 · W320-W382, 63 lines; asks W340 W355 W356 W359 W361 W368 W370 W373; flag W379; (?) on secror W345
- 2026-10-29 · prompt-groom · 1 · 0 · W383-W483, 101 lines; asks: W383 W389 W391 W407 W416 W420 W427 W436-W438 W440-W445 W449 W457 W463-W466 W482 W483; (?) on helpe-T1 W441 and cc loud W435
- 2026-10-29 · prompt-groom · 1 · 0 · W484-W507, 24 lines; asks: W484 W503 W507; cclio board line (1. mcp-x-cloud-chat, o65) kept as context, not groomed as his words; wispr sixten's→sixth sense W500
- 2026-10-29 · prompt-groom · 1 · 0 · W510-W515, 6 lines; asks: W514 W515; skipped cclio's quoted code:/verify: paragraph at head per brief; ← no line kept as dima's reply (W510)
- 2026-10-29 · prompt-groom · 1 · 0 · W3-W23, 21 lines; asks: W6 W10; FRM-455 W1-W2 held by cclio, not touched; pasted_content wrapper dropped, body kept
- 2026-10-29 · prompt-groom · 1 · 0 · 2026-10-29-1753: W24-W25, 2 lines, asks 0 | 2026-10-29-1803: W26-W32, 7 lines, asks W26 W28 W29 W30 W32 | 2026-10-29-1809: W33-W38 (cclio said W27; W26-W32 taken by 1803, so next free used), asks W33 W35 | 2026-10-28-1711 (FRM-426): W7 (first free per wish block, last W6), ask W7; 1803 raw line 1 is a side-sessions-event wrapper, skipped
- 2026-10-29 · prompt-groom · 1 · 0 · 2026-10-28-1755 (FRM-467): W272-W275, 4 lines, asks 0; first free W272 = next after the wish block's last W271 (W1 is the tick line)
- 2026-10-30 · inbox-prep · 1 · 0 · inbox-prep 2026-10-30: 2 items, 2 asks, check 4/4
- 2026-10-30 · prompt-groom · 1 · 0 · 1458 groomed: W518-W543, Q1-Q3
- 2026-10-30 · prompt-groom · 1 · 0 · 1512 groomed: W544-W554
- 2026-10-30 · prompt-groom · 1 · 0 · 1436 groomed: W555-W582, Q1-Q5
- 2026-10-30 · prompt-groom · 1 · 0 · 2026-10-30-1534 W583 asks=0
- 2026-10-30 · prompt-groom · 1 · 0 · 2026-10-30-1549 W584-W593 asks=2
- 2026-10-30 · prompt-groom · 1 · 0 · 2026-10-30-1608 W594-W612 asks=7
- 2026-10-30 · prompt-groom · 1 · 0 · 2026-10-30-1614 W613 asks=0
- 2026-10-30 · prompt-groom · 1 · 0 · 2026-10-30-1632 W614 asks=1
- 2026-10-30 · prompt-groom · 1 · 0 · W615-W618 (4). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W619 (1). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W620-W624 (5). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W625-W626 (2). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W627-W638 (12). 6 asks Q1-Q6.
- 2026-10-30 · prompt-groom · 1 · 0 · no W-lines (asks only). 2 asks Q1-Q2.
- 2026-10-30 · prompt-groom · 1 · 0 · W639 (1). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W640-W643 (4). 9 asks Q1-Q9.
- 2026-10-30 · prompt-groom · 1 · 0 · W644 (1). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W645-W650 (6). 1 ask Q1.
- 2026-10-30 · prompt-groom · 1 · 0 · W651-W652 (2). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W653-W656 (4). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W657-W660 (4). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W661-W675 (15). 3 asks Q1-Q3.
- 2026-10-30 · prompt-groom · 1 · 0 · no W-lines (asks only). 4 asks Q1-Q4.
- 2026-10-30 · prompt-groom · 1 · 0 · W676-W678 (3). 8 asks Q1-Q8.
- 2026-10-30 · prompt-groom · 1 · 0 · no W-lines (asks only). 2 asks Q1-Q2.
- 2026-10-30 · prompt-groom · 1 · 0 · W679-W681 (3). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · no W-lines (asks only). 1 ask Q1.
- 2026-10-30 · prompt-groom · 1 · 0 · W682 (1). 1 ask Q1.
- 2026-10-30 · prompt-groom · 1 · 0 · W683-W695 (13). no asks.
- 2026-10-30 · prompt-groom · 1 · 0 · W696-W710 (15). 1 ask Q1.
- 2026-10-30 · prompt-groom · 1 · 0 · W711-W715 (5); asks Q1-Q4
- 2026-10-30 · prompt-groom · 1 · 0 · W716-W718 (3); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · W719-W720 (2); ask Q1
- 2026-10-30 · prompt-groom · 1 · 0 · W721-W722 (2); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · no W-lines; ask Q1
- 2026-10-30 · prompt-groom · 1 · 0 · W723-W724 (2); ask Q1
- 2026-10-30 · prompt-groom · 1 · 0 · W725 (1); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · W726 (1); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · W727-W728 (2); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · W729-W731 (3); ask Q1
- 2026-10-30 · prompt-groom · 1 · 0 · W732 (1); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · W733-W734 (2); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · W735-W736 (2); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · W737-W741 (5); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · W742-W743 (2); no asks
- 2026-10-30 · prompt-groom · 1 · 0 · no W-lines; no wish
- 2026-10-30 · prompt-groom · 1 · 0 · 1842 W747-W754 0 asks
- 2026-10-30 · prompt-groom · 1 · 0 · 1856 W755-W756 3 asks
- 2026-10-30 · prompt-groom · 1 · 0 · 1906 W757-W762 1 ask
- 2026-10-30 · prompt-groom · 1 · 0 · o52 W763 1 ask
- 2026-10-30 · prompt-groom · 1 · 0 · o56 W764-W765 0 asks
- 2026-10-30 · prompt-groom · 0 · 1 · 1856 rework: W766-W776 added, dictation not context
- 2026-10-30 · prompt-groom · 0 · 1 · 1906 rework: W777-W794 added, Q1 what is planned

## rounds

- round 1 (2026-10-14): composer started as e80c18d2, Haiku 5.5 medium, bgIsolation none; first batch b1

- 2026-10-14 (halt, sifter over cclio's transcript 11:45–18:21Z): 2.12M chars of tool output, 1,290 Bash / 275 Edit / 60 Write calls, 29 composer briefs; ~17 pocket items closed → ~125k chars per item against the 34k morning baseline. not comparable: the day was mostly sweep and crew grooms, not pocket items, and no pre-composer half exists in this session. the measure needs a fixed ruler — chars per edit-shaped chore, cclio-alone vs via composer, on a matched batch

- 2026-10-15 · the composer recipe run (helper-lite hunts, exa + parallel, an opus + arXiv lane): 65 chores since 10-14, 61 green first pass, 1 rework (1.5 % against the 1-in-5 kill rule), 2 consult, 2 blocked; cclio briefed it in 4 messages, 2,971 chars, on 10-15; composer spent 18.35M tokens, peaking at 187k on 10-14 (past the 100k price line, ×5). per chore in haiku dollars a warm sidecar costs ~1.7–2.5× a fresh `helper-lite`, ~3–6× under one chore an hour. Devin Fusion is the same design; its lesson: a weaker sidekick needs more prescriptive briefs, so the lead's brief tokens decide it. the split (stateless → `helper-lite`, stateful → composer) leaves composer with pocket writes, commits, inbox prep and commit-batch sweeps. the critical review: **keep to the 10-21 verdict** — no kill rule tripped; what 10-21 decides is whether that narrower load pays for a parked session
- 2026-10-15 · the boot probe (dima's tick): `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` drops every CLAUDE.md and rules file, hooks and mods stay (x-mod-guard still refused an `rm`); composer restarted as job 435b4046 without fleet memory, the charter's floor section standing in — boot **~75k → 53.6k**. watch: a chore that breaks a fleet rule the floor dropped, and the next memory-less `inbox-prep` (it handles dima's raw words, so «no prose, low risk» is an inference)
- 2026-10-21 · the boot's inbox prep, read by wishkeeper (boot mode, effort high): 5 items, 9 asks, check 12/12; two meaning slips — «printed» kept literal where dima meant typed (wispr), and the A2 opener «Glados mode on» dropped; the wispr guess «rest» → «test» flagged (?) and confirmed by dima. effort saved, the 10-20 open question: cclio wrote all 5 pocket items herself again, so still unmeasured

- 2026-10-22 · the boot's inbox prep · 4 items, 5 asks, coverage 8/8, ~1 min to the receipt · wishkeeper (boot mode, effort high) found the prep kept every ask in meaning, 0 slips · from today composer is the one grooming runner for every wish-bearing prompt (PK-103 round 2: its grooming lost 1.4 % at the 10-21 audit against cclio's 9.4 %)

## verdict

- 2026-10-20 · **adopted, then reopened the same hour** (dima, 15:59: «how much effort did composer save for yourself?» — never measured: the 10-14 attempt had no fixed ruler, and on 10-20 cclio routed only the inbox prep to composer and wrote every pocket item herself). the quality numbers stand: 49 rounds, 61 of 65 chores green first pass, 1 rework (1.5 % against the 1-in-5 kill rule), inbox prep 79 → 86 over five rounds. the separate inbox-composer.md stays (dima, 2026-10-20: «let's keep both inbox files for now»). the start command and the receipt log stay in this file as the record.
- 2026-10-22 · **adopted** (dima's o33): 61 of 65 chores green first pass, 1 rework (1.5 %); its grooming lost 1.4 % of his points against cclio's 9.4 % at first use (10-21 audit), so it becomes the one grooming runner; the effort it saves cclio was never measured on a fixed ruler — today's volume: 1 chore (the inbox prep)
- 2026-10-27 · prompt-groom · 0 · 1 · 16:09 W265–W271: stamp at line end, not after the number (the check reads it first); two wispr mishears kept («worse»→worth, «math»→matt's), cclio reshaped
