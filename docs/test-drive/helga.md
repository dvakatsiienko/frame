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
- 2026-11-01 · inbox-prep · 1 · 0 · inbox-prep 2026-11-01: 1 item, 2 asks, check 2/2 exit 0; PK-290 home kept
- 2026-11-01 · prompt-groom · W795-W801 (prompt 1), W802-W818 (prompt 2) · 0 · 2 prompts groomed, 2 files, map sent
- 2026-11-01 · prompt-groom · W819 (o1), W820 (o2) · 0 · 2 orbit steers groomed, 2 files
- 2026-11-01 · prompt-groom · W821-W844 · 0 · 1 prompt groomed, 24 W-lines, 4 questions as W-lines
- 2026-11-01 · prompt-groom · W845-W846 (o7), W847-W849 (o8) · 0 · 2 orbit steers groomed, 5 W-lines, 1 question as W-line
- 2026-11-01 · prompt-groom · W850-W861 · 0 · 1 raw file, 12 W-lines, 2 questions as own W-lines
- 2026-11-01 · prompt-groom · W862 (1502), W863-W866 (1506), W867-W868 (o12) · 0 · 3 items groomed, 7 W-lines, 0 questions as own W-lines
- 2026-11-01 · prompt-groom · W871-W878 (1508) · 0 · 8 lines, side-channel probe + measure/close
- 2026-11-01 · prompt-groom · W879-W882 (1523) · 0 · 4 lines, 2 questions as own ❓ lines
- 2026-11-01 · prompt-groom · W883-W938 (1557) · 0 · 56 lines, 4 questions as own ❓ lines, wispr fixes applied
- 2026-11-01 · prompt-groom · W939-W946 (o19) · 0 · 8 lines, speak→bytes move steer
- 2026-11-01 · prompt-groom · W947-W952 (o20) · 0 · 6 lines, 5 questions as own ❓ lines
- 2026-11-01 · prompt-groom · W953-W959 (o21) · 0 · 7 lines, no questions
- 2026-11-01 · prompt-groom · W960-W966 (1620) · 0 · 7 lines, 1 question as own ❓ line, clio Q5 label dropped
- 2026-11-01 · prompt-groom · W967-W968 (orbit steer 24) · 0 · 2 lines
- 2026-11-01 · prompt-groom · W969-W972 (orbit steer 25) · 0 · 4 lines
- 2026-11-01 · prompt-groom · W973-W975 (orbit steer 26) · 0 · 3 lines
- 2026-11-01 · prompt-groom · W976 (orbit steer 38) · 0 · 1 line, 1 question as own ❓ line
- 2026-11-01 · prompt-groom · W977 (orbit steer 41) · 0 · 1 line
- 2026-11-01 · prompt-groom · W978 (orbit steer 46) · 0 · 1 line
- 2026-11-01 · prompt-groom · W979 (orbit steer 59) · 0 · 1 line
- 2026-11-01 · prompt-groom · W980-W982 (1709) · 0 · 3 lines, 2 questions as own ❓ lines
- 2026-11-01 · prompt-groom · W983-W986 (orbit steer 60) · 0 · 4 lines, 3 questions as own ❓ lines
- 2026-11-01 · prompt-groom · W987-W988 (orbit steer 61) · 0 · 2 lines, 2 questions as own ❓ lines
- 2026-11-01 · prompt-groom · W989-W992 (orbit steer 62) · 0 · 4 lines, 2 questions as own ❓ lines
- 2026-11-01 · prompt-groom · W994-W995 (orbit steer 64) · 0 · 2 lines, no questions
- 2026-11-01 · prompt-groom · W996-W1001 (orbit steer 67) · 0 · 6 lines, 5 questions as own ❓ lines
- 2026-11-01 · prompt-groom · W1002 (orbit steer 68) · 0 · 1 line, no questions
- 2026-11-01 · prompt-groom · W1003 (orbit steer 69) · 0 · 1 line, 1 question as own ❓ line
- 2026-11-01 · prompt-groom · W1004-W1007 (orbit steer 69, re-groomed; old W1003 superseded) · 0 · 4 lines, no questions
- 2026-11-01 · prompt-groom · W1008-W1011 (orbit steer 70) · 0 · 4 lines, no questions
- 2026-11-01 · prompt-groom · W1012 (orbit steer 72) · 0 · 1 line, no questions
- 2026-11-01 · prompt-groom · W1013 (orbit steer 73) · 0 · 1 line, no questions
- 2026-11-01 · prompt-groom · W1014-W1022 (dima 17:45) · 0 · 9 lines, 1 question as own ❓ line; wispr maps applied
- 2026-11-01 · prompt-groom · o74 (orbit steer 74, not groomed) · 1 · raw file missing: grooms/2026-11-01-o74.raw.md does not exist
- 2026-11-01 · prompt-groom · W1023-W1031 (dima 17:54) · 0 · 9 lines, no question marks; wispr maps applied; pasted_content wrapper dropped
- 2026-11-01 · prompt-groom · W1033-W1045 · 0 · 18:34 prompt groomed, 13 lines, wispr x pocket applied, questions on W1038 and W1039
- 2026-11-02 · prompt-groom · 1 · 0 · prompt-groom 2026-11-02-1216 · W1047-W1057 · 3 asks · 11 sentences mapped
- 2026-11-02 · prompt-groom · 1 · 0 · prompt-groom 2026-11-02-1237 · W1058-W1076 · 6 ❓ · 4 ← context lines no W-line
- 2026-11-02 · prompt-groom · 1 · 0 · prompt-groom 2026-11-02-1239 · W1077 · 0 ❓
- 2026-11-02 · prompt-groom · 1 · 0 · prompt-groom 2026-11-02-o1 · W1078 · 0 ❓
- 2026-11-02 · prompt-groom · 1 · 0 · prompt-groom 2026-11-02-1251 · W1079 · 0 ❓
- 2026-11-02 · prompt-groom · 1 · 0 · prompt-groom 2026-11-02-1247 · W1080-W1082 · 2 ❓
- 2026-11-02 · prompt-groom · 1 · 0 · prompt-groom 2026-11-02-1259 · W1083-W1086 · 0 ❓ · 1 ← context line
- 2026-11-02 · prompt-groom · 1255 · 0 · 1255: 3 lines, W1087-W1089, 2 ❓; --- separator dropped
- 2026-11-02 · prompt-groom · 1310 · 0 · 1310: 5 lines, W1090-W1093, 2 ❓; codie: left of ← is context, right of ← groomed as W1090; 'planed' corrected to 'planned'
- 2026-11-02 · prompt-groom · 1312+1316+o13 · 0 · 1312: W1094; 1316: W1095 + W1096 ❓; o13: W1097 (o13 steer stamp); 'ater'/'daed' typos fixed; W1094-W1097 appended to PK-297 notes
- 2026-11-02 · prompt-groom · 1326+1339 · 0 · 1326: W1098 + W1099 ❓; lines 1-10 are pasted clio board, context, no W-line; 1339: W1100; W1098-W1100 appended to PK-297 notes
- 2026-11-02 · prompt-groom · 1345+1354+1405+o16+o18 · 0 · W1101-W1128; 5 files; 1345: 1 ❓ x2 ❓; 1354: 4 ❓; 1405: 2 ❓; o16/o18 stamps absent in brief (date only); 14:03 no raw file in list, no line made; typo 'is there is' -> 'is there a', 'did not managed' -> 'did not manage', 'when he done' -> 'when he is done'; W1101-W1128 appended to PK-297 notes
- 2026-11-02 · prompt-groom · 1411 · 0 · 14:11 groomed W1133-W1142, homed in PK-297; W1127/W1128 stamps fixed by clio; --day and pocket-check green
- 2026-11-02 · prompt-groom · 1440 · 0 · 14:40 groomed W1143-W1180, homed in PK-298 (new, gta iv launcher); 14:23 no-wish added; --day and pocket-check green
- 2026-11-02 · prompt-groom · 1455 · 0 · 14:55 groomed W1181-W1186, homed in PK-298 via --append-notes; pasted Rockstar text as context; --day and pocket-check green
- 2026-11-02 · prompt-groom · 1543-1559 · 0 · groomed 15:43 (W1187-W1203) and 15:59 (W1204-W1218) into PK-297; no-wish 15:32, 15:37, o30; groom check and pocket-check green
- 2026-11-02 · prompt-groom · 1553-1629 · 0 · groomed 15:53 (W1219-W1223), 16:24 (W1224-W1228), 16:25 (W1229), 16:29 (W1230-W1238) into PK-297; no-wish 16:15, 16:18 answered; groom check and pocket-check green
- 2026-11-02 · prompt-groom · 1725 · 0 · groomed 17:25 as W1239-W1253; not homed (clio's brief asked for receipt only)
- 2026-11-02 · prompt-groom · 1653-1759 · 0 · 12 prompts groomed W1254-W1341; 1733 no-wish; not homed in PK-297
- 2026-11-02 · prompt-groom · 1807-1859 · 0 · 1807-1859 groomed+homed. 1845=W1373–W1401 (PK-299), 1859=W1402–W1428 (PK-299). rockstar/gta lines → PK-298, rest → PK-297. no-wish: 1820, 1827, 1829 (500 error), 1830. o56–o59 still red in --day (no groom); not homed, waiting on clio.
- 2026-11-02 · prompt-groom · 1906-1911 · 0 · 1906=W1436–W1439, 1911=W1440–W1445, all PK-299. pocket RED: W1429–W1435 (o56–o59) lack prompt stamp, can't fix (--notes blocked). day RED on o56–o59.
- 2026-11-02 · prompt-groom · o56-o59 · 0 · o56-o59 stamps fixed (o56 18:36, o57-59 18:59); PK-299 W1429-W1435 stamp-only edit; pocket-check green, --day green
- 2026-11-03 · inbox-prep · 1 · 0 · inbox-prep 2026-11-03: 2 items, 6 asks, coverage 6/6, no homes (freeze.app none; PK-288 subject-only)
- 2026-11-03 · prompt-groom · 1 · 0 · prompt-groom 2026-11-03 10:17: W1531-W1553, 23 lines, 30 sentences mapped, 6 ❓
- 2026-11-03 · prompt-groom · 1 · 0 · prompt-groom 2026-11-03 10:37: W1554-W1561, 8 lines, 2 ❓; 10:18/10:19/10:25 marked no-wish
- 2026-11-03 · prompt-groom · 1 · 0 · prompt-groom 2026-11-03 10:43: W1562-W1569 (8 lines, 3 ❓)
- 2026-11-03 · prompt-groom · 1 · 0 · prompt-groom 2026-11-03 10:47: W1570-W1574 (5 lines, 2 ❓; clio's pasted reply lines = context, no W-line)
- 2026-11-03 · pocket-write · 1 · 0 · PK-312 notes appended (append-notes, verbatim), pocket-check exit 0 all green
- 2026-11-03 · pocket-write · 1 · 0 · PK-311 W1919 re-groom + close: W1919 done (built 389c6184), append-notes, pocket-check exit 0
- 2026-11-03 · pocket-write · 1 · 0 · PK-312 three decided lines appended (append-notes), pocket-check exit 0
- 2026-11-03 · pocket-write · 1 · 0 · PK-312 re-folds W1924 (of W1922), W1925 (of W1923) appended, pocket-check exit 0
- 2026-11-03 · prompt-groom · 1 · 0 · FRM-499 groom 16:35 → 2026-11-03-1635.groomed.md, W3–W8; sentences map: 1→W3, 2→W4, 3→W5, 4→W6, 5→W7 ❓, 6→W8; desktop-born clause kept in W5
- 2026-11-03 · pocket-write · 1 · 0 · PK-308 notes: 16:35 steer header + W7, W8 appended (append-notes, verbatim), pocket-check exit 0
- 2026-11-03 · prompt-groom · 1 · 0 · 19:10 prompt → 2026-11-03-1910.groomed.md + PK-314 W1–W25 (append-notes); map: keep-hot note→W1–W5; pasted block→W6–W9; points 1–4→W10–W21; afk prios→W22–W24; kb→W25. steers, no W-line: 'lets proceed…' para, 'prio now: refined shift behaviour', 'so since i dropped… finish pk-159' para, 'you need a SW'. groomed file was absent, written by helga. pocket-check green
- 2026-11-03 · prompt-groom · 1 · 0 · CORRECTION to the 19:10 receipt above: pocket-check exit 1, 'now holds 4 items, the cap is 3' (my append only added notes; priority untouched). not green
- 2026-11-03 · groom · 2 · 0 · 1914 (W26-W32, W33 PK-314) + 1916 (W1911-W1913 PK-308) groomed, appended; pocket-check green; 1916 file corrected to exact raw text
- 2026-11-03 · groom · 2 · 0 · o103 (W1914-W1916) + 1931 (W1917-W1925) groomed, appended to PK-308; pocket-check green; 15-hour kept as raw
- 2026-11-03 · groom · 1 · 0 · 1951 (W1926-W1943) groomed, appended to PK-308; o103 tick raw already groomed at 19:31 (W1914-W1916), not re-appended; pocket-check green
- 2026-11-03 · groom · 1 · 0 · 2006 (W1944-W1951, Q1 answer) groomed, appended to PK-308; aside left as steer; pocket-check green
- 2026-11-03 · groom · 4 · 0 · W1952-W1961 appended to PK-308; stamped by minute not oN steer, pocket-check RED (20:13, 20:14); groomed files corrected to steer stamp, PK-308 note needs fix (append-only, not done); wispr sold→solved applied to o110 per clio
- 2026-11-03 · groom · 2 · 0 · 20:26 prompt W1962-W1983 (22 lines, siesta + Q8 quiet-contract, pasted blocks kept whole, arrow dropped) and o120 W1984-W1985 [re: Q8] appended to PK-308; side-sessions-event wrapper skipped; pocket-check green
- 2026-11-03 · groom · 1 · 0 · 20:30 prompt W1986-W1993 [re: Q8] appended to PK-308 (shift-skill review item); pocket-check green.
retro (14:43 on):
1. FRM-499 brief named the raw, no output file: [ask] round-trip.
2. 19:10 brief said the groomed file existed; it did not, wrote it from raw.
3. green receipt logged before pocket-check; it was red (cap 3), correction round.
4. steer grooms lacked the oN steer stamp: 20:13/20:14 red; PK-308 still has minute stamps.
5. 1916 paraphrase caught on re-read, rewritten before append.
- 2026-11-03 · groom · 1 · 0 · 20:41 visibility wish groomed to 2026-11-03-2041.groomed.md, W7-W13, lines sent to clio for FRM-499 fold; linear not written (members never write linear)
- 2026-11-03 · groom · 1 · 0 · 20:57 waker answer groomed to 2026-11-03-2057.groomed.md, W1954-W1958 numbered from --next FRM-500; lines sent to clio to fold; linear not written
- 2026-11-04 · prompt-groom · 1 · 0 · boot-1104 PK-319 W1-W6; 6 sentences mapped; slash line and slug excluded (not wishes)
- 2026-11-04 · prompt-groom · 1 · 0 · boot-1014 PK-319 W7-W19; 13 sentences mapped, 6 questions as W-lines with ❓ (W7, W10, W13-W16, W19); map: why-mods-lane→W7; its-important→W8; worth-test→W9; how-to-test→W10; siesta-step-5→W11; make-it-earlier→W12; why-siesta-so-far→W13; how-decide→W14; in-progress-pile→W15; unclosable→W16; proceed→W17; i-vote→W18; tell-if→W19
- 2026-11-04 · prompt-groom · 1 · 0 · boot-1043 PK-319 W20-W62; 43 lines, 12 questions as ❓ lines (W24 W30 W37 W40 W43 W46 W48 W49 W55 W57 W58 W59); map: FRM block→W20-21; In Progress pile→W22-W34; real causes→W35-W47; pasted block→W48-W54; side lane/node 26/fnm/engines/ci→W55-W62
- 2026-11-04 · prompt-groom · 1 · 0 · boot-1101 PK-319 W20-W22 (1045) and W23-W38 (1101); pre-← clio lines not mapped; standing-proof file written, 14 #standing lines (W19-W21, W29-W30, W36-W44)
- 2026-11-04 · prompt-groom · 1 · 0 · boot-1101 standing-proof: 14:19 and 14:38 sections, 44 lines, 14 tagged #standing
- 2026-11-04 · prompt-groom · 0 · 1 · boot-1106 1043 re-groom W20-W56 no clio lines; 1045 renumbered W57-W59; 1101 renumbered W60-W75; #standing W30 W31 W37 W45 W46 W47 W69; 10:14 W9 W15 left as is
- 2026-11-04 · pocket-write · 1 · 0 · boot-1106 PK-319 notes +W20-W75 (3 files); --next W76; --day red o12
- 2026-11-04 · prompt-groom · 1 · 1 · boot-1106 standing-proof rework: #standing moved to line end, 14 lines (W19-W21 W29-W30 W36-W44)
- 2026-11-04 · prompt-groom · 1 · 0 · boot-1117: 1117 raw to W76-W99, #standing on W88 only
- 2026-11-04 · pocket-write · 1 · 0 · boot-1117: PK-319 notes appended W76-W99, --next prints W100
- 2026-11-04 · prompt-groom · 1 · 0 · 1258 raw to W100-W105, not appended to PK-319
- 2026-11-04 · prompt-groom · 1 · 0 · 1308 raw to W106-W109, not appended to PK-319
- 2026-11-04 · prompt-groom · 1 · 0 · 1424 groomed W128-W153
- 2026-11-04 · prompt-groom · 1 · 0 · 1438 + o45 groomed W154-W159, appended PK-319
- 2026-11-04 · prompt-groom · 1 · 0 · 1449 + o48 + o49 groomed W175-W178, appended PK-319
- 2026-11-04 · prompt-groom · 1 · 0 · 1514 groomed W179-W183, appended PK-319
- 2026-11-04 · prompt-groom · 1 · 0 · 7 raws groomed W187-W197 (o61, 1522, 1543, 1551, 1553, 1600, 1603)
- 2026-11-04 · prompt-groom · 1 · 0 · 1626 groomed W201-W203
- 2026-11-04 · prompt-groom · 1 · 0 · o72 groomed W204-W211
- 2026-11-04 · prompt-groom · 1 · 0 · o69 groomed W213-W223
- 2026-11-04 · prompt-groom · 1 · 0 · 1633 groomed W224-W225
- 2026-11-05 · prompt-groom · 1 · 0 · 1651 groomed W4-W26 home FRM-507; sentence map in [done]
- 2026-11-05 · prompt-groom · 1 · 0 · 1655 groomed W27-W28 home FRM-507
- 2026-11-05 · prompt-groom · 1 · 0 · 1656 groomed W29-W32 home FRM-507
- 2026-11-05 · prompt-groom · 1 · 0 · 1657 groomed W33-W34 home FRM-507
- 2026-11-05 · prompt-groom · 1 · 0 · 1700 groomed W35 home FRM-507
- 2026-11-05 · prompt-groom · 1 · 0 · 1705 groomed W36-W40 home FRM-507
- 2026-11-05 · prompt-groom · 1 · 0 · 1708 groomed W41-W44 home FRM-507
- 2026-11-05 · prompt-groom · 1 · 0 · 1734 groomed W45-W66 home FRM-507; pasted chunk list skipped
- 2026-11-05 · prompt-groom · 1 · 0 · 1743 W67-W86 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · o9 W87 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · o12 W88-W90 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · o13 W91 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1757 W92-W118 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1800 W119 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1801 W120 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1802 W121 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · o14 W122-W123 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1807 no-wish, side-session event only
- 2026-11-05 · prompt-groom · 1 · 0 · 1813 W124-W138 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1817 W139-W140 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1818 W141 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1819 W142 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 1823 W143 groomed
- 2026-11-05 · prompt-groom · 1 · 0 · 18:25 groomed W144; no-wish: Ok tail
- 2026-11-05 · prompt-groom · 1 · 0 · 18:26 groomed W145
- 2026-11-05 · prompt-groom · 2 · 0 · 18:27 groomed W146-W147
- 2026-11-05 · prompt-groom · 1 · 0 · 18:30 groomed W148
- 2026-11-05 · prompt-groom · 2 · 0 · 18:34 groomed W149-W150; 18:35 no-wish line added
- 2026-11-05 · prompt-groom · 0 · 0 · 18:41 no-wish: sw
- 2026-11-05 · prompt-groom · 1 · 0 · 18:43 groomed W151-W159 (FRM-507)
- 2026-11-05 · prompt-groom · 1 · 0 · 18:55 groomed W1-W10 (PK-321)
- 2026-11-05 · prompt-groom · 1 · 0 · 18:56 groomed W11 (PK-321 home)
- 2026-11-05 · prompt-groom · 1 · 0 · 19:11 groomed W13 (PK-321 home); 18:50 no-wish line added
- 2026-11-05 · prompt-groom · 0 · 0 · o34 no-wish: question answered in place
- 2026-11-05 · prompt-groom · 12 · 0 · 19:56 groomed W1909-W1920 (FRM-505 home)
- 2026-11-05 · prompt-groom · 1 · 0 · 20:03 groomed: W1921 (FRM-505 approve line), W1984-W1991 (FRM-501)
- 2026-11-05 · prompt-groom · 1 · 0 · 2025 groom: W1992 under FRM-501
- 2026-11-05 · prompt-groom · 1 · 0 · 2035 groom: W1922-W1925 under FRM-505
- 2026-11-05 · prompt-groom · 1 · 0 · 2039 groom: W1926-W1930 under FRM-505
- 2026-11-05 · prompt-groom · 1 · 0 · o51 groom: W1931-W1935 under PK-320
- 2026-11-05 · prompt-groom · 1 · 0 · 2054 groom: W1936-W1940 under FRM-505
- 2026-11-05 · prompt-groom · 1 · 0 · 2213 groom: W3-W5 under FRM-513
- 2026-11-05 · prompt-groom · 1 · 0 · 2215 groom: W6-W9 under FRM-513
- 2026-11-05 · prompt-groom · 1 · 0 · side-naming: W10-W12 written to grooms/2026-11-05-side-naming.groomed.md; PK-322 notes appended with dima's raw naming words and ticks
- 2026-11-05 · prompt-groom · 1 · 0 · 2221 o75 steer: W2001-W2003 under FRM-509 written to grooms/2026-11-05-2221.groomed.md
- 2026-11-05 · prompt-groom · 1 · 0 · o76 steer: W2004-W2006 under FRM-509 written to grooms/2026-11-05-o76.groomed.md
- 2026-11-05 · prompt-groom · 1 · 0 · 2255 cancel habit + o85 question: W1-W3 under PK-324 written to grooms/2026-11-05-2255.groomed.md
- 2026-11-05 · prompt-groom · 1 · 0 · 2319 o90 steer: W1-W2 under FRM-387, W3-W6 under FRM-424 written to grooms/2026-11-05-2319.groomed.md
- 2026-11-06 · prompt-groom · 1 · 0 · 2358: W1-W4 under new pocket item written to grooms/2026-11-05-2358.groomed.md
- 2026-11-06 · prompt-groom · 1 · 0 · 0013 shift plan: W1-W7 written to grooms/2026-11-06-0013.groomed.md
- 2026-11-06 · prompt-groom · W14 · W16 · 01:05 groom: home FRM-513 (--next returned W14, no clio-stated number to cross-check); W14-W16 written
- 2026-11-06 · prompt-groom · 1 · 0 · PK-326 batch 1343: W8-W26, 2 ❓ lines (W11, W17); every sentence mapped
- 2026-11-06 · inbox-prep · 1 · 1 · inbox-helga.md: 1 wish W1 (PK-334 home); check red on title ✅ PK-334 prefix, fixed by re-read + quote line; green 2/2
- 2026-11-06 · pocket-write · 0 · 0 · PK-326 renumber W1-W7 (00:13 block) to W27-W33: blocked, notes append-only; no --notes used; nothing written
- 2026-11-06 · prompt-groom · 1 · 0 · PK-326 batch 1400: W22-W34, 2 ❓ (W26, W30); clio-quoted segments before ← (no W-line), his words after ←; verbatim cut kept at W31
- 2026-11-06 · prompt-groom · 1 · 0 · FRM-368 batch 1424: W426-W436, 2 ❓ (W435, W436); pasted_content d2a1 groomed W427-W433 as his words; 14:12 and 14:13 raw files not found, no no-wish lines written
- 2026-11-06 · pocket-write · 1 · 0 · PK-326 notes: 13:43 (3), 14:00 (13), 14:24 (7) red lines appended verbatim; day check green 14:25
- 2026-11-06 · pocket-write · 1 · 0 · PK-310 note appended (side channel); exit 0, last line read back
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-04-1756.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-04-1903.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-05-1852.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-05-2104.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-05-2132.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-0108.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-0125.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-0126.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-0224.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-0238.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-1412.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-1448.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-1610.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-1626.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-1754.groomed.md
- 2026-11-06 · prompt-groom · yes · 0 · groomed /Users/dima/.local/state/clio/grooms/2026-11-06-1759.groomed.md
- 2026-11-06 · prompt-groom · no · 1 · rework: groomed /Users/dima/.local/state/clio/grooms/2026-11-06-1754.groomed.md (clio quotes and ← tails were read as dima's)
- 2026-11-06 · prompt-groom · no · 1 · rework: groomed /Users/dima/.local/state/clio/grooms/2026-11-06-1759.groomed.md (clio quotes and ← tails were read as dima's)
- 2026-11-06 · prompt-groom · yes · 0 · PK-340 groom: 18:10, 18:16, 18:18, 18:19, 18:28, 18:30 (W1–W18)
- 2026-11-06 · pocket-write · yes · 0 · PK-340 notes: 18 groomed lines appended (W1–W18); W6 and W7 carry wing 1 and wing 2 titles
- 2026-11-06 · trial-log · no · 0 · 16 of 17 trial lines appended dated 2026-11-06 to wisphunter, skill-named-load, helper-lite, ts-lsp log, tdd log; review-rounds held by session 89a213e9 (x-mod-holds, 2 retries), not appended; no commit
- 2026-11-06 · trial-log · yes · 0 · 17 trial lines committed in 6 files, sha 253e07616ad3e53158f4740b61d2fcd4746a0ba1; helga.md not included (7 uncommitted lines by another session)
- 2026-11-06 · groom · yes · 0 · PK-325: 4 W-lines W1313-W1316 appended; PK-340: 1 no-wish line (board steer o44). 5 lines total
- 2026-11-06 · groom · yes · 0 · 19:32 prompt: 2 W-lines W1318-W1319, W1319 marked ❓ (2 questions? 1 ❓)
- 2026-11-06 · groom · yes · 0 · 19:42 + 19:52 groomed (8 W-lines: W1318-W1321, W1322-W1325; ❓ x3); 7 no-wish lines 19:26 19:34 19:37 o42 o52 o53 o54. W1318/W1319 collide with 19:32 groom; pocket-check green, 10 no-home reds on W-lines not yet folded
- 2026-11-06 · groom · yes · 0 · renumbered 19:42 W1320-W1323, 19:52 W1324-W1327; folded PK-325 W1318-W1327 into notes; 9 reds: 2 no-wish (o20, o25), 7 named to clio (o11 o21 o35 o46 o55 o69 o70) - steer texts not in transcript, judged on 70-char red text
- 2026-11-06 · groom · yes · 0 · 2014 groom W1328-W1332, o65 steer W1333, 20:00 no-wish

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
