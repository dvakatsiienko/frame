# x-mod-holds — no two sessions write the same file

## the want

> collision guard — i think this is the most useful! and it will let us cut memory lines?

two sessions never write the same file at the same time: the «shared working tree» rules stop being
memory and become a mechanism.

## why built here (prior art, 2026-10-04)

two public hooks already deny an edit from a PreToolUse hook — [agent-coord](https://github.com/ThatHunky/agent-coord)
and [claude-code-file-lock](https://github.com/nstksean/claude-code-file-lock). neither is reused:
- a mod imports only its own files and `"claude-code"` — no npm, no foreign hook code
- neither has our release rules (clean in git, session end, idle since the last turn)
- it began inside x-mod-stash, which owned the store, the session lifecycle and the row; it moved to its own mod in FRM-349; stash's 🔒 chip left in FRM-354, so nothing draws the holds now
- the rest (mcp_agent_mail, agent-claim-mcp, Dibs, agentlocks) are advisory leases the agent must opt into

cc's own nets stop short: «modified since read» stops a blind overwrite only, and `bgIsolation`
covers `--bg` sessions only — interactive and Code-tab sessions, the ones holds is for, are bare.
