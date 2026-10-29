---
status: live
until: 2026-11-01
---

# test drive — dev.fast whiteboard

window: from 2026-10-06; verdict after the first real cases, compared head to head with show-me. app 0.2.0 via `brew install --cask devdotfast/tap/whiteboard`.

## what it is (day 0, three research lanes, 2026-10-06)

a free, local, MIT desktop code-review canvas (a fork of VS Code's open-source core). an agent fills it with blocks that link to git commits: sequence, flow, ER diagrams, `code_peek`, `call_stack_diff`, markdown. not a free-form drawing board — even the scratchpad pins code to commits.

## how we drive it

- the cli, never the mcp (dima: «mcp sucks»): `whiteboard api <tool> '<json>'` runs the same tools — `session_capabilities` first, then `session_create`, `session_edit`, `session_get`, `session_get_instructions '{"topic":"scratchpad"}'`
- the app must be running: the cli is a client of its local server
- telemetry off: Settings → «Share anonymous usage data»; `DO_NOT_TRACK=1` for the cli

## stress list

- **cclio proposes it** (dima, 2026-10-14): any ask a picture of code would answer — a pr review, «how does X flow», a diff across arms — gets a one-line «whiteboard this?» offer

- review the cli a/b/c arms (FRM-284) when they report — two codebases, diagrams per arm
- a scratchpad «show me how X works» beside `/show-me` on the same question
- a pr review on a real codie pr
- ⇧⌘C a block back to the agent and redraw
- `whiteboard share` — what the link carries (an immutable copy anyone can download)

## gotchas

- 20+ worktrees under `.claude/worktrees/` spawn heavy load ([#954](https://github.com/devdotfast/whiteboard/issues/954)); we run 6
- data lives in `~/.dev/`; `brew uninstall --zap` leaves it — removal is that dir by hand, on dima's word
- untracked files need `git add -N` to show in a review

## log

- 2026-10-14 · extended to 10-28 on dima's word: the fleet is in meta work and no case fits; the next app-coding lane is where it gets tried · no round

one line per use: date · case · blocks it drew · dima's verdict · note
- 2026-10-06 · install + first probe · `whiteboard api session_capabilities` → desktopAvailable true, scratchpad off · the PATH-button install left ~/.zprofile untouched (the comment line held) · cli-driven, no mcp
- 2026-10-06 · FRM-284 a/b/c review (first real case) · intro + 3 arms (sequence + 3 code_peek each) + one call_stack_diff + closing · 5.1 min agent run, ~62 api calls, 9 failed (4 bad parent ids, ranges, a symlink; `session_source` takes fromLine/toLine, edits take start/end; move without afterId appends) · call_stack_diff has only old/new sides · per-source commit pins let one session show two branches · dima's verdict: pending
- 2026-10-06 · dima's verdict on round 1: «looks good for me, let's keep for now» · the in-app «ask claude code» answered «The head checkout for this review is not ready yet.» (and «Diff selection unavailable» on code peeks) — whiteboard ↔ cclio comms unproven; the ask panel runs its own claude in a checkout of the head, it never reaches this session

## the reminder, moved here (2026-10-11, o139)

⏰ 🔬 whiteboard test drive (dev.fast, cli-driven) — first real case: review the cli a/b/c arms (FRM-284) when they report; log in `docs/test-drive/whiteboard.md`; the verdict compares head to head with show-me, then the whiteboard recipe is written from the real uses. dima 2026-10-06: «let's test drive it … create and execute the whiteboard app recipe» — set 2026-10-06
