---
id: PK-157
title: 'ccrow, composer, designer: git-tracked and colocated with cclio'
status: claimed
assignee: []
created_date: '2026-10-16 10:24'
updated_date: '2026-10-16 12:23'
due_date: '2026-10-16'
labels:
  - s
dependencies: []
priority: next
type: question
ordinal: 10105
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-16, Q: are they git-tracked? their fs location makes sense (external stays out of frame), but he wants them tracked, ideally colocated with cclio — maybe in cclio's folder, since ccrow and composer are her parts. the designer: pull it into frame? how, without loading redundant memories into them — any escape hatch that keeps it clean?
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 14:42: dima's tick (o17): studio got a private remote, github.com/dvakatsiienko/studio, all 8 branches pushed (ls-remote 9 refs = 8 heads + HEAD). ccrow code is in frame (ccrow/), composer's contract is x:crew-composer; only runtime state lives in ~/.local/state. left: the uncommitted jobs/speak/brief.md (+51 lines) and 1 dirty file in worktree speak-opus, not mine to commit.

2026-10-16 14:51 correction (wishkeeper, siesta 4): the 14:41 «ccrow restores fully» was wrong. ~/.local/state/ccrow/steers.md (9 KB, dima's dated steers to ccrow, read on every wake) is in no git repo, and notes.jsonl + verdicts.jsonl are the ccrow trial's data (verdict 10-20). composer's state dir holds 3 files (+ .claude.json.bak 167 KB), not 2. the studio leftovers ARE committed (6be2d54 main, 001f1a8 worktree-speak-opus). the colocation wish is still open: the escape hatch (a memory exclude for a subfolder) was never probed — «would start acting as cclio» was an inference.

2026-10-16 15:23: steers.md moved into frame (ccrow/steers.md, symlink back; crew-adviser points at the frame path, o26). still open: the colocation escape hatch — probe a memory exclude for a subfolder (claudeMdExcludes or a nested settings) before the halt, one line of objection with a pick.
<!-- SECTION:NOTES:END -->
