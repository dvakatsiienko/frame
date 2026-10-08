# x-mod-stash — dima's command center above the prompt

one folded row over every live session: its open ⏳ asks, the afk switch, keep-hot 🔥, file holds, the
guard counter, and the `/board` fleet board. what each does, and every decision behind it: `FTR.md`.
the words: `GLOSSARY.md`.

## holds — the want

> collision guard — i think this is the most useful! and it will let us cut memory lines?

two sessions never write the same file at the same time: the «shared working tree» rules stop being
memory and become a mechanism.

## holds — why built here (prior art, 2026-10-04)

two public hooks already deny an edit from a PreToolUse hook — [agent-coord](https://github.com/ThatHunky/agent-coord)
and [claude-code-file-lock](https://github.com/nstksean/claude-code-file-lock). neither is reused:
- a mod imports only its own files and `"claude-code"` — no npm, no foreign hook code
- neither has our release rules (clean in git, session end, idle since the last turn)
- x-mod-stash already owns the store, the session lifecycle and the row
- the rest (mcp_agent_mail, agent-claim-mcp, Dibs, agentlocks) are advisory leases the agent must opt into

cc's own nets stop short: «modified since read» stops a blind overwrite only, and `bgIsolation`
covers `--bg` sessions only — interactive and Code-tab sessions, the ones holds is for, are bare.

## keep-hot — the want (2026-10-04)

> sometimes i spend too much of the 5h window by accident: a few % left, and ~3-4 h before the reset.
> so i need a «keep-session-hot» feature, likely a minimal auto-ping every ~50 min.

- why: a cold cache makes the first prompt after the reset re-write the whole context at the 1h
  price (2×); a warm ping reads it at 0.05× — four pings over a 3.5 h wait cost about a tenth of
  one cold write (pricing from the claude-api skill; how the 5h meter counts cache reads is unmeasured)
- out: pinging a busy session, auto-on without dima's click, any window but the 5h one
