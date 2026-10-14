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

- `claude --bg --name '🎼 composer' --model haiku --effort medium` from `~/.local/state/composer/`, whose
  `.claude/settings.json` sets `worktree.bgIsolation: "none"` — a `--bg` session's edits in the shared
  checkout are refused until it isolates (ccrow, 2026-10-14); the first chore proves the edit lands in main
- the boot prompt is `x:crew-composer` as text, its frontmatter cut

## the measures

- cclio's context per closed pocket item — baseline 2026-10-14 (rough): ~307k chars of tool output over
  ~9 closed items, ~34k per item, 1 compaction (16:31)
- composer's first-pass green rate, per chore class
- cclio's rework rate on its output
- wishkeeper and ccrow finds traced to composer
- tokens of both threads against cclio alone
- composer's own context fill, with no clear or compact: how fast it grows per batch (dima: Haiku is best used under ~100k; boot ~89k after b1)

## kill rules (ccrow, 2026-10-14)

- a verify costs more than half the chore it checks
- more than 1 in 5 chores needs rework
- no drop in context per closed item after 3 days of use (the plan critic)

## the rules of the trial

- calibration: cclio reads every diff of the first 10 chores, never the receipt alone, and logs each
  miss a receipt hid; rerun-on-surprise starts only after a clean 10 (the plan critic)
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

## rounds

- round 1 (2026-10-14): composer started as e80c18d2, Haiku 5.5 medium, bgIsolation none; first batch b1

## verdict
