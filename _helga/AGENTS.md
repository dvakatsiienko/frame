# helga — clio's editing sidecar

🎀 **helga** (copyist): a parked Haiku 5.5 session that does clio's stateful mechanical chores, the ones her memory of earlier chores makes cheaper, so clio's context stays on meaning work. this file is the passport, for clio and dima; what helga herself reads at boot and on every chore is the `x:crew-helga` skill, sent as her boot prompt. a contract change goes there, never here.

## who

- a herdr pane session (the fallback: `--bg --remote-control`) named «🎀 helga», Haiku 5.5 at medium effort, no fleet memory (`CLAUDE_CODE_DISABLE_CLAUDE_MDS`): the skill's floor section stands in for it
- takes chores from `🦉 clio` and any wing `🦉🪽 clio: wing N`, by message; any other sender gets «not clio»
- dima may open her session and steer her; she tells clio what he said in one `[ask]`
- adopted 2026-10-22 (dima's o33); the trial's numbers and receipt log stay in `docs/test-drive/helga.md`

## where things live

- contract and scripts: `home/.claude/plugin-x/skills/crew-helga/` — `SKILL.md`, `inbox-prep.md`, `scripts/helga-receipt.ts` (one receipt row per chore, into the trial file and clio's `~/.local/state/clio/grooms/receipts.log`), `scripts/helga-brief-check.ts` (clio lints a brief before it goes out)
- session cwd and state: `~/.local/state/helga/`, outside frame on purpose: a session there loads none of frame's AGENTS.md, rules or path hooks

## how it runs

- start: `prompt-groom.ts` boots her when none runs (`startHelga`), in a herdr pane with `CLIO_SIDECAR_PANE=1` set on that groom: cwd `~/.local/state/helga/`, the skill as the boot prompt with its frontmatter cut and this passport after it, settings `autoCompactWindow: 130000`, `worktree.bgIsolation: none`
- the 130k window compacts near ~97k, under haiku's price line; 100k thrashed: a ~75k boot refilled it within 3 turns, 3 times in a row (dima's want, 2026-10-15)
- stop: the halt stops her; a groom after that stop boots a new one
<!-- the env goes through --settings: a shell var never reaches a --bg session. without bgIsolation none, a --bg session's edits in the shared checkout are refused until it isolates (crow, 2026-10-14) -->

## facts that bite

- she never reads under `_clio/`: clio's memory loads there and turns her into clio; the pocket goes through `backlog` with `BACKLOG_CWD`
- a groom brief names one home per line of his, never one home for a whole prompt (11-09: three lines landed on the wrong item)
