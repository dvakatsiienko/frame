# clio

coordinator home for **clio** (cc orchestrator) — dima's coordinator brain running as a
plain claude code cli session. lives inside the frame repo — frame is the fleet repo, and
a fleet coordinator does not sit in a repo of its own.

the coder-global memfile at `~/projects/CLAUDE.md` does not exist yet ([DOT-195](https://linear.app/x-com/issue/DOT-195)
creates it). when it does, this path would start inheriting it — the fix then is relocating the
whole repo (renamed from dotfiles to frame, 2026-09-23), not moving clio back out. see [DOT-202](https://linear.app/x-com/issue/DOT-202).

## boot
```
cd ~/frame/_clio && claude
/clio:boot
```

## layout
- `AGENTS.md` — the coordinator memfile
- `memory/_MEMORY.md` — barrel index; leaves hold content
- `plugin-clio/skills/boot/SKILL.md` — the `/clio:boot` boot ritual
- `pocket/` — the work pool (Backlog.md) · `ROLLBACK.md` — how to undo this

## reverse
`git rm -r _clio/` inside frame, plus a revert of the fold commit. see `ROLLBACK.md`.
