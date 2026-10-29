---
id: PK-157
title: 'ccrow, composer, designer: git-tracked and colocated with cclio'
status: done
assignee: []
created_date: '2026-10-16 10:24'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: next
type: question
ordinal: 10105
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** PK-158's build (fork-guard) — it runs right after.
inbox 10-16, Q: are they git-tracked? their fs location makes sense (external stays out of frame), but he wants them tracked, ideally colocated with cclio — maybe in cclio's folder, since ccrow and composer are her parts. the designer: pull it into frame? how, without loading redundant memories into them — any escape hatch that keeps it clean?
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 14:42: dima's tick (o17): studio got a private remote, github.com/dvakatsiienko/studio, all 8 branches pushed (ls-remote 9 refs = 8 heads + HEAD). ccrow code is in frame (ccrow/), composer's contract is x:crew-composer; only runtime state lives in ~/.local/state. left: the uncommitted jobs/speak/brief.md (+51 lines) and 1 dirty file in worktree speak-opus, not mine to commit.

2026-10-16 14:51 correction (wishkeeper, siesta 4): the 14:41 «ccrow restores fully» was wrong. ~/.local/state/ccrow/steers.md (9 KB, dima's dated steers to ccrow, read on every wake) is in no git repo, and notes.jsonl + verdicts.jsonl are the ccrow trial's data (verdict 10-20). composer's state dir holds 3 files (+ .claude.json.bak 167 KB), not 2. the studio leftovers ARE committed (6be2d54 main, 001f1a8 worktree-speak-opus). the colocation wish is still open: the escape hatch (a memory exclude for a subfolder) was never probed — «would start acting as cclio» was an inference.

2026-10-16 15:23: steers.md moved into frame (ccrow/steers.md, symlink back; crew-adviser points at the frame path, o26). still open: the colocation escape hatch — probe a memory exclude for a subfolder (claudeMdExcludes or a nested settings) before the halt, one line of objection with a pick.

2026-10-18 boot: dima steers today to parse + answers + the viz-tool shape; the pocket gets solved after the weekly reset (10-19 07:00); runs right after PK-158

parked: until the weekly reset (2026-10-19 07:00) — dima 10-18: today is the parse, the answers, the small stuff and the viz-tool shape; the pocket is solved after the reset

2026-10-19 19:19: unparked (the reset passed); claimed → open — the claim from 10-16 was never released when it parked (dima caught it). next: the claudeMdExcludes probe, right after PK-158

2026-10-21 13:56: due moved 10-20 → 10-24, the mods lane's date (PK-120); it still waits on PK-158's build.
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved — FRM-430 carries this item (its body lists «pocket PK-157») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
